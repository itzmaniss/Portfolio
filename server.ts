/**
 * Self-hosted entry point (Docker, or any box with Bun).
 *
 * Cloudflare Pages serves dist/ and the functions/ directory by itself;
 * this server mirrors that layout on a plain origin: it serves the built
 * site from dist/ and routes POST /api/contact through the very same
 * onRequestPost the Pages Function exports, so both deploys share one
 * handler and one set of behaviour.
 *
 * Everything crosses the boundary as standard Request/Response objects,
 * which is what keeps functions/api/contact.ts free of Bun-only APIs.
 */
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { onRequestPost } from "./functions/api/contact";

// The only Bun API surface used here, declared locally so the rest of the
// project stays type-checked against the DOM lib without pulling in
// bun-types (whose fetch/Response globals would clash with it).
declare const Bun: {
	serve(options: {
		port?: number;
		hostname?: string;
		fetch(request: Request): Response | Promise<Response>;
	}): { stop(closeActiveConnections?: boolean): void; port: number };
};

const DIST_DIR = resolve(new URL(".", import.meta.url).pathname, "dist");
const PORT = Number(process.env.PORT) || 6969;

// ── dist/_headers: one source of truth for cache + security headers ────
// Cloudflare Pages reads the file verbatim; we parse it once at startup
// and apply the same rules to static responses here, so the Docker
// deploy behaves like Pages. Simple Pages format: a path pattern line
// (`*` splats), then indented `Name: value` lines, with Pages' `! Name`
// detach syntax supported.
type HeaderOp = { op: "set" | "unset"; name: string; value: string };
type HeaderRule = { pattern: string; ops: HeaderOp[] };

const escapeRegExp = (text: string): string =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const HEADER_RULES: HeaderRule[] = await readFile(
	join(DIST_DIR, "_headers"),
	"utf8",
)
	.then((text) => {
		const rules: HeaderRule[] = [];
		let current: HeaderRule | null = null;
		for (const rawLine of text.split("\n")) {
			const line = rawLine.trim();
			if (!line) continue;
			if (rawLine.startsWith(" ") || rawLine.startsWith("	")) {
				if (!current) continue;
				// `! Name` removes a header a broader rule already set.
				if (line.startsWith("!")) {
					current.ops.push({
						op: "unset",
						name: line.slice(1).trim(),
						value: "",
					});
					continue;
				}
				const sep = line.indexOf(":");
				if (sep > 0) {
					current.ops.push({
						op: "set",
						name: line.slice(0, sep).trim(),
						value: line.slice(sep + 1).trim(),
					});
				}
			} else if (line.startsWith("/")) {
				current = { pattern: line, ops: [] };
				rules.push(current);
			}
		}
		return rules;
	})
	.catch(() => {
		console.warn("No dist/_headers found; serving without its headers.");
		return [] as HeaderRule[];
	});

// Pages merge semantics: rules apply in file order, and duplicate header
// names join unless a rule first detaches them with `! Name`.
function headersFor(pathname: string): Record<string, string> {
	const merged: Record<string, string> = {};
	for (const rule of HEADER_RULES) {
		const regex = new RegExp(
			`^${rule.pattern.split("*").map(escapeRegExp).join(".*")}$`,
		);
		if (!regex.test(pathname)) continue;
		for (const { op, name, value } of rule.ops) {
			if (op === "unset") {
				delete merged[name];
			} else {
				merged[name] = value;
			}
		}
	}
	return merged;
}

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".webmanifest": "application/manifest+json",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

async function serveStatic(pathname: string): Promise<Response | null> {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}

	// `.` + pathname, resolved, then pinned inside dist/ so a crafted URL
	// (../, %-encoded) can't walk out of the build directory.
	const target = resolve(DIST_DIR, `.${decoded}`);
	if (target !== DIST_DIR && !target.startsWith(DIST_DIR + sep)) return null;

	const candidates = decoded.endsWith("/")
		? [join(target, "index.html")]
		: [target, join(target, "index.html"), `${target}.html`];

	for (const candidate of candidates) {
		// Pages doesn't serve the _headers file either.
		if (extname(candidate) === "" && candidate.endsWith("_headers")) {
			continue;
		}
		try {
			const body = await readFile(candidate);
			return new Response(body, {
				headers: {
					"Content-Type":
						MIME_TYPES[extname(candidate)] ?? "application/octet-stream",
				},
			});
		} catch {
			// Missing file, or a directory hit (EISDIR): try the next candidate.
		}
	}
	return null;
}

const server = Bun.serve({
	port: PORT,
	async fetch(request) {
		const { pathname } = new URL(request.url);

		if (request.method === "POST" && pathname === "/api/contact") {
			return onRequestPost({
				request,
				env: { RESEND_API_KEY: process.env.RESEND_API_KEY },
			});
		}

		if (request.method === "GET" && pathname === "/health") {
			return Response.json({
				status: "ok",
				timestamp: new Date().toISOString(),
			});
		}

		if (request.method === "GET" || request.method === "HEAD") {
			const staticResponse = await serveStatic(pathname);
			if (staticResponse) {
				for (const [name, value] of Object.entries(headersFor(pathname))) {
					staticResponse.headers.set(name, value);
				}
				return staticResponse;
			}
		}

		return new Response("Not found", { status: 404 });
	},
});

console.log(`Portfolio server running at http://localhost:${server.port}`);
