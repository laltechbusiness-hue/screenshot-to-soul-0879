import { describe, expect, it } from "vitest";
import { Route } from "@/routes/professors.$professorId";

describe("Professor indexing metadata", () => {
  const head = Route.options.head!;

  it.each([
    [false, "noindex, follow"],
    [true, "index, follow"],
  ])("sets robots after loading reviews (hasReviews: %s)", async (hasReviews, content) => {
    const result = await head({
      loaderData: { name: "Test Professor", institution: "Test", avg: 4, count: 1, hasReviews },
    } as Parameters<typeof head>[0]);

    // The loaded review list controls indexing, even if a stored aggregate disagrees.
    expect(result?.meta?.filter((meta) => meta && "name" in meta && meta.name === "robots"))
      .toEqual([{ name: "robots", content }]);
  });

  it("keeps missing profiles out of search results", async () => {
    const result = await head({ loaderData: undefined } as unknown as Parameters<typeof head>[0]);
    expect(result?.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
  });
});
