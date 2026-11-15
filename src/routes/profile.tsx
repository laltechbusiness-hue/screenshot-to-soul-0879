import { createFileRoute } from "@tanstack/react-router";
import { GoogleButton } from "@/components/google-button";
import { ReviewerProfile } from "@/components/reviewer-profile";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile | Faculty Reviews" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <ReviewerProfile key={user.id} userId={user.id} />;

  return (
    <div className="mx-auto min-h-[50vh] w-full max-w-3xl space-y-4 px-4 py-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold">Profile</h1>
      {loading ? <p>Loading profile…</p> : <GoogleButton label="Sign in with Google" />}
    </div>
  );
}
