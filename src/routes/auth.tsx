import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { takeReturnPath, useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading || !session) return;

    const target = new URL(takeReturnPath(), window.location.origin);
    const destination =
      target.origin === window.location.origin && target.pathname !== "/auth"
        ? target.href
        : window.location.origin;

    window.location.replace(destination);
  }, [loading, session]);

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      {loading || session ? (
        <p role="status">Completing Google sign-in…</p>
      ) : (
        <>
          <p>Google sign-in did not complete.</p>
          <Link to="/" className="mt-4 inline-block underline">
            Return home and try again
          </Link>
        </>
      )}
    </div>
  );
}