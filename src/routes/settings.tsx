import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { useProfile } from "@/hooks/use-profile";
import { saveProfile, saveSettings } from "@/lib/profile-store";
import { JOB_INTEREST_OPTIONS } from "@/lib/job-interests";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — WorkBridge" }] }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const { settings, preferredMode, profile, isInitialLoading } = useProfile();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestsDirty, setInterestsDirty] = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);

  useEffect(() => {
    if (!interestsDirty && profile?.job_interests) {
      setInterests(profile.job_interests);
    }
  }, [profile?.job_interests, interestsDirty]);

  const toggleSetting = async (
    key: "push_notifications" | "email_notifications" | "sms_notifications" | "show_distance" | "dark_mode",
    value: boolean,
  ) => {
    setSavingKey(key);
    const res = await saveSettings({ [key]: value });
    setSavingKey(null);
    if (!res.ok) {
      toast.error(res.error || "Could not save setting");
      return;
    }
    toast.success("Setting saved");
  };

  const toggleInterest = (id: string) => {
    setInterestsDirty(true);
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const saveInterests = async () => {
    if (interests.length === 0) {
      toast.error("Select at least one interest");
      return;
    }
    setSavingInterests(true);
    const res = await saveProfile({ job_interests: interests });
    setSavingInterests(false);
    if (!res.ok) {
      toast.error(res.error || "Could not save interests");
      return;
    }
    setInterestsDirty(false);
    toast.success("Job interests updated");
  };

  return (
    <MobileShell>
      <header className="px-5 pt-7 pb-4 flex items-center gap-3 border-b border-border bg-card">
        <Link to="/profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </header>

      <div className="px-5 py-5 space-y-8">
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">Account mode</h2>
          <ModeSwitcher mode={preferredMode} showExplanation />
        </section>

        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Notifications</h2>
          {isInitialLoading && !settings ? (
            <p className="text-xs text-muted-foreground">Loading settings…</p>
          ) : (
            <div className="space-y-2">
              <ToggleRow
                label="Push notifications"
                checked={settings?.push_notifications ?? true}
                loading={savingKey === "push_notifications"}
                onChange={(v) => void toggleSetting("push_notifications", v)}
              />
              <ToggleRow
                label="Email notifications"
                checked={settings?.email_notifications ?? true}
                loading={savingKey === "email_notifications"}
                onChange={(v) => void toggleSetting("email_notifications", v)}
              />
              <ToggleRow
                label="SMS notifications"
                checked={settings?.sms_notifications ?? false}
                loading={savingKey === "sms_notifications"}
                onChange={(v) => void toggleSetting("sms_notifications", v)}
              />
              <ToggleRow
                label="Show distance on job cards"
                checked={settings?.show_distance ?? true}
                loading={savingKey === "show_distance"}
                onChange={(v) => void toggleSetting("show_distance", v)}
              />
            </div>
          )}
          {/* Job matching radius slider intentionally removed */}
        </section>

        <section>
          <h2 className="text-sm font-bold text-foreground mb-1">My Job Interests</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Select all that apply. Jobs matching these appear first in your feed.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {JOB_INTEREST_OPTIONS.map((opt) => {
              const selected = interests.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleInterest(opt.id)}
                  className={cn(
                    "rounded-2xl border-2 p-4 text-left transition-all min-h-[100px]",
                    selected
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card",
                  )}
                >
                  <span className="text-2xl block mb-2">{opt.emoji}</span>
                  <span className="text-sm font-semibold text-foreground leading-snug">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void saveInterests()}
            disabled={savingInterests}
            className="mt-4 w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
          >
            {savingInterests ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save job interests"
            )}
          </button>
        </section>
      </div>
    </MobileShell>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  loading,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={loading}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}
