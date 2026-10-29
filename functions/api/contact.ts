/**
 * POST /api/contact.
 *
 * Shared contact handler: imported by worker/index.ts for the Cloudflare
 * Workers deploy and by server.ts for the Docker self-host deploy. It
 * sticks to standard fetch/Request/FormData/Response APIs with no
 * runtime-specific APIs, so both entry points behave identically.
 *
 * The fragments returned here carry Tailwind classes that appear nowhere
 * else, so src/styles/global.css scans this file for them.
 */

export type Env = {
	RESEND_API_KEY?: string;
};

type ContactValues = {
	name: string;
	email: string;
	subject: string;
	message: string;
};

// Submitted values get echoed back into HTML (both the notification email
// and the error alert), so they have to be escaped on the way out.
const escapeHtml = (value: string): string =>
	value.replace(
		/[&<>"']/g,
		(char) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[char] as string,
	);

// Same shape Elysia's t.String({ format: "email" }) enforced: roughly
// something@something.tld, no whitespace.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_SEND_ERROR =
	"That didn't send. Something went wrong on my end. Try again, or email contact@itzmaniss.dev directly.";

function validate(values: ContactValues): string | null {
	if (values.name.length < 2 || values.name.length > 100) {
		return "Please enter your name (2 to 100 characters).";
	}
	if (values.email.length > 100 || !EMAIL_PATTERN.test(values.email)) {
		return "Please enter a valid email address (100 characters max).";
	}
	if (values.subject.length < 2 || values.subject.length > 200) {
		return "Please enter a subject (2 to 200 characters).";
	}
	if (values.message.length < 1 || values.message.length > 2000) {
		return "Please enter a message (up to 2000 characters).";
	}
	return null;
}

/**
 * Failures swap into the form's #form-error slot instead of replacing the
 * form, so everything the visitor typed survives a failed submit. The
 * client script (script.js) puts the body of a non-ok response there.
 */
function errorResponse(status: number, message: string): Response {
	return new Response(
		`<div class="border border-red-800 bg-red-950/50 p-3 text-sm text-red-200" role="alert">${escapeHtml(message)}</div>`,
		{
			status,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		},
	);
}

// Success state, swapped in place of the form by the client script.
function successResponse(): Response {
	return new Response(
		`<div class="border border-line bg-ink-2 p-8 text-center" role="status">
        <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center border border-accent text-accent">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </div>
        <h3 class="text-lg font-semibold text-text">Message sent</h3>
        <p class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Thanks for reaching out. I'll reply within 24 hours, usually sooner.
        </p>
        <p class="mt-6 text-sm text-muted">
            <span class="text-accent">~/manish $</span> mail --sent
        </p>
      </div>`,
		{
			status: 200,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		},
	);
}

export async function onRequestPost({
	request,
	env,
}: {
	request: Request;
	env: Env;
}): Promise<Response> {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return errorResponse(400, "The form submission was malformed. Please try again.");
	}

	const read = (field: keyof ContactValues): string => {
		const value = form.get(field);
		return typeof value === "string" ? value : "";
	};

	const values: ContactValues = {
		name: read("name"),
		email: read("email"),
		subject: read("subject"),
		message: read("message"),
	};

	const validationError = validate(values);
	if (validationError) {
		return errorResponse(400, validationError);
	}

	const apiKey = env.RESEND_API_KEY;
	if (!apiKey) {
		console.error("RESEND_API_KEY is not set; cannot send contact email.");
		return errorResponse(500, GENERIC_SEND_ERROR);
	}

	try {
		const resendResponse = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				// Resend rejects API requests that arrive without a User-Agent.
				"User-Agent": "portfolio-contact-form (https://itzmaniss.dev)",
			},
			body: JSON.stringify({
				from: "Portfolio Contact <portfolio@itzmaniss.dev>",
				to: "contact@itzmaniss.dev",
				subject: `Portfolio Contact: ${values.subject}`,
				reply_to: values.email,
				html: `
          <h3>New contact form submission from your portfolio:</h3>
          <p><strong>Name:</strong> ${escapeHtml(values.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(values.email)}</p>
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(values.message).replace(/\n/g, "<br>")}</p>
        `,
			}),
		});

		if (!resendResponse.ok) {
			const detail = await resendResponse.text().catch(() => "");
			console.error(`Resend API error ${resendResponse.status}: ${detail}`);
			throw new Error(`Resend API error ${resendResponse.status}`);
		}
	} catch (error) {
		console.error("Error sending email:", error);
		return errorResponse(500, GENERIC_SEND_ERROR);
	}

	return successResponse();
}
