import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Flag, PenLine, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RatingTile } from "@/components/rating";
import { difficultyLabel, ratingLabel } from "@/lib/review-rules";
import type { ReviewRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type ReviewCardProps = {
  review: ReviewRow;
  isMine: boolean;
  myVote: -1 | 1 | undefined;
  reported: boolean;
  signedIn: boolean;
  isAdmin: boolean;
  onVote: (vote: -1 | 1) => void;
  onReport: (reason: string) => Promise<boolean>;
  onEdit?: () => void;
  onRemove: () => void;
  onNeedSignIn: () => void;
};

export function ReviewCard({
  review,
  isMine,
  myVote,
  reported,
  signedIn,
  isAdmin,
  onVote,
  onReport,
  onEdit,
  onRemove,
  onNeedSignIn,
}: ReviewCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const subject = (review.subjects as { name: string } | null)?.name;

  const guard = (fn: () => void) => () => (signedIn ? fn() : onNeedSignIn());

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex gap-4">
        <RatingTile value={review.rating} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{ratingLabel(review.rating)}</span>
            {subject && <span className="text-sm text-muted-foreground">· {subject}</span>}
            {isMine && <Badge variant="secondary">Your review</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {review.username ?? "Anonymous student"} · {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/70 p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Difficulty</dt>
          <dd className="font-medium">
            {review.difficulty}/5 · {difficultyLabel(review.difficulty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Recommends</dt>
          <dd className={cn("font-medium", review.would_recommend ? "text-success" : "text-destructive")}>
            {review.would_recommend ? "Yes" : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Grade</dt>
          <dd className="font-medium">{review.grade}</dd>
        </div>
      </dl>

      <p className="mt-4 whitespace-pre-line leading-relaxed">{review.comment}</p>

      {review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {review.tags.map((t) => (
            <Badge key={t} variant="outline" className="rounded-full font-normal">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        <Button
          variant={myVote === 1 ? "secondary" : "ghost"}
          size="sm"
          disabled={isMine}
          aria-pressed={myVote === 1}
          onClick={guard(() => onVote(1))}
        >
          <ThumbsUp className={cn(myVote === 1 && "fill-current")} /> {review.like_count}
          <span className="sr-only">likes</span>
        </Button>
        <Button
          variant={myVote === -1 ? "secondary" : "ghost"}
          size="sm"
          disabled={isMine}
          aria-pressed={myVote === -1}
          onClick={guard(() => onVote(-1))}
        >
          <ThumbsDown className={cn(myVote === -1 && "fill-current")} /> {review.dislike_count}
          <span className="sr-only">dislikes</span>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          {!isMine && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={reported}
              onClick={guard(() => setReportOpen(true))}
            >
              <Flag /> {reported ? "Reported" : "Report"}
            </Button>
          )}
          {isMine && onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <PenLine /> Edit
            </Button>
          )}
          {(isMine || isAdmin) && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
              <Trash2 /> {isMine ? "Delete" : "Remove"}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this review</DialogTitle>
            <DialogDescription>An admin will look at it and decide whether to remove it.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="What's wrong with this review? (optional)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={sending}
              onClick={async () => {
                setSending(true);
                const ok = await onReport(reason.trim());
                setSending(false);
                if (ok) {
                  setReportOpen(false);
                  setReason("");
                  toast.success("Thanks — the review was sent to moderators.");
                }
              }}
            >
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
