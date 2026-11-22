import { useQuery } from "@tanstack/react-query";
import { getTotalReviewCount } from "@/lib/public-data.functions";

export function ReviewedProfessorCount() {
  const { data: count } = useQuery({
    queryKey: ["total-review-count"],
    queryFn: () => getTotalReviewCount({ data: {} }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (count === undefined) return null;
  return (
    <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
      <span className="mr-2 inline-block size-2 rounded-full bg-primary shadow-[0_0_8px_currentColor] text-primary motion-safe:animate-pulse" aria-hidden="true" />
      <span className="font-semibold text-foreground">{count.toLocaleString("en-IN")}</span>+{" "} reviews given by students{" "}
      <span className="font-semibold text-primary">anonymously</span>
    </p>
  );
}
