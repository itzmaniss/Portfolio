/**
 * Page content that repeats across components: nav links, service cards,
 * projects and the stack groups. Editing copy happens here, not in the
 * component markup.
 */

export type NavLink = { href: string; label: string };

export const navLinks: NavLink[] = [
	{ href: "#about", label: "about" },
	{ href: "#services", label: "services" },
	{ href: "#work", label: "work" },
	{ href: "#stack", label: "stack" },
];

export type Service = {
	prefix: string;
	title: string;
	description: string;
	items: string[];
};

export const services: Service[] = [
	{
		prefix: "api/",
		title: "APIs & backends",
		description:
			"REST and realtime services with authentication, a database that's modelled properly, and a deployment that survives contact with real traffic.",
		items: [
			"REST & WebSocket services",
			"Auth, sessions, permissions",
			"Schema design & migrations",
		],
	},
	{
		prefix: "automation/",
		title: "Bots & automation",
		description:
			"If you or your team does something by hand every week, it can almost always run itself instead. I build the thing that does it.",
		items: [
			"Discord & platform bots",
			"Scrapers & data extraction",
			"Scheduled jobs & pipelines",
		],
	},
	{
		prefix: "web/",
		title: "Web builds",
		description:
			"Landing pages through to full applications. Front to back, hosted, documented, and handed over so you're not dependent on me to change a heading.",
		items: [
			"Marketing & landing sites",
			"Full-stack applications",
			"Docker & deployment setup",
		],
	},
];

export type Project = {
	title: string;
	meta: string;
	href: string;
	description: string;
	tags: string[];
};

export const projects: Project[] = [
	{
		title: "MyRideSG",
		meta: "Founding engineer · React Native · 2026",
		href: "https://myridesg.com",
		description:
			"A bike ownership app for Singapore riders. Tracks servicing history, fuel logs and running costs, counts down COE, road tax and insurance renewals, and points you at trusted workshops when it is time to act. Records stay private by default and export whenever you want them. I'm the founding engineer, building it from the ground up.",
		tags: ["React Native", "React", "Astro"],
	},
	{
		title: "DebugDuck",
		meta: "TypeScript · 2026",
		href: "https://github.com/itzmaniss/DebugDuck",
		description:
			"A VS Code extension that teaches debugging instead of handing over the answer. Four escalating levels of hints, tracks which bug types you personally get stuck on, and warns you about them before you run the code.",
		tags: ["TypeScript", "VS Code API", "LLM"],
	},
	{
		title: "MIST-Bot",
		meta: "Python · 2026",
		href: "https://github.com/itzmaniss/MIST-Bot",
		description:
			"A Discord bot running Minecraft server controls, music playback and community games for a live server. The always-on kind that has to keep working when nobody is watching it.",
		tags: ["Python", "discord.py", "Docker"],
	},
	{
		title: "OHLCV-cleaner",
		meta: "Python · 2026",
		href: "https://github.com/itzmaniss/OHLCV-cleaner",
		description:
			"Turns raw Databento market data into analysis-ready parquet. Resolves symbology for equity ETFs, picks futures front months by volume crossover, and back-adjusts prices across contract expiries.",
		tags: ["Python", "Databento", "Parquet"],
	},
];

export type Skill = {
	label: string;
	/** File name in src/assets/devicons/ (from the devicon project). */
	icon?: string;
	invert?: boolean;
};

export type SkillGroup = { name: string; skills: Skill[] };

export const skillGroups: SkillGroup[] = [
	{
		name: "languages",
		skills: [
			{ label: "Python", icon: "python-original.svg" },
			{ label: "TypeScript", icon: "typescript-original.svg" },
			{ label: "JavaScript", icon: "javascript-original.svg" },
			{ label: "C++", icon: "cplusplus-original.svg" },
			{ label: "Go", icon: "go-original.svg" },
		],
	},
	{
		name: "frontend",
		skills: [
			{ label: "React", icon: "react-original.svg" },
			{ label: "Next.js", icon: "nextjs-original.svg", invert: true },
			{ label: "Vue", icon: "vuejs-original.svg" },
			{ label: "Nuxt", icon: "nuxtjs-original.svg" },
			{ label: "Astro", icon: "astro-original.svg", invert: true },
		],
	},
	{
		name: "backend",
		skills: [
			{ label: "FastAPI", icon: "fastapi-original.svg" },
			{ label: "Flask", icon: "flask-original.svg", invert: true },
			{ label: "Elysia.js" },
			{ label: "Node.js", icon: "nodejs-original.svg" },
			{ label: "Bun", icon: "bun-original.svg" },
		],
	},
	{
		name: "data & storage",
		skills: [
			{ label: "PostgreSQL", icon: "postgresql-original.svg" },
			{ label: "SQLite", icon: "sqlite-original.svg" },
			{ label: "MongoDB", icon: "mongodb-original.svg" },
			{ label: "Pandas", icon: "pandas-original.svg", invert: true },
			// devicon ships no polars icon; text-only chip,
			// same treatment as Elysia.js above.
			{ label: "Polars" },
			{ label: "Supabase", icon: "supabase-original.svg" },
			{ label: "Sanity", icon: "sanity-original.svg" },
		],
	},
	{
		name: "infrastructure",
		skills: [
			{ label: "Docker", icon: "docker-original.svg" },
			{ label: "Linux", icon: "linux-original.svg" },
			{ label: "Git", icon: "git-original.svg" },
			{ label: "Nginx", icon: "nginx-original.svg" },
		],
	},
];
