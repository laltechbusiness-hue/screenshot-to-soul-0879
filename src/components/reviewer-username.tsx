import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { withReviewerUsernames } from "@/lib/reviewer-usernames";

export function ReviewerUsername({
  userId,
  inProfile = false,
}: {
  userId: string;
  inProfile?: boolean;
}) {
  const queryClient = useQueryClient();
  const client = withReviewerUsernames(supabase);
  const queryKey = ["reviewer-username", userId];
  const username = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await client
        .from("reviewer_usernames")
        .select("username")
        .maybeSingle();
      if (error) throw error;
      return data?.username ?? null;
    },
  });
  const [dismissed, setDismissed] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = (draft ?? username.data ?? "").trim();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(name)) {
      setError("Use 3 to 24 letters, numbers, or underscores.");
      return;
    }
    setSaving(true);
    setError("");
    const { data, error: saveError } = await client.rpc("set_reviewer_username", {
      _username: name,
    });
    setSaving(false);
    if (saveError) {
      if (saveError.code === "23505") {
        setError("That username is already taken.");
      } else {
        setError(saveError.message);
      }
      return;
    }
    setDraft(null);
    queryClient.setQueryData(queryKey, data);
    void queryClient.invalidateQueries({ queryKey: ["professor"] });
  }

  if (username.isError) {
    return (
      <Button variant="outline" size="sm" onClick={() => void username.refetch()}>
        Retry username setup
      </Button>
    );
  }
  if (!username.isSuccess) return inProfile ? <p>Loading username...</p> : null;
  if (!inProfile && username.data) return null;

  const inputId = inProfile ? "profile-username" : "reviewer-username";
  const form = (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={inputId}>Username</Label>
        <Input
          id={inputId}
          value={draft ?? username.data ?? ""}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete="off"
          required
          disabled={saving}
        />
        <p className="text-sm text-muted-foreground">
          Use 3 to 24 letters, numbers, or underscores.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        {!inProfile && (
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => setDismissed(true)}
          >
            Later
          </Button>
        )}
        <Button
          type="submit"
          disabled={
            saving || (!!username.data && (draft ?? username.data).trim() === username.data)
          }
        >
          {saving ? "Saving…" : "Save username"}
        </Button>
      </DialogFooter>
    </form>
  );

  if (inProfile) return form;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setDismissed(false)}>
        Set username
      </Button>
      <Dialog open={!dismissed} onOpenChange={(open) => !saving && setDismissed(!open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose an anonymous username</DialogTitle>
            <DialogDescription>This name will appear on your reviews.</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    </>
  );
}
