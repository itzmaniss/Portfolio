/**
 * Worker entry for the Cloudflare Workers deploy.
 *
 * Static assets in dist/ are served directly by Cloudflare's asset
 * server (wrangler.jsonc `assets`), so this script only ever runs for
 * /api/* (run_worker_first) and falls through to the ASSETS binding for
 * anything else. The contact handler is the same onRequestPost the Bun
 * server uses, kept runtime-agnostic on purpose.
 *
 * Typed with minimal local types instead of @cloudflare/workers-types,
 * whose Request/Response globals would clash with the DOM lib that the
 * rest of the project (astro check) type-checks against.
 */
import { onRequestPost } from "../functions/api/contact";

type Fetcher = {
	fetch(request: Request): Promise<Response>;
};

export type Env = {
	ASSETS: Fetcher;
	RESEND_API_KEY?: string;
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (pathname === "/api/contact") {
			if (request.method !== "POST") {
				return new Response("Method not allowed", {
					status: 405,
					headers: { Allow: "POST" },
				});
			}
			return onRequestPost({ request, env });
		}

		return env.ASSETS.fetch(request);
	},
};
