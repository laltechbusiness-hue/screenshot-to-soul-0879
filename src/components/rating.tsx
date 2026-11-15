import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ratingLabel } from "@/lib/review-rules";

const tone: Record<number, string> = {
  1: "bg-rating-1",
  2: "bg-rating-2",
  3: "bg-rating-3",
  4: "bg-rating-4",
  5: "bg-rating-5",
};

export function ratingTone(value: number | null | undefined) {
  if (!value) return "bg-muted";
  return tone[Math.min(5, Math.max(1, Math.round(value)))];
}

/** Square score tile, e.g. "4.2" on a colour that matches the rating. */
export function RatingTile({
  value,
  size = "md",
}: {
  value: number | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "size-11 text-base rounded-lg",
    md: "size-14 text-xl rounded-xl",
    lg: "size-24 text-4xl rounded-2xl",
  };
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center font-display font-semibold text-primary-foreground",
        value ? ratingTone(value) : "bg-muted text-muted-foreground",
        sizes[size],
      )}
      aria-label={value ? `Rating ${Number(value).toFixed(1)} out of 5` : "No ratings yet"}
    >
      {value ? Number(value).toFixed(1) : "–"}
    </div>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5 — ${ratingLabel(value)}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("size-4", i <= value ? "fill-highlight text-highlight" : "text-border")}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
