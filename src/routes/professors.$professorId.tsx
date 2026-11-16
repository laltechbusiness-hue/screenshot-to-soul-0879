import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoogleButton } from "@/components/google-button";
import { RatingTile } from "@/components/rating";
import { ReviewCard } from "@/components/review-card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReviewForm } from "@/components/review-form";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { professorQuery, type ReviewRow } from "@/lib/queries";
import { difficultyLabel, ratingLabel, REVIEW_TAGS } from "@/lib/review-rules";

export const Route = createFileRoute("/professors/$professorId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(professorQuery(params.professorId));
    if (!data) throw notFound();
    const inst = data.professor.institutions as { name: string } | null;
    return { name: data.professor.name, institution: inst?.name ?? "", avg: data.professor.avg_rating, count: data.professor.review_count };
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.name}, ${loaderData.institution} — Reviews on Faculty Reviews`
      : "Professor not found — Faculty Reviews";
    const description = loaderData
      ? loaderData.count
        ? `${loaderData.name} is rated ${Number(loaderData.avg).toFixed(1)}/5 by ${loaderData.count} student${loaderData.count === 1 ? "" : "s"} at ${loaderData.institution}. Read anonymous reviews.`
        : `Read and write anonymous student reviews for ${loaderData.name} at ${loaderData.institution}.`
      : "This professor could not be found.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">Professor not found</h1>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Back to search
      </Link>
    </div>
  ),
  component: ProfessorPage,
});

type Sort = "newest" | "helpful";

function ProfessorPage() {
  const { professorId } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(professorQuery(professorId));
  const { user, isAdmin, signInWithGoogle } = useAuth();
  const [editing, setEditing] = useState<{ review: ReviewRow; userId: string } | null>(null);
  const [writing, setWriting] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const uid = user?.id;
  const reviews = data?.reviews ?? [];
  const reviewIds = reviews.map((r) => r.id);

  const mine = useQuery({
    queryKey: ["my-reviews", professorId, uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_review_ids", { _professor_id: professorId });
      if (error) throw error;
      return new Set((data as unknown as string[]) ?? []);
    },
  });

  const myVotes = useQuery({
    queryKey: ["my-votes", professorId, uid, reviewIds.length],
    enabled: !!uid && reviewIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("review_votes").select("review_id, vote").in("review_id", reviewIds);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((v) => [v.review_id, v.vote as -1 | 1]));
    },
  });

  const myReports = useQuery({
    queryKey: ["my-reports", professorId, uid, reviewIds.length],
    enabled: !!uid && reviewIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_reports")
        .select("review_id")
        .eq("user_id", uid!)
        .in("review_id", reviewIds);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.review_id));
    },
  });

  const sorted = useMemo(() => {
    const list = [...reviews];
    if (sort === "helpful") list.sort((a, b) => b.like_count - b.dislike_count - (a.like_count - a.dislike_count));
    return list;
  }, [reviews, sort]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reviews) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return REVIEW_TAGS.map((t) => [t, counts.get(t) ?? 0] as const).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  }, [reviews]);

  if (!data) return null;
  const { professor } = data;
  const inst = professor.institutions as { id: string; name: string; location: string | null } | null;
  const dept = (professor.departments as { name: string } | null)?.name;
  const rec = professor.review_count ? Math.round((professor.recommend_count / professor.review_count) * 100) : null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["professor", professorId] });
    qc.invalidateQueries({ queryKey: ["institution"] });
  };

  async function vote(review: ReviewRow, v: -1 | 1) {
    if (!uid) return;
    const current = myVotes.data?.[review.id];
    const { error } =
      current === v
        ? await supabase.from("review_votes").delete().eq("review_id", review.id).eq("user_id", uid)
        : await supabase.from("review_votes").upsert({ review_id: review.id, user_id: uid, vote: v });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-votes", professorId] });
    qc.invalidateQueries({ queryKey: ["professor", professorId] });
  }

  async function report(review: ReviewRow, reason: string) {
    const { error } = await supabase
      .from("review_reports")
      .insert({ review_id: review.id, reason: reason || null });
    if (error && error.code !== "23505") {
      toast.error(error.message);
      return false;
    }
    qc.invalidateQueries({ queryKey: ["my-reports", professorId] });
    return true;
  }

  async function remove(review: ReviewRow) {
    if (!confirm("Remove this review permanently?")) return;
    const { data: deleted, error } = await supabase.from("reviews").delete().eq("id", review.id).select("id").maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!deleted) {
      toast.error("This review could not be deleted.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-reviews", professorId] });
    toast.success("Review removed");
    refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {inst && (
        <Link
          to="/institutions/$institutionId"
          params={{ institutionId: inst.id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {inst.name}
        </Link>
      )}

      <section className="mt-4 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <RatingTile value={professor.avg_rating} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{professor.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {dept}
              {inst ? ` · ${inst.name}` : ""}
            </p>
            <p className="mt-2 text-sm">
              {professor.review_count ? (
                <>
                  <span className="font-semibold">{ratingLabel(Number(professor.avg_rating))}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · based on {professor.review_count} review{professor.review_count === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No reviews yet — be the first.</span>
              )}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/70 p-3">
            <dt className="text-xs text-muted-foreground">Difficulty</dt>
            <dd className="font-display text-xl font-semibold">
              {professor.avg_difficulty ? Number(professor.avg_difficulty).toFixed(1) : "–"}
              <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">
                {difficultyLabel(Number(professor.avg_difficulty))}
              </span>
            </dd>
          </div>
          <div className="rounded-xl bg-muted/70 p-3">
            <dt className="text-xs text-muted-foreground">Would recommend</dt>
            <dd className="font-display text-xl font-semibold">{rec !== null ? `${rec}%` : "–"}</dd>
          </div>
        </dl>

        {tagCounts.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Students say</p>
            <div className="flex flex-wrap gap-1.5">
              {tagCounts.map(([t, c]) => (
                <Badge key={t} variant="outline" className="rounded-full font-normal">
                  {t} <span className="text-muted-foreground">×{c}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        {writing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Write a review</h2>
              <Button variant="ghost" size="sm" onClick={() => setWriting(false)}>
                Cancel
              </Button>
            </div>
            <ReviewForm
              professorId={professorId}
              onDone={() => {
                setWriting(false);
                refresh();
                qc.invalidateQueries({ queryKey: ["my-reviews", professorId] });
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary-soft/50 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">Took a class with {professor.name.split(" ")[0]}?</p>
              <p className="text-sm text-muted-foreground">Share your experience anonymously to help other students.</p>
            </div>
            {!user ? (
              <GoogleButton label="Sign in with Google to review" />
            ) : (
              <Button size="lg" onClick={() => setWriting(true)}>
                <PenLine /> Write a review
              </Button>
            )}
          </div>
        )}
      </section>

      <Dialog open={!!editing && editing.userId === uid} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit your review</DialogTitle>
            <DialogDescription>Update your rating and feedback for this subject.</DialogDescription>
          </DialogHeader>
          {editing && editing.userId === uid && (
            <ReviewForm
              key={editing.review.id}
              review={editing.review}
              professorId={professorId}
              onDone={() => {
                setEditing(null);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">
            Reviews <span className="font-sans text-base font-normal text-muted-foreground">({reviews.length})</span>
          </h2>
          {reviews.length > 1 && (
            <div className="flex rounded-lg border border-border bg-card p-0.5 text-sm" role="group" aria-label="Sort reviews">
              {(["newest", "helpful"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={sort === s}
                  onClick={() => setSort(s)}
                  className={
                    sort === s
                      ? "rounded-md bg-primary px-3 py-1 text-primary-foreground"
                      : "rounded-md px-3 py-1 text-muted-foreground hover:text-foreground"
                  }
                >
                  {s === "newest" ? "Newest" : "Most helpful"}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          {sorted.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              isMine={!!mine.data?.has(r.id)}
              myVote={myVotes.data?.[r.id]}
              reported={!!myReports.data?.has(r.id)}
              signedIn={!!user}
              isAdmin={isAdmin}
              onVote={(v) => vote(r, v)}
              onReport={(reason) => report(r, reason)}
              onEdit={() => user && setEditing({ review: r, userId: user.id })}
              onRemove={() => remove(r)}
              onNeedSignIn={() => {
                toast("Sign in with Google to like, dislike or report reviews.", {
                  action: { label: "Sign in", onClick: () => signInWithGoogle() },
                });
              }}
            />
          ))}
          {reviews.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No reviews yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
