import { useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ProfessorShare({ professorId, name }: { professorId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = `https://facultyreviews.online/professors/${encodeURIComponent(professorId)}`;
  const message = `${name} on Faculty Reviews: ${url}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      input.current?.focus();
      input.current?.select();
      toast("Select and copy the link below to share it.");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 /> Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share professor</DialogTitle>
            <DialogDescription>Share {name}&apos;s profile with others.</DialogDescription>
          </DialogHeader>
          <Input ref={input} aria-label="Professor profile link" value={url} readOnly onFocus={(event) => event.target.select()} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyLink}><Copy /> Copy link</Button>
            <Button asChild variant="outline">
              <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                Share on WhatsApp
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
