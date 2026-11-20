import { publicClient } from "./public-data.functions";

const ORIGIN = "https://facultyreviews.online";
export const SITEMAP_PAGE_SIZE = 500;
const STATIC_PATHS = ["/", "/about", "/privacy", "/terms"];

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

export async function sitemapResponse(): Promise<Response> {
  try {
    const sb = publicClient();
    const urls = STATIC_PATHS.map((path) => `<url><loc>${ORIGIN}${path}</loc></url>`);
    // An inner join excludes profiles without public reviews, even if a cached
    // review_count is stale. Bound both parent pages and embedded review rows.
    for (let offset = 0; ; offset += SITEMAP_PAGE_SIZE) {
      const { data, error } = await sb
        .from("professors")
        .select("id, reviews!inner(created_at)")
        .order("id")
        .order("created_at", { referencedTable: "reviews", ascending: false })
        .limit(1, { referencedTable: "reviews" })
        .range(offset, offset + SITEMAP_PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Missing sitemap query results");
      for (const professor of data) {
        const latest = professor.reviews[0];
        if (!latest) continue;
        const lastModified = new Date(latest.created_at).toISOString();
        const location = `${ORIGIN}/professors/${encodeURIComponent(professor.id)}`;
        urls.push(`<url><loc>${escapeXml(location)}</loc><lastmod>${lastModified}</lastmod></url>`);
      }
      if (data.length < SITEMAP_PAGE_SIZE) break;
    }
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`,
      {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=300",
        },
      },
    );
  } catch (error) {
    console.error("Sitemap generation failed", error);
    // Never publish a partial sitemap or cache a database outage as success.
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
