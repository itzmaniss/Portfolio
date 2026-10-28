# Manish's Portfolio Website

A terminal-inspired single-page developer portfolio. The page is built with
Astro as a plain static site, styled with Tailwind CSS v4, and enhanced with
a small vanilla JS script. Fonts and skill icons are self-hosted. The contact
form runs as a Cloudflare Pages Function that sends email through the Resend
API. The same built site is also self-hostable behind a small Bun server as
a Docker backup.

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
- `functions/api/contact.ts` is a Cloudflare Pages Function that validates
  the form and sends mail via the Resend REST API
- `public/_headers` sets cache and security headers; Cloudflare Pages reads
  it verbatim and `server.ts` applies the same rules, so both deploys match
- `server.ts` is a small Bun server for self-hosting: it serves `dist/` and
  routes `POST /api/contact` through the same function, so both deploys
  share one handler

## Project structure

```
.
├── functions/
│   └── api/contact.ts     # POST /api/contact (Pages Function, shared with server.ts)
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
bun run preview                  # builds, then wrangler pages dev dist
```

`wrangler pages dev` serves `dist/` plus the function together on
http://localhost:8788 and reads `.dev.vars`. Use a fake key if you only want
to see the error path; a rejected key shows the failure alert instead of
sending anything.

## Deploying

### Cloudflare Pages (primary)

Connect the repo to a Pages project, or deploy with `wrangler`:

- Build command: `bun run build`
- Build output directory: `dist`
- `functions/` is picked up automatically; `POST /api/contact` just works
- Set `RESEND_API_KEY` as an encrypted environment variable in the Pages
  project settings (Production and Preview)

`bun run deploy` runs `wrangler pages deploy dist` if you deploy from the
CLI instead of Git integration.

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
