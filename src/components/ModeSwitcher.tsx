import { cn } from "@/lib/utils";
import { setPreferredMode, type PreferredMode } from "@/lib/profile-store";
import { toast } from "sonner";
import { useState } from "react";

export function ModeSwitcher({
  mode,
  className,
  showExplanation = false,
}: {
  mode: PreferredMode;
  className?: string;
  showExplanation?: boolean;
}) {
  const [saving, setSaving] = useState(false);

  const switchTo = async (next: PreferredMode) => {
    if (next === mode || saving) return;
    setSaving(true);
    const res = await setPreferredMode(next);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Could not switch mode");
      return;
    }
    toast.success(next === "worker" ? "Switched to Worker Mode" : "Switched to Client Mode");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex rounded-2xl border-2 border-border bg-muted/40 p-1">
        {(["worker", "client"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              disabled={saving}
              onClick={() => void switchTo(m)}
              className={cn(
                "flex-1 h-10 rounded-xl text-sm font-semibold transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "worker" ? "Worker Mode" : "Client Mode"}
            </button>
          );
        })}
      </div>
      {showExplanation && (
        <p className="text-xs text-muted-foreground leading-relaxed px-0.5">
          One account for both. <strong>Worker Mode</strong> shows jobs to apply for.
          <strong> Client Mode</strong> lets you post work and hire. Your wallet and profile stay the same.
        </p>
      )}
    </div>
  );
}
