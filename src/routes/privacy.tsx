import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy | Faculty Reviews" }] }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
      <p>
        This policy describes how Faculty Reviews handles information when you browse the site, sign
        in, or contribute a review.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Information we collect and use</h2>
        <p>
          When you sign in with Google, we receive account information such as your Google account
          identifier, email address, and basic profile details. We use this information to
          authenticate you, maintain your session, and associate your activity with your account.
        </p>
        <p>
          We store the anonymous username you choose, reviews and ratings you submit, and any votes
          or reports you make. We use this information to publish reviews, calculate ratings, let
          you manage your contributions, and moderate the site. Our hosting and authentication
          providers may process technical information such as IP addresses and request logs to
          operate and secure the service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What other visitors can see</h2>
        <p>
          Your reviews, ratings, and chosen username are public. Faculty Reviews does not display
          your Google email address or Google profile on your reviews. Avoid including identifying
          details in your username or review text. Public reviews can be copied or indexed by
          others.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Service providers and storage</h2>
        <p>
          Google provides sign-in, Supabase provides authentication and database services, and our
          hosting provider delivers the site. We use browser storage to maintain sign-in sessions
          and support site functionality. We may disclose information when required by law.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Retention and your choices</h2>
        <p>
          We retain account information and contributions as needed to operate the service. You can
          change your username and edit or delete your reviews from Profile. Deleted content may
          remain temporarily in backups or logs. To request access, correction, or deletion of your
          account and associated data, email{" "}
          <a className="underline" href="mailto:laltechbusiness@gmail.com">
            laltechbusiness@gmail.com
          </a>
          .
        </p>
      </section>
    </article>
  );
}
