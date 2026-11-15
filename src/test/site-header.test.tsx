import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/site-header";

const auth = vi.hoisted(() => ({ isAdmin: false }));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ ...auth, loading: false, user: { id: "reviewer" }, signOut: vi.fn() }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { username: "CampusFox" } }) }),
    }),
    rpc: async () => ({ data: [] }),
  },
}));

it.each([false, true])("opens Profile next to Sign out (admin: %s)", async (isAdmin) => {
  auth.isAdmin = isAdmin;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["reviewer-username", "reviewer"], "CampusFox");
  client.setQueryData(["profile-reviews", "reviewer", 0], { rows: [], hasNext: false });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <SiteHeader />
        </QueryClientProvider>,
      );
    });
    const profile = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Profile");
    if (!profile) throw new Error("Profile button is missing");
    expect(profile.nextElementSibling?.getAttribute("aria-label")).toBe("Sign out");
    await act(async () => profile.click());
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.querySelector("h2")?.textContent).toBe("Profile");
    expect(dialog?.querySelector("input")?.value).toBe("CampusFox");
    expect(dialog?.textContent).toContain("You haven't written any reviews yet.");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    client.clear();
    vi.unstubAllGlobals();
  }
});
