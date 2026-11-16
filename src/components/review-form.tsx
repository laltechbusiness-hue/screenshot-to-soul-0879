import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  DIFFICULTY_LABELS,
  GRADES,
  MAX_TAGS,
  RATING_LABELS,
  REVIEW_TAGS,
  SUBJECT_MAX,
  restrictedSubjectMessage,
  reviewErrorMessage,
  reviewSchema,
  toggleTag,
} from "@/lib/review-rules";
import type { ReviewRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Checks the typed subject for restricted words shortly after the student stops typing. */
function useRestrictedSubjectCheck(text: string, enabled: boolean) {
  const [word, setWord] = useState<string | null>(null);
  useEffect(() => {
    const value = text.trim();
    if (!enabled || value.length < 2) {
      setWord(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("check_restricted_text", { _text: value });
      if (!cancelled && !error) setWord(data ?? null);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, enabled]);
  return word;
}

function ScalePicker({
  name,
  labels,
  value,
  onChange,
}: {
  name: string;
  labels: Record<number, string>;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 text-center transition-colors",
            value === n
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-card hover:bg-accent",
          )}
        >
          <span className="font-display text-lg font-semibold leading-none">{n}</span>
          <span className="text-[11px] leading-tight sm:text-xs">{labels[n]}</span>
        </button>
      ))}
    </div>
  );
}

function Field({ step, label, children, hint }: { step: number; label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-baseline gap-2 text-sm font-semibold">
        <span className="text-xs font-medium text-muted-foreground">{step}.</span>
        {label}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export function ReviewForm({
  professorId,
  onDone,
  review,
}: {
  professorId: string;
  onDone: () => void;
  review?: Pick<ReviewRow, "id" | "subject_name" | "rating" | "difficulty" | "would_recommend" | "grade" | "tags" | "comment">;
}) {
  const [subjectName, setSubjectName] = useState<string>(review?.subject_name ?? "");
  const [rating, setRating] = useState<number | null>(review?.rating ?? null);
  const [difficulty, setDifficulty] = useState<number | null>(review?.difficulty ?? null);
  const [recommend, setRecommend] = useState<boolean | null>(review?.would_recommend ?? null);
  const [grade, setGrade] = useState<string>(review?.grade ?? "");
  const [tags, setTags] = useState<string[]>(review?.tags ?? []);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const restrictedSubject = useRestrictedSubjectCheck(subjectName, !review);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!review && restrictedSubject) {
      setError(restrictedSubjectMessage(restrictedSubject));
      return;
    }
    const parsed = reviewSchema.safeParse({
      subject_name: subjectName,
      rating: rating ?? 0,
      difficulty: difficulty ?? 0,
      would_recommend: recommend ?? undefined,
      grade: grade || undefined,
      tags,
      comment,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the form");
      return;
    }
    setSaving(true);
    const changes = {
      rating: parsed.data.rating,
      difficulty: parsed.data.difficulty,
      would_recommend: parsed.data.would_recommend,
      grade: parsed.data.grade,
      tags: parsed.data.tags,
      comment: parsed.data.comment,
    };
    const { data: saved, error: dbError } = review
      ? await supabase.from("reviews").update(changes).eq("id", review.id).select("id").maybeSingle()
      : await supabase.from("reviews").insert({ ...parsed.data, professor_id: professorId }).select("id").single();
    setSaving(false);
    if (dbError) {
      setError(reviewErrorMessage(dbError));
      return;
    }
    if (!saved) {
      setError("This review could not be saved.");
      return;
    }
    toast.success(review ? "Review updated" : "Your review is published. Thank you!");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <Field step={1} label="Subject taken">
        <Input
          aria-label="Subject taken"
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value.slice(0, SUBJECT_MAX))}
          disabled={!!review}
          maxLength={SUBJECT_MAX}
          placeholder="e.g. Data Structures"
          aria-invalid={!!restrictedSubject}
          aria-describedby={restrictedSubject ? "subject-restricted" : undefined}
        />
        {restrictedSubject && !review && (
          <p id="subject-restricted" role="alert" className="text-sm text-destructive">
            {restrictedSubjectMessage(restrictedSubject)}
          </p>
        )}
      </Field>

      <Field step={2} label="Overall professor rating">
        <ScalePicker name="Overall professor rating" labels={RATING_LABELS} value={rating} onChange={setRating} />
      </Field>

      <Field step={3} label="How difficult or strict is the professor?">
        <ScalePicker name="Difficulty" labels={DIFFICULTY_LABELS} value={difficulty} onChange={setDifficulty} />
      </Field>

      <Field step={4} label="Would you recommend this professor to other students?">
        <div role="radiogroup" aria-label="Would you recommend" className="grid grid-cols-2 gap-2 sm:max-w-xs">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={recommend === v}
              onClick={() => setRecommend(v)}
              className={cn(
                "rounded-xl border px-4 py-2.5 font-medium transition-colors",
                recommend === v ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent",
              )}
            >
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </Field>

      <Field step={5} label="Grade received in the subject">
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger aria-label="Grade received" className="sm:max-w-xs">
            <SelectValue placeholder="Choose your grade" />
          </SelectTrigger>
          <SelectContent>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field step={6} label="Tags" hint={`Optional — choose up to ${MAX_TAGS}.`}>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map((t) => {
            const on = tags.includes(t);
            const full = !on && tags.length >= MAX_TAGS;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => setTags((cur) => toggleTag(cur, t))}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-40",
                  on ? "border-primary bg-primary-soft text-accent-foreground" : "border-input bg-card hover:bg-accent",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Field>

      <Field step={7} label="Your experience">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 2000))}
          rows={5}
          placeholder="What was the class like? How did the professor teach, grade, and support students?"
        />
        <p className="text-right text-xs text-muted-foreground">{comment.length}/2000</p>
      </Field>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Published anonymously.</p>
        <Button type="submit" size="lg" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} {review ? "Save changes" : "Publish review"}
        </Button>
      </div>
    </form>
  );
}
