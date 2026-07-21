import { createFileRoute, Link } from "@tanstack/react-router";
import { Search as SearchIcon, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { scoreJobAgainstInterests } from "@/lib/job-interests";
import { formatDistanceKm, haversineKm } from "@/lib/distance";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search Jobs — WorkBridge" }] }),
  component: SearchScreen,
});

type Job = {
  id: string;
  title: string;
  description: string | null;
  type: "digital" | "physical";
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  created_at: string;
};

function formatNaira(n: number | null) {
  if (n == null) return "—";
  return `₦${Number(n).toLocaleString("en-NG")}`;
}

function SearchScreen() {
  const { profile } = useProfile();
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "digital" | "physical">("all");
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
      // All open jobs — never hide by distance
      const { data } = await supabase
        .from("jobs")
        .select("id, title, description, type, location, latitude, longitude, budget_min, budget_max, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(200);
      if (active) {
        setJobs((data ?? []) as Job[]);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const ranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    const interests = profile?.job_interests ?? [];
    return jobs
      .filter((j) => {
        if (filter !== "all" && j.type !== filter) return false;
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          (j.description ?? "").toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q)
        );
      })
      .map((j) => {
        let distanceKm: number | null = null;
        if (
          userCoords &&
          j.latitude != null &&
          j.longitude != null &&
          !Number.isNaN(Number(j.latitude))
        ) {
          distanceKm = haversineKm(
            userCoords.lat,
            userCoords.lon,
            Number(j.latitude),
            Number(j.longitude),
          );
        }
        const interestScore = scoreJobAgainstInterests(j.title, j.description, interests);
        const nearScore =
          distanceKm == null ? 0 : distanceKm < 5 ? 30 : distanceKm < 20 ? 15 : distanceKm < 50 ? 5 : 0;
        return { job: j, distanceKm, rank: interestScore * 10 + nearScore };
      })
      .sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm != null) return -1;
        if (b.distanceKm != null) return 1;
        return 0;
      });
  }, [jobs, query, filter, profile?.job_interests, userCoords]);

  return (
    <MobileShell>
      <header className="px-5 pt-7 pb-4 bg-card border-b border-border">
        <h1 className="text-2xl font-bold text-foreground mb-3">Search Jobs</h1>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Plumbing, transcription, cleaning…"
            className="w-full h-12 pl-12 pr-4 rounded-2xl border-2 border-border bg-background text-base focus:border-primary outline-none"
          />
        </div>
        <div className="flex gap-2 mt-3">
          {(["all", "digital", "physical"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 h-9 rounded-full text-xs font-semibold border-2 capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="px-5 py-5 space-y-3">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-10">Loading jobs…</p>
        ) : ranked.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No jobs match your search.</p>
          </div>
        ) : (
          ranked.map(({ job: j, distanceKm }) => (
            <Link
              key={j.id}
              to="/jobs/$jobId"
              params={{ jobId: j.id }}
              className="block rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-foreground text-sm flex-1">{j.title}</p>
                <p className="text-primary font-bold text-sm whitespace-nowrap">
                  {formatNaira(j.budget_max ?? j.budget_min)}
                </p>
              </div>
              {j.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{j.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                <span className="capitalize px-2 py-0.5 rounded-full bg-muted font-semibold">
                  {j.type}
                </span>
                {j.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {j.location}
                  </span>
                )}
                <span className="font-medium">{formatDistanceKm(distanceKm)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </MobileShell>
  );
}
