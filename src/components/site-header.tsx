import { Link } from "@tanstack/react-router";
import { GraduationCap, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleButton } from "@/components/google-button";
import { useAuth } from "@/hooks/use-auth";
import { SITE_NAME } from "@/lib/site-config";

export function SiteHeader() {
  const { user, isAdmin, loading, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">{SITE_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <ShieldCheck /> <span className="hidden sm:inline">Admin</span>
              </Link>
            </Button>
          )}
          {loading ? null : user ? (
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          ) : (
            <GoogleButton label="Sign in with Google" className="py-[6px]" />
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
        Reviews are written anonymously by students and reflect their personal experience.
      </div>
    </footer>
  );
}
