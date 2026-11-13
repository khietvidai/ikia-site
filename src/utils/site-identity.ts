/** Resolved media reference from getSiteSettings() */
export interface MediaReference {
	mediaId: string;
	alt?: string;
	url?: string;
}

export interface BlogSiteIdentitySettings {
	title?: string;
	tagline?: string;
	logo?: MediaReference;
	favicon?: MediaReference;
}

const DEFAULT_SITE_TITLE = "Structure Construction";
const DEFAULT_SITE_TAGLINE = "Leading in Building & Civil Construction";

export const STRUCTURE_CONTACT = {
	phone: "1-775-97-377",
	phoneHref: "tel:+177597377",
	secondaryPhone: "(102) 6666 8888",
	email: "contact@structure-demo.com",
	emailHref: "mailto:contact@structure-demo.com",
	hours: "Mon - Sat: 8:00 - 18:00",
	address: "14 Tottenham Road, N1 4EP, London",
	license: "ISO 9001:2015 · Lic #GC-884920",
} as const;

export function resolveBlogSiteIdentity(settings?: BlogSiteIdentitySettings) {
	return {
		siteTitle: settings?.title || DEFAULT_SITE_TITLE,
		siteTagline: settings?.tagline || DEFAULT_SITE_TAGLINE,
		siteLogo: settings?.logo?.url ? settings.logo : null,
	};
}

export function getMediaUrl(
	img: unknown,
	origin: string,
): string | undefined {
	if (!img || typeof img !== "object") return undefined;
	const image = img as Record<string, unknown>;
	if (typeof image.src === "string" && image.src) {
		return image.src.startsWith("http") ? image.src : `${origin}${image.src}`;
	}
	const meta = image.meta as Record<string, unknown> | undefined;
	const storageKey =
		(typeof meta?.storageKey === "string" ? meta.storageKey : undefined) ||
		(typeof image.id === "string" ? image.id : undefined);
	if (storageKey) {
		return `${origin}/_emdash/api/media/file/${storageKey}`;
	}
	return undefined;
}
