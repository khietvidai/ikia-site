import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	site: "https://ikia-site.khietvidai.workers.dev",
	output: "server",
	adapter: cloudflare(),
	build: {
		inlineStylesheets: "always",
	},
	image: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.workers.dev",
				pathname: "/_emdash/api/media/file/**",
			},
			{
				protocol: "http",
				hostname: "localhost",
				pathname: "/_emdash/api/media/file/**",
			},
		],
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto", coalesce: true }),
			storage: r2({ binding: "MEDIA" }),
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Montserrat",
			cssVariable: "--font-heading",
			weights: [700, 800],
			styles: ["normal"],
			subsets: ["latin", "vietnamese"],
			fallbacks: ["sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "Lato",
			cssVariable: "--font-body",
			weights: [400, 700],
			styles: ["normal"],
			subsets: ["latin"],
			fallbacks: ["sans-serif"],
		},
	],
	devToolbar: { enabled: false },
});
