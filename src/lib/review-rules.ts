import { z } from "zod";

export const RATING_LABELS: Record<number, string> = {
  1: "Very Bad",
  2: "Bad",
  3: "Good",
  4: "Very Good",
  5: "Awesome",
};

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Very Easy",
  2: "Easy",
  3: "Moderate",
  4: "Strict",
  5: "Very Strict",
};

export const GRADES = ["O", "A+", "A", "B+", "B", "C", "P", "F", "Not received yet"] as const;

export const REVIEW_TAGS = [
  "Too Many Assignments",
  "Practical Teaching",
  "PPT Reader",
  "Strict Viva",
] as const;

export const MAX_TAGS = 3;

export const SUBJECT_MAX = 100;

export const reviewSchema = z.object({
  subject_name: z
    .string()
    .trim()
    .min(2, "Enter the subject you took")
    .max(SUBJECT_MAX, `Keep the subject under ${SUBJECT_MAX} characters`),
  rating: z.number().int().min(1, "Choose an overall rating").max(5),
  difficulty: z.number().int().min(1, "Choose how difficult or strict").max(5),
  would_recommend: z.boolean({ message: "Tell us if you'd recommend this professor" }),
  grade: z.enum(GRADES, { message: "Choose the grade you received" }),
  tags: z.array(z.enum(REVIEW_TAGS)).max(MAX_TAGS, `Pick up to ${MAX_TAGS} tags`),
  comment: z
    .string()
    .trim()
    .min(10, "Write at least 10 characters about your experience")
    .max(2000, "Keep your comment under 2000 characters"),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/** Toggles a tag, never allowing more than MAX_TAGS selected. */
export function toggleTag(selected: string[], tag: string): string[] {
  if (selected.includes(tag)) return selected.filter((t) => t !== tag);
  if (selected.length >= MAX_TAGS) return selected;
  return [...selected, tag];
}

/** Message shown when the typed subject contains a restricted word. */
export function restrictedSubjectMessage(word: string) {
  return `The subject contains a word that isn't allowed ("${word}"). Please change the subject.`;
}

/** Turns a database error from posting a review into a message for the student. */
export function reviewErrorMessage(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return null;
  const msg = error.message ?? "";
  const restricted = msg.match(/RESTRICTED_WORD:(.+)/);
  const restrictedSubject = msg.match(/RESTRICTED_SUBJECT:(.+)/);
  if (restrictedSubject) {
    return restrictedSubjectMessage((restrictedSubject[1] ?? "").trim());
  }
  if (restricted) {
    return `Your comment contains a word that isn't allowed ("${(restricted[1] ?? "").trim()}"). Please revise your comment and try again.`;
  }
  if (error.code === "23505") {
    return "You've already reviewed this professor for this subject.";
  }
  if (msg) return msg;
  return "Something went wrong. Please try again.";
}

export function ratingLabel(value: number | null | undefined) {
  if (!value) return "No ratings yet";
  return RATING_LABELS[Math.min(5, Math.max(1, Math.round(value)))];
}

export function difficultyLabel(value: number | null | undefined) {
  if (!value) return "—";
  return DIFFICULTY_LABELS[Math.min(5, Math.max(1, Math.round(value)))];
}
