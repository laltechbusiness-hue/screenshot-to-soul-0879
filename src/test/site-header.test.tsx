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
  useRouterState: () => false,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { username: "CampusFox" } }) }),
    }),
    rpc: async () => ({ data: [] }),
  },
}));

it.each([false, true])("links to Profile next to Sign out (admin: %s)", async (isAdmin) => {
  auth.isAdmin = isAdmin;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["reviewer-username", "reviewer"], "CampusFox");
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
    const profile = Array.from(container.querySelectorAll("a")).find(
      (button) => button.textContent === "Profile",
    );
    if (!profile) throw new Error("Profile button is missing");
    expect(profile.nextElementSibling?.getAttribute("aria-label")).toBe("Sign out");
    expect(profile.getAttribute("href")).toBe("/profile");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    client.clear();
    vi.unstubAllGlobals();
  }
});
