import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Calendar, Briefcase, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/jobs/$jobId")({
  head: () => ({ meta: [{ title: "Job — WorkBridge" }] }),
  component: JobDetailScreen,
});

type Job = {
  id: string;
  client_id: string;
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

function JobDetailScreen() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [clientName, setClientName] = useState<string>("Client");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (active) setMe(user?.id ?? null);

      const { data: j } = await supabase
        .from("jobs")
        .select("id, client_id, title, description, type, location, budget_min, budget_max, status, created_at")
        .eq("id", jobId)
        .maybeSingle();
      if (active && j) {
        setJob(j as Job);
        const { data: c } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", j.client_id)
          .maybeSingle();
        if (active && c?.full_name) setClientName(c.full_name);

        if (user) {
          const { data: existing } = await supabase
            .from("applications")
            .select("id")
            .eq("job_id", j.id)
            .eq("worker_id", user.id)
            .maybeSingle();
          if (active) setApplied(!!existing);
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [jobId]);

  const handleApply = async () => {
    if (!me || !job) {
      toast.error("Please log in to apply");
      navigate({ to: "/login" });
      return;
    }
    if (me === job.client_id) {
      toast.error("You can't apply to your own job");
      return;
    }
    setApplying(true);
    const { error } = await supabase.from("applications").insert({
      job_id: job.id,
      worker_id: me,
      status: "pending",
      proposed_price: job.budget_max ?? job.budget_min ?? null,
    });
    setApplying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setApplied(true);
    toast.success("Application sent");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <p className="text-base font-bold text-foreground">Job not found</p>
        <Link to="/search" className="mt-3 text-sm text-primary font-semibold">
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header
        className="px-5 pt-7 pb-6 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}
      >
        <button
          onClick={() => navigate({ to: "/search" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="inline-block px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wide">
          {job.type}
        </span>
        <h1 className="text-2xl font-bold mt-2 leading-tight">{job.title}</h1>
        <p className="text-3xl font-bold mt-4">
          {formatNaira(job.budget_min)} – {formatNaira(job.budget_max)}
        </p>
      </header>

      <section className="px-5 mt-5 space-y-3">
        <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={job.location ?? "Remote"} />
        <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Posted by" value={clientName} />
        <InfoRow
          icon={<Calendar className="h-4 w-4" />}
          label="Posted"
          value={new Date(job.created_at).toLocaleDateString()}
        />
      </section>

      {job.description && (
        <section className="px-5 mt-6">
          <h2 className="text-sm font-bold text-foreground mb-2">Description</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {job.description}
          </p>
        </section>
      )}

      <div className="fixed bottom-0 inset-x-0 mx-auto max-w-md p-5 bg-background border-t border-border">
        <Button
          onClick={handleApply}
          disabled={applying || applied || job.status !== "open"}
          className="w-full h-14 rounded-2xl text-base font-semibold"
        >
          {applied
            ? "Application sent ✓"
            : applying
              ? "Sending…"
              : job.status !== "open"
                ? "Job closed"
                : "Apply for this job"}
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
