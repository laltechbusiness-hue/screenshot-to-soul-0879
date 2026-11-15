import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { GoogleButton } from "@/components/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [professorId, setProfessorId] = useState("");
  const [busy, setBusy] = useState(false);

  const directoryKey = ["admin-directory", userId];
  const wordsKey = ["admin-restricted-words", userId];
  const reportsKey = ["admin-reports", userId];

  const directory = useQuery({
    queryKey: directoryKey,
    queryFn: async () => {
      const [institutions, departments, professors, subjects] = await Promise.all([
        supabase.from("institutions").select("id,name").order("name"),
        supabase.from("departments").select("id,name,institution_id").order("name"),
        supabase.from("professors").select("id,name,institution_id").order("name"),
        supabase.from("subjects").select("id,name,professor_id").order("name"),
      ]);

      for (const result of [institutions, departments, professors, subjects]) {
        if (result.error) throw result.error;
      }

      return {
        institutions: institutions.data ?? [],
        departments: departments.data ?? [],
        professors: professors.data ?? [],
        subjects: subjects.data ?? [],
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
  const professors = directory.data?.professors.filter(
    (professor) => professor.institution_id === institutionId,
  ) ?? [];
  const subjects = directory.data?.subjects.filter(
    (subject) => subject.professor_id === professorId,
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
                setProfessorId("");
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
                  setProfessorId("");
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
                    const { data, error } = await supabase
                      .from("professors")
                      .insert({
                        institution_id: institutionId,
                        department_id: read(fields, "department"),
                        name: read(fields, "name"),
                      })
                      .select("id")
                      .single();

                    if (error) throw error;
                    await refreshDirectory();
                    setProfessorId(data.id);
                  }, "Professor added. You can now add their subjects.")}
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

            {professors.length > 0 && (
              <div className="grid gap-3 border-t pt-4">
                <Field label="Professor to assign subjects to">
                  <select
                    className={selectClass}
                    value={professorId}
                    onChange={(event) => setProfessorId(event.target.value)}
                  >
                    <option value="">Select a professor</option>
                    {professors.map((professor) => (
                      <option key={professor.id} value={professor.id}>
                        {professor.name}
                      </option>
                    ))}
                  </select>
                </Field>

                {professorId && (
                  <>
                    {subjects.length > 0 && (
                      <ul className="list-disc pl-5 text-sm">
                        {subjects.map((subject) => (
                          <li key={subject.id}>{subject.name}</li>
                        ))}
                      </ul>
                    )}
                    <form
                      key={professorId}
                      className="grid gap-3"
                      onSubmit={submit(async (fields) => {
                        const existing = new Set(
                          subjects.map((subject) => subject.name.trim().toLowerCase()),
                        );
                        const rows: { professor_id: string; name: string }[] = [];

                        for (const line of read(fields, "subjects").split(/\r?\n/)) {
                          const name = line.trim();
                          const normalized = name.toLowerCase();
                          if (!name || existing.has(normalized)) continue;
                          if (name.length > 200) {
                            throw new Error("Each subject must be 200 characters or fewer.");
                          }
                          existing.add(normalized);
                          rows.push({ professor_id: professorId, name });
                        }

                        if (rows.length === 0) {
                          throw new Error("Enter at least one new subject.");
                        }

                        const { error } = await supabase.from("subjects").insert(rows);
                        if (error) throw error;
                        await refreshDirectory();
                      }, "Subjects added")}
                    >
                      <Field label="New subjects, one per line">
                        <Textarea name="subjects" required rows={3} />
                      </Field>
                      <div><Button disabled={busy}>Add subjects</Button></div>
                    </form>
                  </>
                )}
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