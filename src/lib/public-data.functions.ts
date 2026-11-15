import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { withReviewerUsernames } from "@/lib/reviewer-usernames";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase configuration");
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const REVIEW_COLUMNS =
  "id, professor_id, subject_id, rating, difficulty, would_recommend, grade, tags, comment, like_count, dislike_count, created_at, subjects(name)";

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
    const { data: inst, error } = await sb
      .from("institutions")
      .select("id, name, location")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inst) return null;
    const { data: profs, error: pErr } = await sb
      .from("professors")
      .select("id, name, review_count, avg_rating, avg_difficulty, recommend_count, departments(name), subjects(name)")
      .eq("institution_id", data.id)
      .order("name");
    if (pErr) throw new Error(pErr.message);
    return { institution: inst, professors: profs ?? [] };
  });

export const getProfessor = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: prof, error } = await sb
      .from("professors")
      .select(
        "id, name, review_count, avg_rating, avg_difficulty, recommend_count, institutions(id, name, location), departments(name), subjects(id, name)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prof) return null;
    const { data: reviews, error: rErr } = await sb
      .from("reviews")
      .select(REVIEW_COLUMNS)
      .eq("professor_id", data.id)
      .order("created_at", { ascending: false })
      .limit(500);
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
