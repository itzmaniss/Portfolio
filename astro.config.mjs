// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Plain static output, no adapter: hosting is Cloudflare Pages (dist/ plus
// the functions/ directory), with the Bun server at server.ts serving the
// same dist/ for the self-hosted Docker deploy.
export default defineConfig({
	site: "https://itzmaniss.dev",
	vite: {
		plugins: [tailwindcss()],
	},
});
