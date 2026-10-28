// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Plain static output, no adapter: hosting is Cloudflare Pages (dist/ plus
// the functions/ directory), with the Bun server at server.ts serving the
// same dist/ for the self-hosted Docker deploy.
//
// URLs are directory-style (/work/myridesg/), which is what Pages serves
// 200 without a redirect, so canonical tags are generated in that same
// trailing-slash form. build.format "directory" is the default but is set
// explicitly because the canonical scheme depends on it.
export default defineConfig({
	site: "https://itzmaniss.dev",
	trailingSlash: "always",
	build: {
		format: "directory",
	},
	integrations: [sitemap()],
	markdown: {
		shikiConfig: {
			// Dark token colors that read on the site's ink background; the
			// block chrome itself is themed in global.css.
			theme: "github-dark",
		},
	},
	vite: {
		plugins: [tailwindcss()],
	},
});
