import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service | Faculty Reviews" }] }),
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
      <p>
        Faculty Reviews lets students share their experiences with faculty and courses. By using the
        site, you agree to these terms. See our{" "}
        <Link className="underline" to="/privacy">
          Privacy Policy
        </Link>{" "}
        for how we handle information.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Posting reviews</h2>
        <p>
          Write about your own experience and keep feedback relevant to teaching or the course. Do
          not post false claims, threats, harassment, discriminatory abuse, spam, or private
          information about yourself or others. Do not impersonate another person or manipulate
          ratings or votes.
        </p>
        <p>
          You retain ownership of your submissions. By posting a review, you give Faculty Reviews
          permission to store and display it publicly and use its ratings to calculate and display
          aggregate scores.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Accounts and moderation</h2>
        <p>
          Use your own account and choose a username that respects the posting rules. You can edit
          or delete your reviews from Profile. You can report a review using its Report button. We
          may remove content or restrict access if someone violates these terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Using reviews and ratings</h2>
        <p>
          Reviews reflect the opinions of their authors. Ratings summarise submitted reviews and may
          change as reviews are added, edited, or deleted. Faculty Reviews does not guarantee the
          accuracy or completeness of submissions.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p>
          For questions or concerns about content, email{" "}
          <a className="underline" href="mailto:laltechbusiness@gmail.com">
            laltechbusiness@gmail.com
          </a>
          .
        </p>
      </section>
    </article>
  );
}
