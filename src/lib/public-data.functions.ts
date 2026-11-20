import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { withReviewerUsernames } from "@/lib/reviewer-usernames";
import type { Database } from "@/integrations/supabase/types";

export function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase configuration");
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const REVIEW_COLUMNS =
  "id, professor_id, subject_name, rating, difficulty, would_recommend, grade, tags, comment, like_count, dislike_count, created_at";

export const searchInstitutions = createServerFn({ method: "GET" })
  .inputValidator((d: { q?: string }) => z.object({ q: z.string().max(100).optional() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    let query = sb
      .from("institutions")
      .select("id, name, location, professors(count)")
      .order("name")
      .limit(50);
    const q = data.q?.trim();
    if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location,
      professorCount: (r.professors as unknown as { count: number }[])?.[0]?.count ?? 0,
    }));
  });

export const getInstitution = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const [institutionResult, departmentsResult] = await Promise.all([
      sb
        .from("institutions")
        .select("id, name, location, professors(count)")
        .eq("id", data.id)
        .maybeSingle(),
      sb.from("departments").select("id, name").eq("institution_id", data.id).order("name"),
    ]);
    const { data: inst, error } = institutionResult;
    if (error) throw new Error(error.message);
    if (!inst) return null;
    const { data: departments, error: dErr } = departmentsResult;
    if (dErr) throw new Error(dErr.message);
    return {
      institution: { id: inst.id, name: inst.name, location: inst.location },
      professorCount: inst.professors[0]?.count ?? 0,
      departments: departments ?? [],
    };
  });

export const FACULTY_PAGE_SIZE = 40;

export const searchProfessors = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string; q?: string; departmentId?: string; page?: number }) =>
    z
      .object({
        id: z.string().uuid(),
        q: z.string().trim().max(200).default(""),
        departmentId: z.string().uuid().optional(),
        page: z.number().int().min(0).max(1_000_000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    let query = sb
      .from("professors")
      .select(
        "id, name, review_count, avg_rating, avg_difficulty, recommend_count, departments(name)",
        { count: "exact" },
      )
      .eq("institution_id", data.id);
    // Treat wildcard characters as literal name characters, matching the old includes search.
    if (data.q) query = query.ilike("name", `%${data.q.replace(/[\\%_]/g, "\\$&")}%`);
    if (data.departmentId) query = query.eq("department_id", data.departmentId);
    const {
      data: professors,
      count,
      error,
    } = await query
      .order("name")
      .order("id")
      .range(data.page * FACULTY_PAGE_SIZE, (data.page + 1) * FACULTY_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    return { professors: professors ?? [], count: count ?? 0 };
  });

export const getProfessor = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const [profResult, reviewResult] = await Promise.all([
      sb
        .from("professors")
        .select(
          "id, name, review_count, avg_rating, avg_difficulty, recommend_count, institutions(id, name, location), departments(name)",
        )
        .eq("id", data.id)
        .maybeSingle(),
      sb
        .from("reviews")
        .select(REVIEW_COLUMNS)
        .eq("professor_id", data.id)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const { data: prof, error } = profResult;
    if (error) throw new Error(error.message);
    if (!prof) return null;
    const { data: reviews, error: rErr } = reviewResult;
    if (rErr) throw new Error(rErr.message);
    const rows = reviews ?? [];
    const usernames = new Map<string, string>();
    if (rows.length) {
      const { data: names, error } = await withReviewerUsernames(sb).rpc("review_usernames", {
        _review_ids: rows.map((review) => review.id),
      });
      if (error && error.code !== "PGRST202") throw new Error(error.message);
      for (const name of names ?? []) usernames.set(name.review_id, name.username);
    }
    return {
      professor: prof,
      reviews: rows.map((review) => ({ ...review, username: usernames.get(review.id) ?? null })),
    };
  });
