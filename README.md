# Manish's Portfolio Website

A terminal-inspired single-page developer portfolio. The page is built with
Astro as a plain static site, styled with Tailwind CSS v4, and enhanced with
a small vanilla JS script. Fonts and skill icons are self-hosted. The contact
form runs in a Cloudflare Worker that sends email through the Resend API. The
same built site is also self-hostable behind a small Bun server as a Docker
backup.

## Stack

- Astro (static output, no adapter) builds the page into `dist/`
- Tailwind CSS v4 via `@tailwindcss/vite`; theme tokens live in
  `src/styles/global.css`
- IBM Plex Mono self-hosted via `@fontsource/ibm-plex-mono` (latin subset),
  preloaded in `src/layouts/Base.astro`
- Skill icons vendored into `src/assets/devicons/` from the
  [devicon](https://github.com/devicons/devicon) project
- Vanilla JS (`src/scripts/script.js`) handles the contact form fetch,
  mobile menu, scroll reveal, scroll spy and the statusline
- `functions/api/contact.ts` validates the form and sends mail via the
  Resend REST API. It is plain fetch/Request code, shared by the Cloudflare
  Worker and the Bun server
- `worker/index.ts` is the Cloudflare Worker entry: it routes
  `POST /api/contact` to the shared handler and serves everything else from
  static assets. `wrangler.jsonc` configures the deploy
- `public/_headers` sets cache and security headers; Cloudflare's asset
  server applies it and `server.ts` applies the same rules, so all deploys
  match
- `server.ts` is a small Bun server for self-hosting: it serves `dist/` and
  routes `POST /api/contact` through the same function, so both deploys
  share one handler

## Project structure

```
.
├── functions/
│   └── api/contact.ts     # POST /api/contact handler, shared by worker/ and server.ts
├── worker/
│   └── index.ts           # Cloudflare Worker entry (assets + /api/contact routing)
├── wrangler.jsonc         # Cloudflare Workers deploy config
├── public/                # copied verbatim into dist/ (favicons, _headers)
├── src/
│   ├── assets/devicons/   # vendored skill icons, resolved by SkillChip
│   ├── components/        # Header, Hero, About, Services, Work, Stack, Contact, ...
│   ├── data/site.ts       # nav links, services, projects, skill chips
│   ├── layouts/Base.astro # head, meta, font imports, bundled script
│   ├── pages/index.astro  # the page, assembled from components
│   ├── scripts/script.js  # mobile menu, scroll reveal, scroll spy, statusline, form
│   └── styles/global.css  # Tailwind source: @theme tokens + custom CSS
├── server.ts              # Bun server for the self-hosted Docker deploy
├── astro.config.mjs
└── Dockerfile
```

## Development

Requires Bun.

```bash
bun install
bun run dev        # astro dev, http://localhost:4321
bun run build      # astro build, outputs dist/
bun run check      # astro check (type-checks .astro and .ts, including functions/)
```

`src/styles/global.css` is the stylesheet you edit. There is no separate CSS
build step; Tailwind v4 runs inside the Astro build and only generates the
utilities actually used. Class lists in `functions/api/contact.ts` are
scanned too, since the endpoint returns HTML fragments.

### Contact form locally

The form endpoint needs a Resend API key. For the Cloudflare-style local
preview:

```bash
cp .dev.vars.example .dev.vars   # then put a key in it
bun run preview                  # builds, then wrangler dev
```

`wrangler dev` serves the dist/ assets plus the Worker together on
http://localhost:8788 and reads `.dev.vars`. Use a fake key if you only want
to see the error path; a rejected key shows the failure alert instead of
sending anything.

## Deploying

### Cloudflare Workers (primary)

The site deploys as a Worker with static assets. `wrangler.jsonc` at the
repo root already describes the whole thing: the Worker script
(`worker/index.ts`), the `dist/` assets with an `ASSETS` binding, and
`run_worker_first` for `/api/*` so the contact endpoint hits the Worker
while every page URL is served straight from assets. The Worker name is
`portfolio` and it must stay that way, because that is the name of the
project in the Cloudflare dashboard.

Connect the repo in the Cloudflare dashboard under Workers Builds:

- Build command: `bun run build`
- Deploy command: `npx wrangler deploy` (the dashboard default; `bunx
  wrangler deploy` works too)
- Because `wrangler.jsonc` exists, wrangler deploys exactly what the file
  describes and never runs its framework auto-config

After the first deploy, set the secret in the Worker's Settings, then
Variables and Secrets: `RESEND_API_KEY`, type Secret, with a real Resend
key. From a terminal, `bunx wrangler secret put RESEND_API_KEY` does the
same thing. Without it the contact form answers 500 on every submit.

The old Pages project (if it still exists) can be deleted once the Worker
is live on the domain; keep the custom domain attached to the Worker.

### Docker (self-hosted backup)

```bash
docker build -t portfolio .
docker run -d --name portfolio -p 6969:6969 -e RESEND_API_KEY=re_xxx portfolio
```

The image builds the site, then runs `server.ts`, which serves `dist/` and
the contact endpoint on port 6969 (override with `PORT`). The existing
health check polls `/health`. Outside Docker, `bun run start` runs the same
server.

## Editing content

- Nav links, service cards, projects and stack chips are data arrays in
  `src/data/site.ts`; the components map over them.
- Colors, fonts and custom animations are tokens in the `@theme` block of
  `src/styles/global.css`. Changing `--color-accent` re-colors the site.
- The contact form markup is `src/components/ContactForm.astro`. Its error
  slot (`#form-error`) is where script.js puts the endpoint's failure
  fragment, so a failed send keeps everything the visitor typed.

## Credits

- Design by [0xshuul](https://www.rakshi.xyz)
- Icons by [Devicon](https://devicon.dev/)

## Contact

- GitHub: [itzmaniss](https://github.com/itzmaniss)
- LinkedIn: [itzmaniss](https://linkedin.com/in/itzmaniss)
- Email: [contact@itzmaniss.dev](mailto:contact@itzmaniss.dev)
