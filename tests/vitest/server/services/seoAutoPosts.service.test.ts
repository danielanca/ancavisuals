// @vitest-environment node
/*
 * Purpose: automatic SEO articles for the "Absent" keywords — which keywords get one, that the
 * article is published + sitemapped + linked in SEO Radar, invented internal links are dropped,
 * and that runs are weekly and one at a time.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const store: Record<string, Record<string, any>> = {};
const create = vi.fn();
const saveBlogPost = vi.fn(async (post: any) => ({ ...post, source: "firestore", updatedAt: null }));
const slugExists = vi.fn(async (slug: string) => slug === "fotograf-nunta-turda");
const addSitemapEntry = vi.fn();
const generateSitemapFromDb = vi.fn();
const syncLlmsTxtWithPost = vi.fn();

function query(name: string) {
  const docs = () => Object.entries(store[name] ?? {}).map(([id, data]) => ({ id, data: () => data, ref: { delete: async () => { delete store[name][id]; } } }));
  const api: any = {
    select: () => api,
    orderBy: () => ({ limit: () => ({ get: async () => ({ docs: docs().sort((a, b) => String(b.data().capturedAt).localeCompare(String(a.data().capturedAt))) }) }) }),
    where: (field: string, _op: string, value: unknown) => ({ get: async () => ({ docs: docs().filter((doc) => doc.data()[field] === value) }) }),
    get: async () => ({ docs: docs() }),
    doc: (id: string) => ({
      get: async () => ({ exists: Boolean(store[name]?.[id]), data: () => store[name]?.[id] }),
      set: async (value: any, options?: { merge?: boolean }) => { store[name] ??= {}; store[name][id] = options?.merge ? { ...store[name][id], ...value } : value; },
    }),
  };
  return api;
}

vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: query,
    runTransaction: async (fn: any) => fn({
      get: async (ref: any) => ref.get(),
      set: (ref: any, value: any, options: any) => ref.set(value, options),
    }),
  }),
}));
vi.mock("src/server/lib/anthropicClient", () => ({ createAnthropicClient: () => ({ messages: { create } }) }));
vi.mock("src/server/utils/blogUtils", () => ({ saveBlogPost, slugExists }));
vi.mock("src/server/utils/sitemapGenerator", () => ({
  addSitemapEntry, generateSitemapFromDb,
  getSitemapEntries: async () => ["/", "/contact", "/foto-video-nunta", "/foto-video-nunta-turda", "/fotograf-nunta-cluj"].map((path) => ({ loc: `https://www.ancavisuals.ro${path}` })),
}));
vi.mock("src/server/utils/llmsTxtGenerator", () => ({ syncLlmsTxtWithPost }));

const service = await import("src/server/services/seoAutoPosts.service");
const article = (extra: Record<string, unknown> = {}) => ({
  content: [{ type: "text", text: JSON.stringify({
    title: "Fotograf nuntă Turda: cum alegi", slug: "fotograf-nunta-turda", description: "Ghid", category: "nunta", tags: ["turda"],
    content: `${"Text util despre nunta în Turda. ".repeat(60)}\n\nVezi [pagina din Turda](/foto-video-nunta-turda), [oferta inventată](/oferta-inventata) și [Google](https://google.com).`,
    ...extra,
  }) }],
  stop_reason: "end_turn",
});

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test";
  store.seoRadarSearches = {
    a: { queryKey: "serpapi::fotograf nunta turda::turda", keyword: "fotograf nunta Turda", city: "Turda", provider: "serpapi", capturedAt: "2026-10-27T10:00:00Z", ownDomainPosition: null },
    b: { queryKey: "serpapi::fotograf nunta turda::turda", keyword: "fotograf nuntă turda", city: "Turda", provider: "serpapi", capturedAt: "2026-10-01T10:00:00Z", ownDomainPosition: 4 },
    c: { queryKey: "serpapi::videograf cluj::cluj", keyword: "videograf Cluj", city: "Cluj", provider: "serpapi", capturedAt: "2026-10-26T10:00:00Z", ownDomainPosition: 7 },
    d: { queryKey: "serpapi::fotocabina dej::dej", keyword: "fotocabina Dej", city: "Dej", provider: "serpapi", capturedAt: "2026-10-25T10:00:00Z", ownDomainPosition: null },
    e: { queryKey: "serpapi::cameraman sibiu::sibiu", keyword: "cameraman Sibiu", city: "Sibiu", provider: "serpapi", capturedAt: "2026-10-24T10:00:00Z", ownDomainPosition: null },
  };
  store.seoRadarLinkedPosts = { x: { keyword: "Cameraman sibiu" } };
  create.mockResolvedValue(article());
});

describe("seo auto posts", () => {
  test("absent = latest scan outside the top 10 and no article linked; newest scans first", async () => {
    expect((await service.findAbsentKeywords()).map((k) => k.keyword)).toEqual(["fotograf nunta Turda", "fotocabina Dej"]);
  });

  test("drops links to pages that don't exist on the site, keeps real and external ones", () => {
    expect(service.keepOnlyKnownLinks("[a](/contact) [b](/nu-exista) [c](https://www.ancavisuals.ro/contact) [d](https://google.com)", ["/contact"]))
      .toBe("[a](/contact) b [c](/contact) [d](https://google.com)");
  });

  test("a run publishes up to 2 articles: blog + sitemap + llms.txt + linked in SEO Radar", async () => {
    const { results } = await service.runSeoAutoPosts("test");
    expect(results.map((r) => r.status)).toEqual(["published", "published"]);
    expect(saveBlogPost).toHaveBeenCalledTimes(2);
    const post = saveBlogPost.mock.calls[0][0];
    expect(post).toMatchObject({ slug: "fotograf-nunta-turda-2", status: "published", city: "Turda" });
    expect(post.content).toContain("[pagina din Turda](/foto-video-nunta-turda)");
    expect(post.content).not.toContain("/oferta-inventata");
    expect(addSitemapEntry).toHaveBeenCalledWith(expect.objectContaining({ loc: "https://www.ancavisuals.ro/blog/fotograf-nunta-turda-2" }));
    expect(generateSitemapFromDb).toHaveBeenCalled();
    expect(syncLlmsTxtWithPost).toHaveBeenCalled();
    expect(store.seoRadarLinkedPosts["serpapi::fotograf nunta turda::turda::fotograf-nunta-turda-2"]).toMatchObject({ keyword: "fotograf nunta Turda", createdBy: "seo-auto-posts" });
    expect(await service.findAbsentKeywords()).toEqual([]);
    const prompt = create.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("/foto-video-nunta-turda");
    expect(prompt).not.toContain("/fotograf-nunta-cluj");
  });

  test("a failed article is recorded and not retried automatically", async () => {
    create.mockResolvedValueOnce(article({ content: "prea scurt" }));
    const { results } = await service.runSeoAutoPosts("test", 1);
    expect(results[0]).toMatchObject({ keyword: "fotograf nunta Turda", status: "failed" });
    expect(saveBlogPost).not.toHaveBeenCalled();
    expect((await service.findAbsentKeywords()).map((k) => k.keyword)).toEqual(["fotocabina Dej"]);
    await service.forgetFailedSeoAutoPost("fotograf nunta Turda");
    expect((await service.findAbsentKeywords()).map((k) => k.keyword)).toContain("fotograf nunta Turda");
  });

  test("runs at most weekly, and never two at once", async () => {
    await service.runSeoAutoPostsIfDue("după deploy");
    expect(saveBlogPost).toHaveBeenCalledTimes(2);
    store.seoRadarSearches.f = { queryKey: "serpapi::foto botez dej::dej", keyword: "foto botez Dej", city: "Dej", provider: "serpapi", capturedAt: "2026-10-28T10:00:00Z", ownDomainPosition: null };
    await service.runSeoAutoPostsIfDue("după deploy");
    expect(saveBlogPost).toHaveBeenCalledTimes(2);

    store.settings.seoAutoPosts.leaseUntil = Date.now() + 60_000;
    expect(await service.runSeoAutoPosts("buton")).toMatchObject({ results: [], skipped: expect.stringContaining("deja") });
  });
});
