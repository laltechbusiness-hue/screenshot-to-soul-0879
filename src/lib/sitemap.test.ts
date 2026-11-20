import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ publicClient: vi.fn() }));
vi.mock("./public-data.functions", () => mocks);
import { sitemapResponse, SITEMAP_PAGE_SIZE } from "./sitemap.server";
import { Route } from "@/routes/sitemap[.]xml";

describe("XML sitemap endpoint", () => {
  const query = {
    select: vi.fn(), order: vi.fn(), limit: vi.fn(), range: vi.fn(),
  };
  const from = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    for (const method of [query.select, query.order, query.limit]) method.mockReturnValue(query);
    from.mockReturnValue(query);
    mocks.publicClient.mockReturnValue({ from });
  });
  afterEach(() => vi.restoreAllMocks());

  it("registers a GET handler returning valid XML with exact public paths and review timestamps", async () => {
    query.range.mockResolvedValue({ data: [
      { id: "reviewed-professor", reviews: [{ created_at: "2026-11-19T10:30:00+00:00" }] },
      { id: "empty-professor", reviews: [] },
    ], error: null });
    const handler = Route.options.server?.handlers;
    expect(handler).toHaveProperty("GET");
    // Exercise the registered route handler, rather than just the serializer.
    const response = await (handler as { GET: () => Promise<Response> }).GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(xml.documentElement.namespaceURI).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
    expect(Array.from(xml.querySelectorAll("loc"), (node) => node.textContent)).toEqual([
      "https://facultyreviews.online/", "https://facultyreviews.online/about",
      "https://facultyreviews.online/privacy", "https://facultyreviews.online/terms",
      "https://facultyreviews.online/professors/reviewed-professor",
    ]);
    expect(xml.querySelector("lastmod")?.textContent).toBe("2026-11-19T10:30:00.000Z");
    expect(from).toHaveBeenCalledWith("professors");
    expect(query.select).toHaveBeenCalledWith("id, reviews!inner(created_at)");
    expect(query.order).toHaveBeenCalledWith("created_at", { referencedTable: "reviews", ascending: false });
    expect(query.limit).toHaveBeenCalledWith(1, { referencedTable: "reviews" });
  });

  it("paginates beyond Supabase's default row limit without truncating the sitemap", async () => {
    const page = Array.from({ length: SITEMAP_PAGE_SIZE }, (_, index) => ({
      id: `professor-${index}`, reviews: [{ created_at: "2026-11-19T00:00:00Z" }],
    }));
    query.range.mockResolvedValueOnce({ data: page, error: null })
      .mockResolvedValueOnce({ data: [{ id: "last-professor", reviews: page[0]!.reviews }], error: null });
    const response = await sitemapResponse();
    expect(await response.text()).toContain("/professors/last-professor");
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });

  it("returns the static pages when no professors have reviews", async () => {
    query.range.mockResolvedValue({ data: [], error: null });
    const response = await sitemapResponse();
    const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
    expect(xml.querySelectorAll("url")).toHaveLength(4);
    expect(xml.querySelectorAll("lastmod")).toHaveLength(0);
  });

  it("returns an uncached failure instead of a misleading partial sitemap", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    query.range.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    const response = await sitemapResponse();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
