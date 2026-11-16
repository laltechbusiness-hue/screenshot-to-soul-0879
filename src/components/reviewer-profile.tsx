import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReviewerUsername } from "@/components/reviewer-username";
import { ReviewForm } from "@/components/review-form";
import { supabase } from "@/integrations/supabase/client";
import { withReviewerUsernames } from "@/lib/reviewer-usernames";

const PAGE_SIZE = 50;

export function ReviewerProfile({ userId }: { userId: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ["profile-reviews", userId, page],
    queryFn: async () => {
      const { data: ids, error } = await withReviewerUsernames(supabase).rpc(
        "my_profile_review_ids",
        {
          _offset: page * PAGE_SIZE,
        },
      );
      if (error) throw error;
      if (!ids.length) return { rows: [], hasNext: false };
      const { data, error: reviewError } = await supabase
        .from("reviews")
        .select(
          "id, professor_id, subject_name, rating, difficulty, would_recommend, grade, tags, comment, professors(name)",
        )
        .in(
          "id",
          ids.slice(0, PAGE_SIZE).map((row) => row.review_id),
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (reviewError) throw reviewError;
      return { rows: data, hasNext: ids.length > PAGE_SIZE };
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["profile-reviews", userId] });
    void queryClient.invalidateQueries({ queryKey: ["professor"] });
    void queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this review permanently?")) return;
    setDeleting(id);
    const { data, error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    setDeleting(null);
    if (error || !data) {
      toast.error(error?.message ?? "This review could not be deleted.");
      return;
    }
    toast.success("Review deleted");
    refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="mb-6 font-display text-3xl font-semibold">Profile</h1>
      <section className="mb-8 space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Anonymous username</h2>
        <ReviewerUsername userId={userId} inProfile />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your reviews</h2>
        {reviews.isPending && <p>Loading reviews...</p>}
        {reviews.isError && (
          <p role="alert">
            Could not load your reviews.{" "}
            <Button variant="link" onClick={() => void reviews.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {reviews.data?.rows.length === 0 && (
          <p>{page === 0 ? "You haven't written any reviews yet." : "No reviews on this page."}</p>
        )}
        {reviews.data?.rows.map((review) => (
          <article key={review.id} className="space-y-2 rounded-lg border p-3">
            <Link
              to="/professors/$professorId"
              params={{ professorId: review.professor_id }}
              className="font-medium underline"
            >
              {review.professors?.name ?? "Professor"}
            </Link>
            <p className="text-sm text-muted-foreground">
              {review.subject_name} · {review.rating}/5
            </p>
            {editing === review.id ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel edit
                </Button>
                <ReviewForm
                  review={review}
                  professorId={review.professor_id}
                  onDone={() => {
                    setEditing(null);
                    refresh();
                  }}
                />
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words">{review.comment}</p>
                <Button size="sm" variant="outline" onClick={() => setEditing(review.id)}>
                  Edit
                </Button>{" "}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deleting !== null}
                  onClick={() => void remove(review.id)}
                >
                  Delete
                </Button>
              </>
            )}
          </article>
        ))}
        {(page > 0 || reviews.data?.hasNext) && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => {
                setEditing(null);
                setPage(page - 1);
              }}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!reviews.data?.hasNext}
              onClick={() => {
                setEditing(null);
                setPage(page + 1);
              }}
            >
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
