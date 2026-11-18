import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useParams: () => ({ institutionId: "university" }),
  }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  notFound: vi.fn(),
}));
vi.mock("@/lib/public-data.functions", () => ({ FACULTY_PAGE_SIZE: 40 }));
vi.mock("@/lib/queries", () => ({
  institutionQuery: () => ({
    queryKey: ["institution", "university"],
    queryFn: async () => ({
      institution: { name: "Test university", location: "India" },
      professorCount: 2032,
      departments: [
        { id: "cse", name: "Computer Science" },
        { id: "civil", name: "Civil Engineering" },
      ],
    }),
  }),
  facultyQuery: (_id: string, q = "", departmentId?: string, page = 0) => ({
    queryKey: ["faculty", q, departmentId, page],
    queryFn: async () => {
      const rows = Array.from({ length: 2032 }, (_, index) => ({
        id: String(index),
        name: `Professor ${String(index).padStart(4, "0")}`,
        departments: { name: index % 2 ? "Civil Engineering" : "Computer Science" },
        departmentId: index % 2 ? "civil" : "cse",
        review_count: 0,
        avg_rating: null,
        recommend_count: 0,
      })).filter(
        (row) =>
          row.name.toLowerCase().includes(q.toLowerCase()) &&
          (!departmentId || row.departmentId === departmentId),
      );
      return { professors: rows.slice(page * 40, (page + 1) * 40), count: rows.length };
    },
  }),
}));

import { Route } from "@/routes/institutions.$institutionId";

let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

async function findText(text: string) {
  await vi.waitFor(() => expect(container.textContent).toContain(text));
}
async function clickNext() {
  const next = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Next",
  );
  await act(async () => next?.click());
}
async function change(selector: string, value: string) {
  const input = container.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
  await act(async () => {
    const prototype =
      selector === "input" ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(selector === "input" ? "input" : "change", { bubbles: true }));
  });
}

async function mountDirectory() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Page = Route.options.component as () => ReactNode;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>,
    ),
  );
}

describe("University directory", () => {
  it("shows 40 cards and advances to the next page", async () => {
    await mountDirectory();
    await findText("Professor 0000");
    expect(container.textContent).toContain("Showing 1–40 of 2032 professors");
    expect(container.textContent).not.toContain("Professor 0040");
    await clickNext();
    await findText("Professor 0040");
    expect(container.textContent).toContain("Showing 41–80 of 2032 professors");
  });

  it("searches beyond row 1000 and resets the page when filtering", async () => {
    await mountDirectory();
    await findText("Professor 0000");
    await clickNext();
    await findText("Professor 0040");
    await change("input", "Professor 2031");
    await findText("Professor 2031");
    expect(container.textContent).toContain("Showing 1–1 of 1 professors");
    await change("select", "cse");
    await findText("No professors match these filters.");
    await change("select", "civil");
    await findText("Professor 2031");
    expect(container.textContent).not.toContain("No professors match these filters.");
  });
});
