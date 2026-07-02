import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/client-onboarding")({
  head: () => ({ meta: [{ title: "Welcome — WorkBridge" }] }),
  component: ClientOnboarding,
});

const ITEMS = [
  ["Be clear about what you need", "Describe your job and attach a photo or video so workers understand exactly what is needed. Clear descriptions get better results."],
  ["You do not set the price", "Workers will send you their quotes after seeing your job. You compare quotes, ratings, and reviews, then choose the best worker for you."],
  ["Keep all communication inside the app", "Agreements made outside the app cannot help resolve disputes. This protects both of you."],
  ["Confirm when the job is done", "When your worker finishes, please confirm immediately inside the app. Slow confirmation affects your client rating on WorkBridge."],
  ["Leave an honest review", "Your review helps the whole WorkBridge community. False negative reviews are investigated and may affect your account standing."],
  ["Your rating matters too", "Workers can see your client rating before accepting your job. Clients who confirm quickly and treat workers fairly attract the best talent."],
  ["About payments", "You will only be asked to add money to your wallet when you are ready to hire a specific worker. Your money is fully protected in escrow until the job is confirmed complete."],
];

function ClientOnboarding() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const acknowledge = async () => {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { nav({ to: "/login" }); return; }
    const { error } = await supabase.from("onboarding_acknowledgements")
      .upsert({ user_id: user.id, type: "client_onboarding" as any },
              { onConflict: "user_id,type,job_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    nav({ to: "/post-job" });
  };
  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="px-5 pt-7 pb-6 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5" />
          <h1 className="text-lg font-bold">Welcome to WorkBridge — Please Read First</h1>
        </div>
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
          {busy ? "Saving…" : "I Understand — Post My First Job"}
        </Button>
      </div>
    </div>
  );
}
