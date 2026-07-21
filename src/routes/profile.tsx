import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  LogOut, MapPin, Phone, Languages, Star, Briefcase, Wallet, Pencil, Settings, Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { saveProfile, clearProfileStore } from "@/lib/profile-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — WorkBridge" }] }),
  component: ProfileScreen,
});

const LANGUAGES = ["English", "Yoruba", "Igbo", "Hausa", "Pidgin"];

function ProfileScreen() {
  const navigate = useNavigate();
  const {
    profile,
    email,
    displayName,
    preferredMode,
    isInitialLoading,
    profileLoadedOnce,
  } = useProfile();

  const [jobsDone, setJobsDone] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("English");

  // Sync form from cached/loaded profile
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? displayName ?? "");
    setPhone(profile.phone_number ?? "");
    setCity(profile.location ?? "");
    setLanguage(profile.language ?? "English");
  }, [profile, displayName]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login" });
        return;
      }

      const { count } = await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("worker_id", user.id)
        .eq("status", "accepted");
      if (active) setJobsDone(count ?? 0);

      const { data: ratings } = await supabase
        .from("ratings")
        .select("stars")
        .eq("rated_user_id", user.id);
      if (active && ratings && ratings.length > 0) {
        const avg = ratings.reduce((s, r) => s + (r.stars ?? 0), 0) / ratings.length;
        setRating(Number(avg.toFixed(1)));
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearProfileStore();
    toast.success("Logged out");
    navigate({ to: "/welcome" });
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await saveProfile({
      full_name: fullName.trim() || null,
      phone_number: phone.trim() || null,
      location: city.trim() || null,
      language: language || null,
    });
    setSaving(false);
    if (!res.ok) {
      console.error("[profile] save failed", res.error);
      toast.error(res.error || "Could not save profile");
      // keep edit mode open
      return;
    }
    toast.success("Profile saved");
    setEditing(false);
  };

  const headerName = displayName?.trim() || null;
  const showLoading = isInitialLoading && !profileLoadedOnce;

  return (
    <MobileShell>
      <header
        className="px-5 pt-7 pb-10 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}
      >
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-3xl font-bold">
            {(headerName ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {showLoading ? (
              <div className="h-6 w-40 rounded-md bg-white/20 animate-pulse" />
            ) : (
              <h1 className="text-xl font-bold truncate">
                {headerName ?? (
                  <span className="text-white/80 font-semibold text-base">
                    Not set — tap to add
                  </span>
                )}
              </h1>
            )}
            {email && <p className="text-xs text-white/70 truncate mt-0.5">{email}</p>}
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wide">
              {preferredMode === "client" ? "Client mode" : "Worker mode"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30"
            aria-label="Edit profile"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </header>

      <section className="px-5 -mt-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Briefcase className="h-4 w-4 text-primary" />} value={String(jobsDone)} label="Jobs" />
          <StatCard
            icon={<Star className="h-4 w-4 text-accent" fill="currentColor" />}
            value={rating != null ? String(rating) : "—"}
            label="Rating"
          />
          <StatCard icon={<Wallet className="h-4 w-4 text-primary" />} value="₦0" label="Earned" />
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-sm font-bold text-foreground mb-2">Account mode</h2>
        <ModeSwitcher mode={preferredMode} showExplanation />
      </section>

      <section className="px-5 mt-6 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground">Account details</h2>
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-semibold text-muted-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        {showLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : editing ? (
          <div className="space-y-3">
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Samuel Egbon"
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08012345678"
                className={inputClass}
              />
            </Field>
            <Field label="City">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Lagos"
                className={inputClass}
              />
            </Field>
            <Field label="Language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={inputClass}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full h-12 rounded-2xl font-semibold"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </span>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        ) : (
          <>
            <DetailRow
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={profile?.phone_number ?? "—"}
            />
            <DetailRow
              icon={<MapPin className="h-4 w-4" />}
              label="Location"
              value={profile?.location ?? "—"}
            />
            <DetailRow
              icon={<Languages className="h-4 w-4" />}
              label="Language"
              value={profile?.language ?? "—"}
            />
            {!headerName && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-full text-left text-sm text-primary font-semibold py-2"
              >
                Add your full name
              </button>
            )}
          </>
        )}
      </section>

      <section className="px-5 mt-8 space-y-3">
        <Link
          to="/settings"
          className="w-full h-12 rounded-2xl border border-border bg-white text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <Link
          to="/wallet"
          className="w-full h-12 rounded-2xl border border-border bg-white text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
        >
          <Wallet className="h-4 w-4" />
          My Wallet
        </Link>
        {email?.toLowerCase() === "hopeegbon28@gmail.com" && (
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
          >
            🛡️ Admin Dashboard
          </button>
        )}
        <button
          onClick={() => void handleLogout()}
          className="w-full h-12 rounded-2xl border border-border bg-white text-muted-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </section>
    </MobileShell>
  );
}

const inputClass = cn(
  "w-full h-12 rounded-2xl border-2 border-border bg-card px-4 text-sm text-foreground",
  "placeholder:text-muted-foreground outline-none focus:border-primary",
);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-sm">
      <div className="flex items-center gap-1.5">{icon}</div>
      <p className="text-lg font-bold text-foreground mt-1 leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
