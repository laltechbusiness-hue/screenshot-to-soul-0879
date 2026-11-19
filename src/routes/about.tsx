import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About | Faculty Reviews" },
      {
        name: "description",
        content: "Learn about Faculty Reviews, a platform for sharing student experiences through ratings and anonymous reviews.",
      },
      { property: "og:title", content: "About | Faculty Reviews" },
      {
        property: "og:description",
        content: "Our purpose, how reviews work, and how to contribute responsibly.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="font-display text-3xl font-semibold">About Faculty Reviews</h1>
      <p>
        Faculty Reviews (facultyreviews.online) is an independent platform built to help university students make informed course and section choices during semester registration.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Why we built it</h2>
        <p>
          Choosing courses and faculty every semester often relies on scattered word-of-mouth advice. Faculty Reviews brings student feedback into one structured, searchable place—highlighting teaching clarity, grading patterns, and overall classroom experience.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How reviews work</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">
              Verified sign-in, anonymous display:
            </strong>{" "}
            Contributors sign in with Google to prevent spam and duplicate voting,
            while reviews are published strictly under an anonymous chosen username.
          </li>
          <li>
            <strong className="font-medium text-foreground">Academic focus:</strong>{" "}
            All submissions are expected to stay constructive, honest, and focused on
            coursework and teaching rather than personal remarks.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              Community moderation:
            </strong>{" "}
            Visitors can flag inappropriate or inaccurate content using the Report
            button on any review, and reported entries are reviewed promptly.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Independence & Contact</h2>
        <p>
          Faculty Reviews is an independent student initiative and is not officially affiliated with any listed university or institution. For support, moderation requests, or general inquiries, contact us at laltechbusiness@gmail.com.
        </p>
        
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Get in touch</h2>
        <p>
          For questions, feedback, or corrections, email{" "}
          <a className="underline" href="mailto:laltechbusiness@gmail.com">
            laltechbusiness@gmail.com
          </a>
          . For more information, read our{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link> and{" "}
          <Link to="/terms" className="underline">Terms of Service</Link>.
        </p>
      </section>
    </article>
  );
}
