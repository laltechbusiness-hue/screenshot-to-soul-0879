import { describe, expect, it } from "vitest";
import {
  GRADES,
  RATING_LABELS,
  REVIEW_TAGS,
  reviewErrorMessage,
  reviewSchema,
  toggleTag,
} from "./review-rules";

const valid = {
  subject_id: "6f1c1b7e-2a7c-4d5e-9f00-1a2b3c4d5e6f",
  rating: 4,
  difficulty: 3,
  would_recommend: true,
  grade: "A+",
  tags: ["PPT Reader"],
  comment: "Explains concepts clearly with examples.",
};

describe("review rules", () => {
  it("uses the exact overall rating scale", () => {
    expect(RATING_LABELS).toEqual({ 1: "Very Bad", 2: "Bad", 3: "Good", 4: "Very Good", 5: "Awesome" });
  });

  it("offers only the four allowed tags", () => {
    expect([...REVIEW_TAGS]).toEqual(["Too Many Assignments", "Practical Teaching", "PPT Reader", "Strict Viva"]);
  });

  it("offers the agreed grade options", () => {
    expect([...GRADES]).toEqual(["O", "A+", "A", "B+", "B", "C", "P", "F", "Not received yet"]);
  });

  it("never selects more than three tags", () => {
    const three = ["Too Many Assignments", "Practical Teaching", "PPT Reader"];
    expect(toggleTag(three, "Strict Viva")).toEqual(three);
    expect(reviewSchema.safeParse({ ...valid, tags: [...REVIEW_TAGS] }).success).toBe(false);
  });

  it("rejects ratings outside 1–5", () => {
    expect(reviewSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false);
    expect(reviewSchema.safeParse(valid).success).toBe(true);
  });

  it("tells the student to revise when a restricted word is found", () => {
    const msg = reviewErrorMessage({ message: "RESTRICTED_WORD:idiot", code: "P0001" });
    expect(msg).toContain("idiot");
    expect(msg).toContain("revise");
  });
});
