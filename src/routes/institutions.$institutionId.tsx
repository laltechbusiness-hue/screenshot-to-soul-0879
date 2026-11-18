import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RatingTile } from "@/components/rating";
import { facultyQuery, institutionQuery } from "@/lib/queries";
import { FACULTY_PAGE_SIZE } from "@/lib/public-data.functions";
import { Button } from "@/components/ui/button";
import { ratingLabel } from "@/lib/review-rules";

export const Route = createFileRoute("/institutions/$institutionId")({
  loader: async ({ context, params }) => {
    const [data] = await Promise.all([
      context.queryClient.ensureQueryData(institutionQuery(params.institutionId)),
      context.queryClient.prefetchQuery(facultyQuery(params.institutionId)),
    ]);
    if (!data) throw notFound();
    return { name: data.institution.name, location: data.institution.location };
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `Professors at ${loaderData.name} — Faculty Reviews`
      : "College not found — Faculty Reviews";
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
  pendingComponent: () => (
    <p role="status" className="mx-auto max-w-3xl px-4 py-8">
      Loading university…
    </p>
  ),
});

function InstitutionPage() {
  const { institutionId } = Route.useParams();
  return <InstitutionContents key={institutionId} institutionId={institutionId} />;
}

function InstitutionContents({ institutionId }: { institutionId: string }) {
  const { data } = useSuspenseQuery(institutionQuery(institutionId));
  const [name, setName] = useState("");
  const [filters, setFilters] = useState({ q: "", departmentId: "", page: 0 });
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = name.trim();
      setFilters((previous) => (previous.q === q ? previous : { ...previous, q, page: 0 }));
    }, 250);
    return () => clearTimeout(timer);
  }, [name]);
  const faculty = useQuery(
    facultyQuery(institutionId, filters.q, filters.departmentId || undefined, filters.page),
  );
  const professors = faculty.data?.professors ?? [];
  const count = faculty.data?.count ?? 0;
  const searching = name.trim() !== filters.q;
  if (!data) return null;
  const { institution } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to="/"
        search={{ q: undefined }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
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
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Search ${data.professorCount} professor${data.professorCount === 1 ? "" : "s"} by name…`}
          className="h-12 rounded-xl bg-card pl-11 shadow-soft"
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Filter by department
        <select
          value={filters.departmentId}
          onChange={(event) =>
            setFilters({ q: name.trim(), departmentId: event.target.value, page: 0 })
          }
          className="mt-2 h-12 w-full rounded-xl border border-input bg-card px-3 shadow-soft"
        >
          <option value="">All departments</option>
          {data.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      {(faculty.isPending || searching) && (
        <p role="status" className="mt-6 text-muted-foreground">
          Searching professors…
        </p>
      )}
      {faculty.isError && (
        <div role="alert" className="mt-6">
          <p>Could not load professors. Please try again.</p>
          <Button variant="outline" onClick={() => faculty.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {faculty.isSuccess && !searching && (
        <>
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            {count
              ? `Showing ${filters.page * FACULTY_PAGE_SIZE + 1}–${filters.page * FACULTY_PAGE_SIZE + professors.length} of ${count} professors`
              : "0 professors found"}
          </p>
          <ul className="mt-3 space-y-3">
            {professors.map((p) => {
              const dept = (p.departments as { name: string } | null)?.name;
              const rec = p.review_count
                ? Math.round((p.recommend_count / p.review_count) * 100)
                : null;
              return (
                <li key={p.id}>
                  <Link
                    to="/professors/$professorId"
                    params={{ professorId: p.id }}
                    preload="intent"
                    className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift"
                  >
                    <RatingTile value={p.avg_rating} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-semibold leading-snug">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{dept}</p>
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
              {filters.q || filters.departmentId
                ? "No professors match these filters."
                : "No professors have been added here yet."}
            </div>
          )}
          {(count > FACULTY_PAGE_SIZE || filters.page > 0) && (
            <nav
              aria-label="Professor pages"
              className="mt-6 flex items-center justify-between gap-3"
            >
              <Button
                variant="outline"
                disabled={filters.page === 0}
                onClick={() => setFilters((previous) => ({ ...previous, page: previous.page - 1 }))}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {filters.page + 1} of {Math.max(1, Math.ceil(count / FACULTY_PAGE_SIZE))}
              </span>
              <Button
                variant="outline"
                disabled={(filters.page + 1) * FACULTY_PAGE_SIZE >= count}
                onClick={() => setFilters((previous) => ({ ...previous, page: previous.page + 1 }))}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
