import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReviewerUsername } from "@/components/reviewer-username";
import { ReviewForm } from "@/components/review-form";
import { supabase } from "@/integrations/supabase/client";
import { withReviewerUsernames } from "@/lib/reviewer-usernames";

const PAGE_SIZE = 50;

export function ReviewerProfile({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ["profile-reviews", userId, page],
    enabled: open,
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
          "id, professor_id, subject_id, rating, difficulty, would_recommend, grade, tags, comment, professors(name), subjects(name)",
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
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Profile
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription>Manage your anonymous username and reviews.</DialogDescription>
          </DialogHeader>
          <ReviewerUsername userId={userId} inProfile />
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Your reviews</h3>
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
              <p>
                {page === 0 ? "You haven't written any reviews yet." : "No reviews on this page."}
              </p>
            )}
            {reviews.data?.rows.map((review) => (
              <article key={review.id} className="space-y-2 rounded-lg border p-3">
                <Link
                  to="/professors/$professorId"
                  params={{ professorId: review.professor_id }}
                  onClick={() => {
                    setOpen(false);
                    setEditing(null);
                  }}
                  className="font-medium underline"
                >
                  {review.professors?.name ?? "Professor"}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {review.subjects?.name} · {review.rating}/5
                </p>
                {editing === review.id ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel edit
                    </Button>
                    <ReviewForm
                      review={review}
                      professorId={review.professor_id}
                      subjects={[
                        { id: review.subject_id, name: review.subjects?.name ?? "Subject" },
                      ]}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
