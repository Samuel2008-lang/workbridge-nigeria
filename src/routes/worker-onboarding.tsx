import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Check, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Search = { job?: string };

export const Route = createFileRoute("/worker-onboarding")({
  validateSearch: (s: Record<string, unknown>): Search => ({ job: typeof s.job === "string" ? s.job : undefined }),
  head: () => ({ meta: [{ title: "Before You Begin — WorkBridge" }] }),
  component: WorkerOnboarding,
});

const ITEMS = [
  ["Agree on all details first", "Before starting, confirm the full job details with your client through the app chat. Make sure you both understand exactly what needs to be done."],
  ["Keep all communication inside the app", "Never move conversations to WhatsApp or personal numbers. Anything discussed outside the app cannot be used to resolve disputes."],
  ["Take a photo or video before and after", "For physical jobs, take a photo or short video before you start and after you finish. This protects you if there is ever a dispute."],
  ["Remind your client to confirm completion", "When the job is done, remind your client to open WorkBridge and tap Confirm Job Complete. This releases your payment immediately."],
  ["Never accept cash without agreeing inside the app first", "If a client wants to pay cash, this must be agreed inside WorkBridge chat before any work begins. Cash outside the app is not covered by our protection."],
  ["Your safety comes first", "For physical jobs, always tell someone you trust where you are going. If anything feels unsafe, you have the right to cancel from inside the app."],
];

function WorkerOnboarding() {
  const nav = useNavigate();
  const { job } = useSearch({ from: "/worker-onboarding" });
  const [busy, setBusy] = useState(false);

  const acknowledge = async () => {
    if (!job) { toast.error("Missing job reference"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { nav({ to: "/login" }); return; }
    const { error } = await supabase.from("onboarding_acknowledgements")
      .upsert({ user_id: user.id, job_id: job, type: "worker_prejob" as any },
              { onConflict: "user_id,type,job_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    nav({ to: "/jobs/$jobId", params: { jobId: job } });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="px-5 pt-7 pb-6 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5" />
          <h1 className="text-lg font-bold">Before You Begin</h1>
        </div>
        <p className="text-sm text-white/80">A quick checklist to keep you protected.</p>
      </header>
      <div className="p-5 space-y-3">
        {ITEMS.map(([title, body]) => (
          <div key={title} className="rounded-2xl bg-card border border-border p-4 flex gap-3 shadow-sm">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 inset-x-0 mx-auto max-w-md p-5 bg-background border-t border-border">
        <Button disabled={busy} onClick={acknowledge} className="w-full h-14 rounded-2xl text-base font-semibold">
          {busy ? "Saving…" : "I Have Read and Understood — Start Job"}
        </Button>
      </div>
    </div>
  );
}
