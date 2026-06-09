import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dispute/$jobId")({
  head: () => ({ meta: [{ title: "Report a problem — WorkBridge" }] }),
  component: DisputeScreen,
});

const REASONS = ["Work not done", "Work quality poor", "Worker no-show", "Client not paying", "Scam / fraud", "Other"];

function DisputeScreen() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const [reason, setReason] = useState(REASONS[0]);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!desc.trim() || desc.length < 10) return toast.error("Please describe the problem (10+ chars)");
    setBusy(true);
    const { error } = await supabase.rpc("raise_dispute", { _job_id: jobId, _reason: reason, _description: desc });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reported — admin will review within 24h");
    navigate({ to: "/jobs/$jobId", params: { jobId } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-5 pt-7 pb-4 border-b border-border">
        <button onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId } })} className="h-9 w-9 flex items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold">Report a problem</h1>
      </header>
      <div className="px-5 py-6 space-y-5">
        <div>
          <label className="text-sm font-semibold block mb-2">What went wrong?</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-border bg-card">
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold block mb-2">Tell us what happened</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={6}
            placeholder="Describe the issue, dates, and any details that help…"
            className="w-full p-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          Once you submit, the escrow on this job is frozen until admin reviews (within 24 hours).
        </div>
        <Button onClick={submit} disabled={busy} className="w-full h-14 rounded-2xl text-base font-semibold">
          {busy ? "Submitting…" : "Submit report"}
        </Button>
      </div>
    </div>
  );
}
