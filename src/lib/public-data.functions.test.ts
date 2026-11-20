import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
// Run the real validator and handler without an HTTP server.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (data: unknown) => unknown) => ({
      handler:
        (handler: (context: { data: unknown }) => unknown) =>
        ({ data }: { data: unknown }) =>
          handler({ data: validate(data) }),
    }),
  }),
}));

import { FACULTY_PAGE_SIZE, searchProfessors, getReviewedProfessorCount } from "./public-data.functions";

const institutionId = "00000000-0000-4000-8000-000000000001";
const departmentId = "00000000-0000-4000-8000-000000000002";

describe("Faculty database search", () => {
  afterEach(() => vi.unstubAllEnvs());
  let query: Record<"select" | "eq" | "ilike" | "order" | "range", ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-key");
    query = { select: vi.fn(), eq: vi.fn(), ilike: vi.fn(), order: vi.fn(), range: vi.fn() };
    for (const method of Object.values(query)) method.mockReturnValue(query);
    createClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
  });

  it("fetches a bounded page beyond the first 1,000 rows with a stable sort and full count", async () => {
    query.range.mockResolvedValue({ data: [{ id: "faculty-1041" }], count: 2032, error: null });
    const result = await searchProfessors({ data: { id: institutionId, page: 26 } });
    expect(query.eq).toHaveBeenCalledWith("institution_id", institutionId);
    expect(query.range).toHaveBeenCalledWith(1040, 1079);
    expect(query.order.mock.calls).toEqual([["name"], ["id"]]);
    expect(result.count).toBe(2032);
    expect(result.professors).toEqual([{ id: "faculty-1041" }]);
    expect(FACULTY_PAGE_SIZE).toBe(40);
  });

  it("counts distinct reviewed professor profiles without downloading reviews", async () => {
    query.select.mockResolvedValue({ count: 57, error: null });
    expect(await getReviewedProfessorCount({ data: {} })).toBe(57);
    expect(query.select).toHaveBeenCalledWith("id, reviews!inner(id)", { count: "exact", head: true });
  });

  it("does not report a database failure as zero reviewed professors", async () => {
    query.select.mockResolvedValue({ count: null, error: { message: "Unavailable" } });
    await expect(getReviewedProfessorCount({ data: {} })).rejects.toThrow("Unavailable");
  });

  it("applies name and department restrictions in the database before pagination", async () => {
    query.range.mockResolvedValue({ data: [{ id: "previously-missing" }], count: 1, error: null });
    await searchProfessors({ data: { id: institutionId, q: "  Zafar  ", departmentId } });
    expect(query.ilike).toHaveBeenCalledWith("name", "%Zafar%");
    expect(query.eq).toHaveBeenCalledWith("department_id", departmentId);
    expect(query.range).toHaveBeenCalledWith(0, 39);
    expect(query.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
  });

  it("escapes literal search wildcards", async () => {
    query.range.mockResolvedValue({ data: [], count: 0, error: null });
    await searchProfessors({ data: { id: institutionId, q: "A_%" } });
    expect(query.ilike).toHaveBeenCalledWith("name", "%A\\_\\%%");
  });

  it("propagates database failures instead of reporting an empty result", async () => {
    query.range.mockResolvedValue({ data: null, count: null, error: { message: "Unavailable" } });
    await expect(searchProfessors({ data: { id: institutionId } })).rejects.toThrow("Unavailable");
  });

  it("rejects invalid page numbers and department IDs", async () => {
    await expect(async () =>
      searchProfessors({ data: { id: institutionId, page: -1 } }),
    ).rejects.toThrow();
    await expect(async () =>
      searchProfessors({ data: { id: institutionId, departmentId: "invalid" } }),
    ).rejects.toThrow();
  });
});
