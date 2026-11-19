import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewerUsername } from "@/components/reviewer-username";
import { GoogleButton } from "@/components/google-button";
import { useAuth } from "@/hooks/use-auth";
import { SITE_NAME } from "@/lib/site-config";

export function SiteHeader() {
  const { user, loading, isAdmin, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <img src="/favicon.png" alt="" width={32} height={32} className="size-8 object-contain" />
          <span className="font-display text-xl font-semibold tracking-tight">{SITE_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          {!loading && user && isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
          {loading ? null : user ? (
            <SignedInActions key={user.id} userId={user.id} signOut={signOut} />
          ) : (
            <GoogleButton label="Sign in with Google" className="py-[6px]" />
          )}
        </div>
      </div>
    </header>
  );
}

function SignedInActions({ userId, signOut }: { userId: string; signOut: () => Promise<void> }) {
  const onProfile = useRouterState({ select: (state) => state.location.pathname === "/profile" });
  return (
    <>
      {!onProfile && <ReviewerUsername userId={userId} />}
      <Button asChild variant="outline" size="sm">
        <Link to="/profile">Profile</Link>
      </Button>
      <Button variant="outline" size="sm" onClick={() => signOut()} aria-label="Sign out">
        <LogOut /> <span className="hidden sm:inline">Sign out</span>
      </Button>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
        Reviews are written anonymously by students and reflect their personal experience.
        <nav aria-label="Site information" className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/about" className="underline underline-offset-4">About</Link>
          <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>
          <Link to="/terms" className="underline underline-offset-4">Terms of Service</Link>
        </nav>
        <p className="mt-2">
          <a href="https://www.flaticon.com/free-icons/academic" title="academic icons">Academic icons created by kerismaker - Flaticon</a>
      </p>
      </div>
    </footer>
  );
}
