import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, MapPin, Search } from "lucide-react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { institutionsQuery } from "@/lib/queries";

const searchSchema = z.object({ q: z.string().max(100).optional().catch(undefined) });

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(institutionsQuery(deps.q)),
  head: () => ({
    meta: [
      { title: "ProfRate — Find professor reviews by college or university" },
      {
        name: "description",
        content: "Search your college or university, find your professors, and read honest, anonymous student ratings and reviews.",
      },
      { property: "og:title", content: "ProfRate — Find professor reviews by college or university" },
      { property: "og:description", content: "Search your college, find your professors, and read anonymous student reviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [text, setText] = useState(q ?? "");
  const { data: institutions } = useSuspenseQuery(institutionsQuery(q ?? ""));

  useEffect(() => {
    const t = setTimeout(() => {
      const next = text.trim() || undefined;
      if (next !== q) navigate({ search: { q: next }, replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [text, q, navigate]);

  return (
    <>
      <section className="bg-paper border-b border-border">
        <div className="mx-auto max-w-3xl px-4 pb-12 pt-14 text-center sm:pt-20">
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Know your professor <em className="text-primary">before</em> the first class.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Honest, anonymous reviews from students. Start with your college or university.
          </p>
          <label className="relative mx-auto mt-8 block max-w-xl">
            <span className="sr-only">Search colleges and universities</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search your college or university…"
              className="h-14 rounded-2xl border-border bg-card pl-12 text-base shadow-lift"
            />
          </label>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="mb-4 font-sans text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {q ? `Results for “${q}”` : "Colleges & universities"}
        </h2>
        {institutions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {q ? "No college or university matches that search yet." : "No colleges or universities have been added yet."}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {institutions.map((inst) => (
              <li key={inst.id}>
                <Link
                  to="/institutions/$institutionId"
                  params={{ institutionId: inst.id }}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Building2 className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{inst.name}</span>
                    <span className="flex items-center gap-3 text-sm text-muted-foreground">
                      {inst.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="size-3.5" /> {inst.location}
                        </span>
                      )}
                      <span>
                        {inst.professorCount} professor{inst.professorCount === 1 ? "" : "s"}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
