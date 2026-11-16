import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { GoogleButton } from "@/components/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function AdminPage() {
  const { user, loading } = useAuth();

  const role = useQuery({
    queryKey: ["admin-access", user?.id],
    enabled: !loading && Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) throw error;
      return data === true;
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Faculty Reviews administration</h1>

      {loading || (user && role.isPending) ? (
        <p role="status">Checking access…</p>
      ) : !user ? (
        <GoogleButton returnTo="/admin" />
      ) : role.isError ? (
        <p role="alert">Could not verify admin access. Refresh and try again.</p>
      ) : !role.data ? (
        <p>This account does not have admin access.</p>
      ) : (
        <AdminPanel key={user.id} userId={user.id} />
      )}
    </div>
  );
}

function AdminPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [institutionId, setInstitutionId] = useState("");
  const [busy, setBusy] = useState(false);

  const directoryKey = ["admin-directory", userId];
  const wordsKey = ["admin-restricted-words", userId];
  const reportsKey = ["admin-reports", userId];

  const directory = useQuery({
    queryKey: directoryKey,
    queryFn: async () => {
      const [institutions, departments] = await Promise.all([
        supabase.from("institutions").select("id,name").order("name"),
        supabase.from("departments").select("id,name,institution_id").order("name"),
      ]);

      for (const result of [institutions, departments]) {
        if (result.error) throw result.error;
      }

      return {
        institutions: institutions.data ?? [],
        departments: departments.data ?? [],
      };
    },
  });

  const words = useQuery({
    queryKey: wordsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restricted_words")
        .select("id,word")
        .order("word");

      if (error) throw error;
      return data;
    },
  });

  const reports = useQuery({
    queryKey: reportsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_reports")
        .select("id,review_id,reason,created_at,reviews(id,professor_id,comment,rating)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const institutions = directory.data?.institutions ?? [];
  const departments = directory.data?.departments.filter(
    (department) => department.institution_id === institutionId,
  ) ?? [];

  async function refreshDirectory() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: directoryKey }),
      queryClient.invalidateQueries({ queryKey: ["institutions"] }),
      queryClient.invalidateQueries({ queryKey: ["institution"] }),
      queryClient.invalidateQueries({ queryKey: ["professor"] }),
    ]);
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      return true;
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Please try again.";
      toast.error(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function submit(
    action: (fields: FormData) => Promise<void>,
    success: string,
  ) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const saved = await runAction(() => action(new FormData(form)), success);
      if (saved) form.reset();
    };
  }

  return (
    <>
      <SiteStats userId={userId} />

      <Section title="Colleges and professors">
        {directory.isPending && <p role="status">Loading directory…</p>}
        {directory.isError && <p role="alert">Could not load the directory.</p>}

        {directory.isSuccess && (
          <div className="grid gap-6">
            <form
              className="grid gap-3"
              onSubmit={submit(async (fields) => {
                const { data, error } = await supabase
                  .from("institutions")
                  .insert({
                    name: read(fields, "name"),
                    location: read(fields, "location") || null,
                  })
                  .select("id")
                  .single();

                if (error) throw error;
                await refreshDirectory();
                setInstitutionId(data.id);
              }, "Institution added")}
            >
              <Field label="College or university name">
                <Input name="name" required minLength={2} maxLength={200} />
              </Field>
              <Field label="Location (optional)">
                <Input name="location" maxLength={200} />
              </Field>
              <div><Button disabled={busy}>Add institution</Button></div>
            </form>

            <Field label="Choose the institution to manage">
              <select
                className={selectClass}
                value={institutionId}
                onChange={(event) => {
                  setInstitutionId(event.target.value);
                }}
              >
                <option value="">Select an institution</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
            </Field>

            {institutionId && (
              <div key={institutionId} className="grid gap-6 md:grid-cols-2">
                <form
                  className="grid content-start gap-3"
                  onSubmit={submit(async (fields) => {
                    const { error } = await supabase.from("departments").insert({
                      institution_id: institutionId,
                      name: read(fields, "name"),
                    });
                    if (error) throw error;
                    await refreshDirectory();
                  }, "Department added")}
                >
                  <Field label="New department name">
                    <Input name="name" required minLength={2} maxLength={200} />
                  </Field>
                  <div><Button disabled={busy}>Add department</Button></div>
                </form>

                <form
                  className="grid content-start gap-3"
                  onSubmit={submit(async (fields) => {
                    const { error } = await supabase.from("professors").insert({
                      institution_id: institutionId,
                      department_id: read(fields, "department"),
                      name: read(fields, "name"),
                    });

                    if (error) throw error;
                    await refreshDirectory();
                  }, "Professor added")}
                >
                  <Field label="Professor name">
                    <Input name="name" required minLength={2} maxLength={200} />
                  </Field>
                  <Field label="Department">
                    <select className={selectClass} name="department" required>
                      <option value="">Select a department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {departments.length === 0 && (
                    <p className="text-sm">Add a department first.</p>
                  )}
                  <div>
                    <Button disabled={busy || departments.length === 0}>
                      Add professor
                    </Button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}
      </Section>

      <Section title="Reported reviews">
        {reports.isPending && <p role="status">Loading reports…</p>}
        {reports.isError && <p role="alert">Could not load reports.</p>}
        {reports.isSuccess && reports.data.length === 0 && <p>No reports.</p>}

        {reports.data?.map((report) => {
          const review = report.reviews;

          return (
            <article key={report.id} className="space-y-2 rounded-md border p-3">
              <p className="text-sm text-muted-foreground">
                Reported {new Date(report.created_at).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                <strong>Reason</strong> {report.reason || "No reason provided"}
              </p>

              {review && (
                <>
                  <p className="text-sm font-medium">Rating {review.rating}/5</p>
                  <p className="whitespace-pre-wrap break-words">{review.comment}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to="/professors/$professorId"
                      params={{ professorId: review.professor_id }}
                      className="text-sm underline"
                    >
                      Open professor profile
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm("Permanently remove this review?")) return;

                        void runAction(async () => {
                          const { data, error } = await supabase
                            .from("reviews")
                            .delete()
                            .eq("id", review.id)
                            .select("id")
                            .maybeSingle();

                          if (error) throw error;
                          if (!data) throw new Error("Review could not be removed.");

                          await Promise.all([
                            queryClient.invalidateQueries({ queryKey: reportsKey }),
                            queryClient.invalidateQueries({ queryKey: ["institution"] }),
                            queryClient.invalidateQueries({
                              queryKey: ["professor", review.professor_id],
                            }),
                          ]);
                        }, "Review removed");
                      }}
                    >
                      Remove review
                    </Button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </Section>

      <Section title="Restricted words">
        <form
          className="grid gap-3"
          onSubmit={submit(async (fields) => {
            const { error } = await supabase.from("restricted_words").insert({
              word: read(fields, "word"),
            });
            if (error) throw error;
            await queryClient.invalidateQueries({ queryKey: wordsKey });
          }, "Restricted word added")}
        >
          <Field label="Word to block in new reviews">
            <Input name="word" required maxLength={100} />
          </Field>
          <div><Button disabled={busy}>Add restricted word</Button></div>
        </form>

        {words.isPending && <p role="status">Loading restricted words…</p>}
        {words.isError && <p role="alert">Could not load restricted words.</p>}
        {words.isSuccess && words.data.length === 0 && <p>No restricted words.</p>}
        {words.data && words.data.length > 0 && (
          <ul className="list-disc pl-5 text-sm">
            {words.data.map((entry) => <li key={entry.id}>{entry.word}</li>)}
          </ul>
        )}
      </Section>
    </>
  );
}

function read(fields: FormData, name: string) {
  return String(fields.get(name) ?? "").trim();
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

type StatRow = { period: string; users: number; reviews: number };
type SiteStatsData = { total_users: number; total_reviews: number; daily: StatRow[]; monthly: StatRow[] };

function SiteStats({ userId }: { userId: string }) {
  const [view, setView] = useState<"daily" | "monthly">("daily");
  const stats = useQuery({
    queryKey: ["admin-stats", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_site_stats");
      if (error) throw error;
      return data as unknown as SiteStatsData;
    },
  });

  const rows = stats.data ? stats.data[view] : [];
  const today = stats.data?.daily[0];
  const thisMonth = stats.data?.monthly[0];

  return (
    <Section title="Site activity">
      {stats.isPending && <p role="status">Loading activity…</p>}
      {stats.isError && <p role="alert">Could not load site activity.</p>}
      {stats.data && (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total users" value={stats.data.total_users} />
            <Stat label="Total reviews" value={stats.data.total_reviews} />
            <Stat label="New users today" value={today?.users ?? 0} />
            <Stat label="New users this month" value={thisMonth?.users ?? 0} />
          </dl>

          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">New users and reviews</h3>
            <div className="flex rounded-lg border border-border bg-card p-0.5 text-sm" role="group" aria-label="Group by">
              {(["daily", "monthly"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={
                    view === v
                      ? "rounded-md bg-primary px-3 py-1 text-primary-foreground"
                      : "rounded-md px-3 py-1 text-muted-foreground hover:text-foreground"
                  }
                >
                  {v === "daily" ? "Per day" : "Per month"}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{view === "daily" ? "Day" : "Month"}</th>
                  <th className="px-3 py-2 text-right font-medium">New users</th>
                  <th className="px-3 py-2 text-right font-medium">Reviews</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.period} className="border-t">
                    <td className="px-3 py-2">{formatPeriod(row.period, view)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.users}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.reviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {view === "daily" ? "Last 30 days" : "Last 12 months"}, India time.
          </p>
        </>
      )}
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/70 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}

function formatPeriod(period: string, view: "daily" | "monthly") {
  const [y, m, d] = period.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString("en-IN", view === "daily"
    ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
    : { month: "long", year: "numeric", timeZone: "UTC" });
}
