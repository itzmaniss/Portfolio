import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Static assets are served with `Cache-Control: max-age=86400`, and the
// filenames carry no content hash — so without this, a deploy leaves
// returning visitors on yesterday's CSS against today's HTML for a day.
// Stamping the URLs with the assets' mtime invalidates them per build
// while keeping the long cache lifetime for unchanged deploys.
//
// Read per request rather than cached at boot: `bun --watch` only tracks
// imported modules, not files pulled in through Bun.file at runtime, so
// caching here would stop index.html edits showing up in dev. The cost is
// one small file read per page view.
async function renderIndex(): Promise<string> {
  const version = Math.max(
    Bun.file("./public/styles.css").lastModified,
    Bun.file("./public/script.js").lastModified,
  ).toString(36);

  return (await Bun.file("./src/index.html").text())
    .replaceAll("/public/styles.css", `/public/styles.css?v=${version}`)
    .replaceAll("/public/script.js", `/public/script.js?v=${version}`);
}

// Submitted values get echoed back into HTML (both the notification email
// and the re-rendered form), so they have to be escaped on the way out.
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

type ContactValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

/**
 * Re-render the contact form with the visitor's input intact.
 *
 * The form is swapped with hx-swap="outerHTML", so a failed send must
 * hand back a complete, usable form — otherwise the visitor loses
 * everything they typed and the lead is gone.
 *
 * Note: this markup mirrors the form in src/index.html. If you restyle
 * one, restyle the other.
 */
function renderContactForm(values: ContactValues, errorMessage: string): string {
  const field = (
    id: keyof ContactValues,
    label: string,
    type = "text",
    attrs = "",
  ) => `
      <div>
        <label for="${id}" class="form-label">${label}</label>
        <input type="${type}" id="${id}" name="${id}" value="${escapeHtml(values[id])}" ${attrs} class="form-input" />
      </div>`;

  return `
    <form class="space-y-5 border border-line bg-ink-2 p-6 sm:p-8"
          hx-post="/api/contact" hx-swap="outerHTML" hx-indicator="#form-indicator">
      <div class="border border-red-800 bg-red-950/50 p-3 text-sm text-red-200" role="alert">
        ${escapeHtml(errorMessage)}
      </div>
      <div class="grid gap-5 sm:grid-cols-2">
        ${field("name", "Name", "text", 'required minlength="2" maxlength="100" autocomplete="name"')}
        ${field("email", "Email", "email", 'required maxlength="100" autocomplete="email"')}
      </div>
      ${field("subject", "Subject", "text", 'required minlength="2" maxlength="200"')}
      <div>
        <label for="message" class="form-label">What do you need built?</label>
        <textarea id="message" name="message" rows="5" required maxlength="2000"
                  class="form-input resize-none">${escapeHtml(values.message)}</textarea>
      </div>
      <button type="submit"
              class="group flex w-full items-center justify-center gap-2.5 bg-accent px-6 py-3.5 text-sm font-semibold text-ink transition-all duration-200 hover:bg-accent-bright">
        <span>Send message</span>
        <span class="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
        <span id="form-indicator" class="htmx-indicator">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </span>
      </button>
    </form>`;
}

const contactSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
  email: t.String({ format: "email", maxLength: 100 }),
  subject: t.String({ minLength: 2, maxLength: 200 }),
  message: t.String({ minLength: 1, maxLength: 2000 }),
});

const app = new Elysia()
  .use(
    staticPlugin({
      assets: "public",
    }),
  )
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

  .get(
    "/",
    async () =>
      new Response(await renderIndex(), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          // The HTML itself must never be cached, or the stamped asset
          // URLs inside it would go stale too.
          "Cache-Control": "no-cache",
        },
      }),
  )

  .post(
    "/api/contact",
    async ({ body, set }) => {
      console.log("Form submission received:", body);
      try {
        const { data, error } = await resend.emails.send({
          from: `Portfolio Contact <portfolio@itzmaniss.dev>`,
          to: "contact@itzmaniss.dev",
          subject: `Portfolio Contact: ${body.subject}`,
          replyTo: body.email,
          html: `
          <h3>New contact form submission from your portfolio:</h3>
          <p><strong>Name:</strong> ${escapeHtml(body.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(body.message).replace(/\n/g, "<br>")}</p>
        `,
        });

        if (error) {
          throw new Error(error.message);
        }

        // Success state, swapped in place of the form.
        return `<div class="border border-line bg-ink-2 p-8 text-center" role="status">
        <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center border border-accent text-accent">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </div>
        <h3 class="text-lg font-semibold text-text">Message sent</h3>
        <p class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Thanks for reaching out — I'll reply within 24 hours, usually sooner.
        </p>
        <p class="mt-6 text-sm text-muted">
            <span class="text-accent">~/manish $</span> mail --sent
        </p>
      </div>`;
      } catch (error) {
        console.error("Error sending email:", error);

        set.status = 500;

        // Hand back a working form with their input preserved, plus a way
        // to reach me that doesn't depend on this endpoint.
        return renderContactForm(
          body,
          "That didn't send — something went wrong on my end. Try again, or email contact@itzmaniss.dev directly.",
        );
      }
    },
    {
      body: contactSchema,
    },
  )

  .listen(process.env.PORT || 6969);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
