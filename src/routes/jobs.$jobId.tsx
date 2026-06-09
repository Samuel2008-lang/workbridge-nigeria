import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Calendar, Briefcase, Loader2, MessageCircle, AlertTriangle, Star } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
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
  hired_worker_id: string | null;
  title: string;
  description: string | null;
  type: "digital" | "physical";
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  agreed_amount: number | null;
  status: string;
  escrow_status: string;
  completed_at: string | null;
  confirm_deadline: string | null;
  created_at: string;
};

type Application = {
  id: string;
  worker_id: string;
  proposed_price: number | null;
  status: string;
  worker_name?: string;
};

const naira = (n: number | null | undefined) =>
  n == null ? "—" : `₦${Number(n).toLocaleString("en-NG")}`;

function JobDetailScreen() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [clientName, setClientName] = useState("Client");
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id ?? null);

    const { data: j } = await supabase
      .from("jobs")
      .select("id, client_id, hired_worker_id, title, description, type, location, budget_min, budget_max, agreed_amount, status, escrow_status, completed_at, confirm_deadline, created_at")
      .eq("id", jobId)
      .maybeSingle();
    if (!j) { setLoading(false); return; }
    setJob(j as Job);

    const { data: c } = await supabase.from("profiles").select("full_name").eq("id", j.client_id).maybeSingle();
    if (c?.full_name) setClientName(c.full_name);

    if (user?.id === j.client_id) {
      const { data: a } = await supabase
        .from("applications")
        .select("id, worker_id, proposed_price, status")
        .eq("job_id", j.id)
        .order("created_at", { ascending: false });
      if (a && a.length) {
        const ids = a.map((x) => x.worker_id);
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name as string]));
        setApps(a.map((x) => ({ ...x, worker_name: nameMap.get(x.worker_id) ?? "Worker" })));
      }
    } else if (user) {
      const { data: existing } = await supabase
        .from("applications").select("id").eq("job_id", j.id).eq("worker_id", user.id).maybeSingle();
      setApplied(!!existing);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const handleApply = async () => {
    if (!me || !job) return navigate({ to: "/login" });
    if (me === job.client_id) return toast.error("Can't apply to your own job");
    setBusy(true);
    const { error } = await supabase.from("applications").insert({
      job_id: job.id, worker_id: me, status: "pending",
      proposed_price: job.budget_max ?? job.budget_min ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setApplied(true);
    toast.success("Application sent");
  };

  const handleHire = async (app: Application) => {
    if (!job) return;
    const amount = app.proposed_price ?? job.budget_max ?? job.budget_min;
    if (!amount) return toast.error("No agreed amount");
    if (!confirm(`Hire this worker for ${naira(amount)}? Funds will be locked in escrow.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("hire_worker", {
      _job_id: job.id, _worker_id: app.worker_id, _amount: amount,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const result = data as { ok: boolean; error?: string };
    if (!result?.ok) {
      if (result?.error === "insufficient_funds") return toast.error("Top up your wallet first");
      return toast.error(result?.error ?? "Hire failed");
    }
    toast.success("Worker hired — funds locked");
    load();
  };

  const handleMarkComplete = async () => {
    if (!job) return;
    setBusy(true);
    const { error } = await supabase.rpc("mark_job_complete", { _job_id: job.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Marked complete — client has 48h to confirm");
    load();
  };

  const handleConfirm = async () => {
    if (!job) return;
    setBusy(true);
    const { error } = await supabase.rpc("confirm_job_complete", { _job_id: job.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Confirmed — payment released");
    load();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!job) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <p className="text-base font-bold text-foreground">Job not found</p>
      <Link to="/search" className="mt-3 text-sm text-primary font-semibold">Back to search</Link>
    </div>
  );

  const isClient = me === job.client_id;
  const isWorker = me === job.hired_worker_id;
  const otherPartyId = isClient ? job.hired_worker_id : job.client_id;
  const showHire = isClient && job.escrow_status === "none" && apps.length > 0;
  const showMarkComplete = isWorker && job.escrow_status === "locked" && !job.completed_at;
  const showConfirm = isClient && job.escrow_status === "locked" && !!job.completed_at;
  const canDispute = (isClient || isWorker) && ["locked", "frozen"].includes(job.escrow_status);
  const canRate = (isClient || isWorker) && job.escrow_status === "released";
  const canApply = !me || (!isClient && job.status === "open" && job.escrow_status === "none");

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="px-5 pt-7 pb-6 text-white" style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}>
        <button onClick={() => navigate({ to: "/search" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 mb-4">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="inline-block px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wide">{job.type}</span>
        <h1 className="text-2xl font-bold mt-2 leading-tight">{job.title}</h1>
        <p className="text-3xl font-bold mt-4">
          {job.agreed_amount ? naira(job.agreed_amount) : `${naira(job.budget_min)} – ${naira(job.budget_max)}`}
        </p>
        <div className="mt-3 flex gap-2 text-[11px] uppercase tracking-wide">
          <span className="px-2 py-0.5 rounded bg-white/20">{job.status}</span>
          {job.escrow_status !== "none" && <span className="px-2 py-0.5 rounded bg-white/20">Escrow: {job.escrow_status}</span>}
        </div>
      </header>

      <section className="px-5 mt-5 space-y-3">
        <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={job.location ?? "Remote"} />
        <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Posted by" value={clientName} />
        <InfoRow icon={<Calendar className="h-4 w-4" />} label="Posted" value={new Date(job.created_at).toLocaleDateString()} />
      </section>

      {job.description && (
        <section className="px-5 mt-6">
          <h2 className="text-sm font-bold text-foreground mb-2">Description</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{job.description}</p>
        </section>
      )}

      {isClient && apps.length > 0 && (
        <section className="px-5 mt-6">
          <h2 className="text-sm font-bold text-foreground mb-2">Applicants ({apps.length})</h2>
          <ul className="space-y-2">
            {apps.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {a.worker_name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{a.worker_name}</p>
                  <p className="text-xs text-muted-foreground">Proposed: {naira(a.proposed_price)}</p>
                </div>
                {showHire ? (
                  <Button size="sm" onClick={() => handleHire(a)} disabled={busy}>Hire</Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">{a.status}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {job.completed_at && job.confirm_deadline && job.escrow_status === "locked" && (
        <section className="px-5 mt-6">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-900 text-sm">
            <p className="font-semibold">Awaiting client confirmation</p>
            <p className="mt-1 text-xs">Auto-releases by {new Date(job.confirm_deadline).toLocaleString()}</p>
          </div>
        </section>
      )}

      <div className="fixed bottom-0 inset-x-0 mx-auto max-w-md p-5 bg-background border-t border-border space-y-2">
        {otherPartyId && (
          <Link to="/chat/$jobId/$otherId" params={{ jobId: job.id, otherId: otherPartyId }}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl border border-border text-sm font-semibold">
            <MessageCircle className="h-4 w-4" /> Open chat
          </Link>
        )}
        {showMarkComplete && (
          <Button onClick={handleMarkComplete} disabled={busy} className="w-full h-14 rounded-2xl text-base font-semibold">Mark job complete</Button>
        )}
        {showConfirm && (
          <Button onClick={handleConfirm} disabled={busy} className="w-full h-14 rounded-2xl text-base font-semibold">Confirm & release payment</Button>
        )}
        {canRate && (
          <Link to="/rate/$jobId" params={{ jobId: job.id }}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold">
            <Star className="h-4 w-4" /> Leave a rating
          </Link>
        )}
        {canDispute && (
          <Link to="/dispute/$jobId" params={{ jobId: job.id }}
            className="flex items-center justify-center gap-2 w-full h-11 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Report a problem
          </Link>
        )}
        {canApply && (
          <Button onClick={handleApply} disabled={busy || applied} className="w-full h-14 rounded-2xl text-base font-semibold">
            {applied ? "Application sent ✓" : busy ? "Sending…" : "Apply for this job"}
          </Button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
