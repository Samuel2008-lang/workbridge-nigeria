import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Star, Award, Briefcase, Wrench, Sparkles, Truck, PenLine, ChefHat, Leaf,
  ImageIcon, Bell, MapPin, HeartHandshake,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";
import { scoreJobAgainstInterests } from "@/lib/job-interests";
import { formatDistanceKm, haversineKm } from "@/lib/distance";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — WorkBridge" },
      { name: "description", content: "Find jobs near you and grow your earnings on WorkBridge." },
    ],
  }),
  component: HomeScreen,
});

const CATEGORIES = [
  { label: "All", id: "all", emoji: "✨", tint: "bg-primary/10 text-primary" },
  { label: "Digital", id: "digital", emoji: "🖼️", icon: ImageIcon, tint: "bg-blue-100 text-blue-700" },
  { label: "Trades", id: "trades", emoji: "🔧", icon: Wrench, tint: "bg-amber-100 text-amber-700" },
  { label: "Cleaning", id: "cleaning", emoji: "🧹", icon: Sparkles, tint: "bg-emerald-100 text-emerald-700" },
  { label: "Delivery", id: "delivery", emoji: "🚚", icon: Truck, tint: "bg-orange-100 text-orange-700" },
  { label: "Writing", id: "writing", emoji: "📝", icon: PenLine, tint: "bg-purple-100 text-purple-700" },
  { label: "Cooking", id: "cooking", emoji: "🍳", icon: ChefHat, tint: "bg-rose-100 text-rose-700" },
  { label: "Gardening", id: "gardening", emoji: "🌿", icon: Leaf, tint: "bg-lime-100 text-lime-700" },
  { label: "Care", id: "care", emoji: "🤝", icon: HeartHandshake, tint: "bg-sky-100 text-sky-700" },
] as const;

type JobRow = {
  id: string;
  title: string;
  description: string | null;
  type: "digital" | "physical";
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  budget_min: number | null;
  budget_max: number | null;
  created_at: string;
};

function formatNaira(n: number | null | undefined) {
  if (n == null) return "—";
  return `₦${Number(n).toLocaleString("en-NG")}`;
}

function pickJobIcon(type: "digital" | "physical") {
  return type === "digital"
    ? { Icon: PenLine, tint: "bg-purple-100 text-purple-700" }
    : { Icon: Wrench, tint: "bg-amber-100 text-amber-700" };
}

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function categoryMatch(job: JobRow, catId: string): boolean {
  if (catId === "all") return true;
  if (catId === "digital") return job.type === "digital";
  const hay = `${job.title} ${job.description ?? ""} ${job.location ?? ""}`.toLowerCase();
  const map: Record<string, string[]> = {
    trades: ["trade", "repair", "plumb", "electric", "fix", "mechanic", "install"],
    cleaning: ["clean", "domestic", "housekeep", "laundry"],
    delivery: ["deliver", "errand", "courier", "dispatch"],
    writing: ["writ", "admin", "typ", "transcri", "content"],
    cooking: ["cook", "cater", "food", "chef", "bake"],
    gardening: ["garden", "outdoor", "landscap", "lawn"],
    care: ["care", "teach", "tutor", "nanny", "child"],
  };
  return (map[catId] ?? []).some((k) => hay.includes(k)) || (catId === "trades" && job.type === "physical");
}

function HomeScreen() {
  const { firstName, preferredMode, profile, isInitialLoading } = useProfile();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsDone, setJobsDone] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [unread, setUnread] = useState<number>(0);
  const [category, setCategory] = useState<string>("all");
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setUserCoords(null),
        { maximumAge: 600_000, timeout: 8000 },
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // Open jobs only; never show jobs the current user posted (Find Work mode)
      let jobsQuery = supabase
        .from("jobs")
        .select("id, title, description, type, location, latitude, longitude, budget_min, budget_max, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100);
      if (user) {
        jobsQuery = jobsQuery.neq("client_id", user.id);
      }
      const { data: jobRows } = await jobsQuery;
      if (active) {
        setJobs((jobRows ?? []) as JobRow[]);
        setLoadingJobs(false);
      }

      if (!user || !active) return;

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

      const { data: w } = await supabase.from("wallets").select("available_balance").eq("user_id", user.id).maybeSingle();
      if (active && w) setWalletBalance(Number(w.available_balance ?? 0));

      const { count: nc } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false);
      if (active) setUnread(nc ?? 0);
    })();
    return () => {
      active = false;
    };
  }, []);

  const rankedJobs = useMemo(() => {
    const interests = profile?.job_interests ?? [];
    const withMeta = jobs
      .filter((j) => categoryMatch(j, category))
      .map((j) => {
        let distanceKm: number | null = null;
        if (
          userCoords &&
          j.latitude != null &&
          j.longitude != null &&
          !Number.isNaN(Number(j.latitude)) &&
          !Number.isNaN(Number(j.longitude))
        ) {
          distanceKm = haversineKm(userCoords.lat, userCoords.lon, Number(j.latitude), Number(j.longitude));
        }
        const interestScore = scoreJobAgainstInterests(j.title, j.description, interests);
        // Nearby boost (closer = higher); jobs without coords get mid rank
        const nearScore =
          distanceKm == null ? 0 : distanceKm < 5 ? 30 : distanceKm < 20 ? 15 : distanceKm < 50 ? 5 : 0;
        return { job: j, distanceKm, rank: interestScore * 10 + nearScore };
      });

    withMeta.sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      // nearer first among equals
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return new Date(b.job.created_at).getTime() - new Date(a.job.created_at).getTime();
    });
    return withMeta;
  }, [jobs, category, profile?.job_interests, userCoords]);

  const initial = firstName ? firstName.charAt(0).toUpperCase() : "?";
  const greeting = greetingForNow();

  return (
    <MobileShell>
      <header
        className="px-5 pt-7 pb-24 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-white/70">{greeting} 👋</p>
            {isInitialLoading || !firstName ? (
              <div
                className="mt-1.5 h-7 w-28 rounded-lg bg-white/20 animate-pulse"
                aria-label="Loading name"
              />
            ) : (
              <h1 className="text-2xl font-bold mt-0.5 truncate">{firstName}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/notifications" className="relative h-10 w-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-accent text-foreground text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold border border-white/30">
              {isInitialLoading ? "" : initial}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ModeSwitcher mode={preferredMode} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur p-5 shadow-lg">
          <p className="text-[11px] tracking-widest text-white/70 font-medium">WALLET BALANCE</p>
          <p className="text-3xl font-bold mt-1">{formatNaira(walletBalance)}</p>
          <div className="flex gap-2 mt-4">
            <Link
              to="/wallet"
              className="flex-1 h-10 rounded-xl bg-[#F5A623] text-foreground text-sm font-semibold flex items-center justify-center active:scale-[0.98] transition-transform"
            >
              Withdraw
            </Link>
            <Link
              to="/wallet"
              className="flex-1 h-10 rounded-xl border border-white/60 text-white text-sm font-semibold flex items-center justify-center active:scale-[0.98] transition-transform"
            >
              History
            </Link>
          </div>
        </div>
      </header>

      <section className="px-5 -mt-14">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Briefcase className="h-4 w-4 text-primary" />}
            value={String(jobsDone)}
            label="Jobs Done"
          />
          <StatCard
            icon={<Star className="h-4 w-4 text-accent" fill="currentColor" />}
            value={rating != null ? String(rating) : "—"}
            label="Rating"
          />
          <StatCard
            icon={<Award className="h-4 w-4 text-primary" />}
            value={jobsDone >= 20 ? "Gold" : jobsDone >= 5 ? "Silver" : "Starter"}
            label="Level"
          />
        </div>
      </section>

      {preferredMode === "client" ? (
        <section className="mt-6 px-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-bold text-foreground">Need something done?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Post a job and connect with trusted workers across Nigeria.
            </p>
            <Link
              to="/post-job"
              className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-semibold text-sm"
            >
              Post a job
            </Link>
          </div>
        </section>
      ) : null}

      {/* Optional category filter — does not hide by default */}
      <section className="mt-6">
        <h2 className="px-5 text-base font-bold text-foreground mb-3">Categories</h2>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className="flex-shrink-0 flex flex-col items-center gap-2 w-20"
            >
              <div
                className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center text-2xl border-2 transition-colors",
                  c.tint,
                  category === c.id ? "border-primary ring-2 ring-primary/30" : "border-transparent",
                )}
              >
                {c.emoji}
              </div>
              <span className="text-xs font-medium text-foreground">{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 px-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">
            {preferredMode === "client" ? "Open jobs on the platform" : "Jobs for you"}
          </h2>
          <Link to="/search" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="space-y-3">
          {loadingJobs ? (
            <p className="text-center text-sm text-muted-foreground py-6">Loading jobs…</p>
          ) : rankedJobs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No open jobs yet. Check back soon!
            </p>
          ) : (
            rankedJobs.slice(0, 15).map(({ job, distanceKm }) => {
              const { Icon, tint } = pickJobIcon(job.type);
              return (
                <Link
                  key={job.id}
                  to="/jobs/$jobId"
                  params={{ jobId: job.id }}
                  className="block rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99] transition-transform"
                >
                  <div className="flex gap-3">
                    <div className={cn("h-12 w-12 flex-shrink-0 rounded-xl flex items-center justify-center", tint)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-foreground text-sm leading-tight">{job.title}</p>
                        <p className="text-primary font-bold text-sm whitespace-nowrap">
                          {formatNaira(job.budget_max ?? job.budget_min)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {job.location ?? "Remote"}
                        </p>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceKm(distanceKm)}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Tag>{job.type === "digital" ? "Digital" : "Physical"}</Tag>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
}
