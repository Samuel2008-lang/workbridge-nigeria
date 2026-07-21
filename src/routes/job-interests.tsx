import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { JOB_INTEREST_OPTIONS } from "@/lib/job-interests";
import { supabase } from "@/integrations/supabase/client";
import { saveProfile } from "@/lib/profile-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/job-interests")({
  head: () => ({ meta: [{ title: "Job interests — WorkBridge" }] }),
  component: JobInterestsScreen,
});

/**
 * Shown after successful signup (before home).
 * Saves to profiles.job_interests (this app's user table — not public.users).
 */
function JobInterestsScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showError, setShowError] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const goHome = () => navigate({ to: "/home" });

  const handleContinue = async () => {
    setShowError(true);
    if (selected.length === 0) {
      toast.error("Select at least one interest");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in");
        navigate({ to: "/login" });
        return;
      }

      // Preferred path: profile store (profiles table)
      const res = await saveProfile({ job_interests: selected });
      if (!res.ok) {
        console.error("[job-interests] saveProfile failed", res.error);
        // Direct update fallback
        const { error } = await supabase
          .from("profiles")
          .update({ job_interests: selected })
          .eq("id", user.id);
        if (error) {
          console.error("[job-interests] profiles update error", error);
          toast.error(error.message);
          setSaving(false);
          return;
        }
      }
      toast.success("Interests saved");
      goHome();
    } catch (e) {
      console.error("[job-interests]", e);
      toast.error(e instanceof Error ? e.message : "Could not save interests");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-5 pt-10 pb-8">
      <h1 className="text-3xl font-bold text-foreground">What work interests you?</h1>
      <p className="text-base text-muted-foreground mt-2 mb-6">
        Select all that apply. You can always update these later.
      </p>

      <div className="grid grid-cols-2 gap-3 flex-1 content-start">
        {JOB_INTEREST_OPTIONS.map((opt) => {
          const on = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={cn(
                "rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] min-h-[110px]",
                on
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-card",
              )}
            >
              <div className="text-3xl mb-2">{opt.emoji}</div>
              <p className="text-sm font-bold text-foreground leading-snug">{opt.label}</p>
            </button>
          );
        })}
      </div>

      {showError && selected.length === 0 && (
        <p className="mt-3 text-xs text-destructive">Select at least one interest to continue</p>
      )}

      <div className="mt-6 space-y-3">
        <Button
          onClick={() => void handleContinue()}
          disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-primary"
        >
          {saving ? "Saving…" : "Continue"}
        </Button>
        <button
          type="button"
          onClick={goHome}
          className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground py-2"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
