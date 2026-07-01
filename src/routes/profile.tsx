import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, MapPin, Phone, Languages, Star, Briefcase, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — WorkBridge" }] }),
  component: ProfileScreen,
});

type Profile = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  role: string | null;
  location: string | null;
  language: string | null;
};

function ProfileScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [jobsDone, setJobsDone] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      if (active) setEmail(user.email ?? null);

      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, role, location, language")
        .eq("id", user.id)
        .maybeSingle();
      if (active && p) setProfile(p as Profile);

      // Jobs done: applications accepted or jobs completed
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
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate({ to: "/welcome" });
  };

  const name = profile?.full_name?.trim() || email?.split("@")[0] || "WorkBridge user";

  return (
    <MobileShell>
      <header
        className="px-5 pt-7 pb-10 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}
      >
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-3xl font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{name}</h1>
            {email && <p className="text-xs text-white/70 truncate">{email}</p>}
            {profile?.role && (
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wide">
                {profile.role}
              </span>
            )}
          </div>
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

      <section className="px-5 mt-6 space-y-2">
        <h2 className="text-sm font-bold text-foreground mb-2">Account details</h2>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <>
            <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={profile?.phone_number ?? "—"} />
            <DetailRow icon={<MapPin className="h-4 w-4" />} label="Location" value={profile?.location ?? "—"} />
            <DetailRow icon={<Languages className="h-4 w-4" />} label="Language" value={profile?.language ?? "—"} />
          </>
        )}
      </section>

      <section className="px-5 mt-8">
        <button
          onClick={handleLogout}
          className="w-full h-12 rounded-2xl border-2 border-destructive/30 text-destructive font-semibold text-sm flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </section>
    </MobileShell>
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
