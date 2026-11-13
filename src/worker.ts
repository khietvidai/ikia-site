import handler, {
	createScheduledHandler,
	PluginBridge,
} from "@emdash-cms/cloudflare/worker";

export { PluginBridge };

interface CachedMeta {
	contentType: string;
	cacheControl: string;
}

interface MemCacheEntry extends CachedMeta {
	expires: number;
	body: ArrayBuffer;
}

interface KvLike {
	getWithMetadata(
		key: string,
		type: "arrayBuffer",
	): Promise<{ value: ArrayBuffer | null; metadata: CachedMeta | null }>;
	put(
		key: string,
		value: ArrayBuffer,
		options?: { expirationTtl?: number; metadata?: CachedMeta },
	): Promise<void>;
}

const memCache = new Map<string, MemCacheEntry>();
const MAX_MEM_ENTRIES = 96;
const CACHE_GENERATION = "v5";

function setMemCache(key: string, entry: MemCacheEntry) {
	if (memCache.size >= MAX_MEM_ENTRIES) {
		const oldest = memCache.keys().next().value;
		if (oldest !== undefined) memCache.delete(oldest);
	}
	memCache.set(key, entry);
}

export default {
	...handler,
	async fetch(request, env, ctx) {
		if (request.method === "GET" && !request.headers.get("Upgrade")) {
			const url = new URL(request.url);
			const cookie = request.headers.get("Cookie") ?? "";
			const isAnonymousPublic =
				!url.pathname.startsWith("/_emdash") &&
				!url.pathname.startsWith("/_astro") &&
				!cookie.includes("session") &&
				!cookie.includes("auth") &&
				!cookie.includes("emdash");

			if (isAnonymousPublic) {
				const cacheKey = `pubcache:${CACHE_GENERATION}:${url.pathname}${url.search}`;
				const now = Date.now();
				const hit = memCache.get(cacheKey);
				if (hit && hit.expires > now) {
					return new Response(hit.body, {
						status: 200,
						headers: {
							"Content-Type": hit.contentType,
							"Cache-Control": hit.cacheControl,
							"X-Content-Type-Options": "nosniff",
						},
					});
				}

				const kv = (env as Record<string, unknown> | undefined)?.SESSION as
					| KvLike
					| undefined;
				if (kv && typeof kv.getWithMetadata === "function") {
					try {
						const kvHit = await kv.getWithMetadata(cacheKey, "arrayBuffer");
						if (kvHit.value && kvHit.metadata) {
							const isImg = kvHit.metadata.contentType.startsWith("image/");
							setMemCache(cacheKey, {
								expires: now + (isImg ? 3_600_000 : 90_000),
								contentType: kvHit.metadata.contentType,
								cacheControl: kvHit.metadata.cacheControl,
								body: kvHit.value,
							});
							return new Response(kvHit.value, {
								status: 200,
								headers: {
									"Content-Type": kvHit.metadata.contentType,
									"Cache-Control": kvHit.metadata.cacheControl,
									"X-Content-Type-Options": "nosniff",
								},
							});
						}
					} catch {}
				}

				if (!handler.fetch) {
					throw new Error("The Astro handler has no fetch");
				}
				const response = await handler.fetch(request, env, ctx);
				const contentType = response.headers.get("Content-Type") ?? "";
				if (
					response.status === 200 &&
					!response.headers.has("Set-Cookie") &&
					(contentType.includes("text/html") || contentType.startsWith("image/"))
				) {
					const isImage = contentType.startsWith("image/");
					const cacheControl = isImage
						? "public, max-age=31536000, immutable"
						: "public, max-age=0, must-revalidate";
					const body = await response.arrayBuffer();
					const ttlSeconds = isImage ? 86400 : 90;

					setMemCache(cacheKey, {
						expires: now + ttlSeconds * 1000,
						contentType,
						cacheControl,
						body,
					});

					if (kv && typeof kv.put === "function") {
						ctx.waitUntil(
							kv
								.put(cacheKey, body, {
									expirationTtl: ttlSeconds,
									metadata: { contentType, cacheControl },
								})
								.catch(() => undefined),
						);
					}

					const headers = new Headers(response.headers);
					headers.set("Cache-Control", cacheControl);
					return new Response(body, {
						status: 200,
						headers,
					});
				}
				return response;
			}
		}
		if (!handler.fetch) {
			throw new Error("The Astro handler has no fetch");
		}
		return handler.fetch(request, env, ctx);
	},
	scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
