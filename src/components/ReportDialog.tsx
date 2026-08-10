import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const REASONS = [
  "Nudity or sexual content",
  "Violence or dangerous acts",
  "Harassment or hate speech",
  "Spam or scam",
  "Impersonation",
  "Something else",
];

export type ReportTarget = { type: "user" | "post" | "comment"; id: string; label: string };

export function ReportDialog({
  target,
  open,
  onOpenChange,
}: {
  target: ReportTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>("Nudity or sexual content");
  const [details, setDetails] = useState("");
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      if (!user || !target) throw new Error("not-ready");
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: target.type,
        target_id: target.id,
        reason,
        details: details.slice(0, 1000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report sent", { description: "Our moderation team will review it shortly." });
      setDetails("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => toast.error("We couldn't send that report. Please try again."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {target?.type ?? "content"}</DialogTitle>
          <DialogDescription>
            Reports are confidential. {target?.label ? `Reporting: ${target.label}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
              {REASONS.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                >
                  <RadioGroupItem value={r} /> {r}
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Additional details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={1000}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us what happened"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Sending…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
