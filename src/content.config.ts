import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Markdown case studies. The glob loader generates each entry id from the
// file name, so myridesg.md becomes /work/myridesg/.
const caseStudies = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/case-studies" }),
	schema: z.object({
		title: z.string(),
		description: z.string().max(160),
		project: z.string(),
		role: z.string(),
		stack: z.array(z.string()),
		publishedAt: z.coerce.date(),
		updatedAt: z.coerce.date().optional(),
		repo: z.url().optional(),
		live: z.url().optional(),
		draft: z.boolean().default(false),
	}),
});

export const collections = { caseStudies };
