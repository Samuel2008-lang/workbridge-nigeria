import { createFileRoute, Link } from "@tanstack/react-router";
import { Search as SearchIcon, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";

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
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "digital" | "physical">("all");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, description, type, location, budget_min, budget_max, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100);
      if (active) {
        setJobs((data ?? []) as Job[]);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter !== "all" && j.type !== filter) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        (j.description ?? "").toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, query, filter]);

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
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No jobs match your search.</p>
          </div>
        ) : (
          filtered.map((j) => (
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
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                <span className="capitalize px-2 py-0.5 rounded-full bg-muted font-semibold">
                  {j.type}
                </span>
                {j.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {j.location}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </MobileShell>
  );
}
