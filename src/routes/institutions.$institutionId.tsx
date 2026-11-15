import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RatingTile } from "@/components/rating";
import { institutionQuery } from "@/lib/queries";
import { ratingLabel } from "@/lib/review-rules";

export const Route = createFileRoute("/institutions/$institutionId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(institutionQuery(params.institutionId));
    if (!data) throw notFound();
    return { name: data.institution.name, location: data.institution.location };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `Professors at ${loaderData.name} — Faculty Reviews` : "College not found — Faculty Reviews";
    const description = loaderData
      ? `Ratings and anonymous student reviews for professors at ${loaderData.name}${loaderData.location ? `, ${loaderData.location}` : ""}.`
      : "This college or university could not be found.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">College not found</h1>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Back to search
      </Link>
    </div>
  ),
  component: InstitutionPage,
});

function InstitutionPage() {
  const { institutionId } = Route.useParams();
  const { data } = useSuspenseQuery(institutionQuery(institutionId));
  const [name, setName] = useState("");
  const professors = useMemo(() => {
    const list = data?.professors ?? [];
    const n = name.trim().toLowerCase();
    return n ? list.filter((p) => p.name.toLowerCase().includes(n)) : list;
  }, [data, name]);
  if (!data) return null;
  const { institution } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" search={{ q: undefined }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All colleges
      </Link>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{institution.name}</h1>
      {institution.location && (
        <p className="mt-1 flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-4" /> {institution.location}
        </p>
      )}

      <label className="relative mt-6 block">
        <span className="sr-only">Filter professors by name</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Search ${data.professors.length} professor${data.professors.length === 1 ? "" : "s"} by name…`}
          className="h-12 rounded-xl bg-card pl-11 shadow-soft"
        />
      </label>

      <ul className="mt-6 space-y-3">
        {professors.map((p) => {
          const dept = (p.departments as { name: string } | null)?.name;
          const subjects = (p.subjects as { name: string }[]) ?? [];
          const rec = p.review_count ? Math.round((p.recommend_count / p.review_count) * 100) : null;
          return (
            <li key={p.id}>
              <Link
                to="/professors/$professorId"
                params={{ professorId: p.id }}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift"
              >
                <RatingTile value={p.avg_rating} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold leading-snug">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{dept}</p>
                  {subjects.length > 0 && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {subjects.map((s) => s.name).join(" · ")}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {p.review_count
                      ? `${ratingLabel(Number(p.avg_rating))} · ${p.review_count} review${p.review_count === 1 ? "" : "s"}${rec !== null ? ` · ${rec}% would recommend` : ""}`
                      : "No reviews yet"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {professors.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {name ? "No professor matches that name." : "No professors have been added here yet."}
        </div>
      )}
    </div>
  );
}
