import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ProfessorShare } from "@/components/professor-share";

it.each([false, true])("shares a direct profile URL (clipboard denied: %s)", async (denied) => {
  const writeText = denied ? vi.fn().mockRejectedValue(new Error("Denied")) : vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ProfessorShare professorId="test-professor" name="Test Professor" />));
    await act(async () => container.querySelector("button")!.click());
    const url = "https://facultyreviews.online/professors/test-professor";
    const input = document.querySelector<HTMLInputElement>('[aria-label="Professor profile link"]')!;
    expect(input.value).toBe(url);
    const whatsapp = document.querySelector<HTMLAnchorElement>('a[href^="https://wa.me/"]')!;
    expect(new URL(whatsapp.href).searchParams.get("text")).toBe(`Test Professor on Faculty Reviews: ${url}`);
    const copy = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === " Copy link" || button.textContent?.trim() === "Copy link")!;
    await act(async () => copy.click());
    expect(writeText).toHaveBeenCalledWith(url);
    if (denied) {
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(url.length);
    }
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
