import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Shield, Users, Briefcase, AlertTriangle, DollarSign, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "hopeegbon28@gmail.com";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — WorkBridge" }] }),
  component: AdminDashboard,
});

type Tab = "overview" | "disputes" | "users" | "jobs" | "transactions";

function fmt(n: any) { return `₦${Number(n || 0).toLocaleString("en-NG")}`; }

function AdminDashboard() {
  const nav = useNavigate();
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || (user.email || "").toLowerCase() !== ADMIN_EMAIL) {
        toast.error("Not authorized");
        nav({ to: "/home" });
        setOk(false);
      } else setOk(true);
    })();
  }, [nav]);

  if (ok !== true) return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Checking access…</div>;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="px-5 pt-7 pb-6 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}>
        <div className="flex items-center gap-3">
          <Link to="/profile" className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <h1 className="text-lg font-bold">WorkBridge Admin</h1>
          </div>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto px-3 py-3 border-b border-border bg-card">
        {([
          ["overview", "Overview", LayoutDashboard],
          ["disputes", "Disputes", AlertTriangle],
          ["users", "Users", Users],
          ["jobs", "Jobs", Briefcase],
          ["transactions", "Money", DollarSign],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={cn("flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold whitespace-nowrap",
              tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      <div className="p-4">
        {tab === "overview" && <OverviewTab />}
        {tab === "disputes" && <DisputesTab />}
        {tab === "users" && <UsersTab />}
        {tab === "jobs" && <JobsTab />}
        {tab === "transactions" && <TxTab />}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-sm">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

function OverviewTab() {
  const [s, setS] = useState<any>({});
  useEffect(() => { (async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const iso = today.toISOString();
    const [u, workers, clients, jobs, jobsDone, jobsProg, disputes, disputesRes, newUsers, newJobs, comm, escrow] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "worker"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
      supabase.from("jobs").select("id", { count: "exact", head: true }),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "assigned"),
      supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "resolved"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso),
      supabase.from("jobs").select("id", { count: "exact", head: true }).gte("created_at", iso),
      supabase.from("jobs").select("commission_amount").not("commission_amount", "is", null),
      supabase.from("jobs").select("agreed_amount").eq("escrow_status", "locked"),
    ]);
    setS({
      users: u.count, workers: workers.count, clients: clients.count,
      jobs: jobs.count, done: jobsDone.count, prog: jobsProg.count,
      disputes: disputes.count, disputesRes: disputesRes.count,
      newUsers: newUsers.count, newJobs: newJobs.count,
      commission: (comm.data || []).reduce((a: number, r: any) => a + Number(r.commission_amount || 0), 0),
      escrow: (escrow.data || []).reduce((a: number, r: any) => a + Number(r.agreed_amount || 0), 0),
    });
  })(); }, []);
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Total users" value={s.users ?? "—"} />
      <StatCard label="Workers" value={s.workers ?? "—"} />
      <StatCard label="Clients" value={s.clients ?? "—"} />
      <StatCard label="Total jobs" value={s.jobs ?? "—"} />
      <StatCard label="Completed" value={s.done ?? "—"} />
      <StatCard label="In progress" value={s.prog ?? "—"} />
      <StatCard label="Disputes open" value={s.disputes ?? "—"} />
      <StatCard label="Disputes resolved" value={s.disputesRes ?? "—"} />
      <StatCard label="New users today" value={s.newUsers ?? "—"} />
      <StatCard label="New jobs today" value={s.newJobs ?? "—"} />
      <StatCard label="Commission earned" value={fmt(s.commission)} />
      <StatCard label="Money in escrow" value={fmt(s.escrow)} />
    </div>
  );
}

function DisputesTab() {
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pct, setPct] = useState(50);
  const load = async () => {
    const { data } = await supabase.from("disputes")
      .select("*, jobs:job_id(title, agreed_amount, client_id, hired_worker_id)")
      .eq("status", "open").order("created_at", { ascending: false });
    setList(data || []);
  };
  useEffect(() => { load(); }, []);
  const resolve = async (id: string, decision: string, worker_pct = 100) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_resolve_dispute", { _dispute_id: id, _decision: decision, _worker_pct: worker_pct });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Resolved"); load(); }
  };
  if (list.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No open disputes 🎉</p>;
  return (
    <div className="space-y-3">
      {list.map(d => (
        <div key={d.id} className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <p className="font-bold text-sm">{d.jobs?.title || "Job"}</p>
          <p className="text-xs text-muted-foreground mt-1">Reason: {d.reason}</p>
          <p className="text-xs mt-1">Amount: {fmt(d.jobs?.agreed_amount)}</p>
          <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy === d.id} onClick={() => resolve(d.id, "release_worker")}
              className="bg-primary text-white text-xs">Release to worker</Button>
            <Button size="sm" disabled={busy === d.id} onClick={() => resolve(d.id, "refund_client")}
              className="bg-destructive text-white text-xs">Refund client</Button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="range" min={0} max={100} value={pct} onChange={e => setPct(Number(e.target.value))}
              className="flex-1" />
            <span className="text-xs w-16">Worker {pct}%</span>
            <Button size="sm" variant="outline" disabled={busy === d.id}
              onClick={() => resolve(d.id, "split", pct)} className="text-xs">Split</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { (async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    setList(data || []);
  })(); }, []);
  const filtered = list.filter(u => !q || (u.full_name || "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name"
        className="w-full h-11 px-4 rounded-xl border border-border bg-card mb-3 text-sm" />
      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.id} className="rounded-xl bg-card border border-border p-3 shadow-sm">
            <p className="font-semibold text-sm">{u.full_name || "Unnamed"}</p>
            <p className="text-xs text-muted-foreground">{u.role} · {u.location || "—"}</p>
            <p className="text-xs mt-1">
              Client ★ {u.client_rating} · Worker ★ {u.worker_rating}
              {u.cash_transaction_count > 0 && <span className="ml-2 text-amber-600">Cash × {u.cash_transaction_count}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobsTab() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState<string>("all");
  useEffect(() => { (async () => {
    let q = supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(100);
    if (f !== "all") q = q.eq("status", f as any);
    const { data } = await q; setList(data || []);
  })(); }, [f]);
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto mb-3">
        {["all", "open", "assigned", "completed", "cancelled"].map(s => (
          <button key={s} onClick={() => setF(s)}
            className={cn("px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap",
              f === s ? "bg-primary text-white" : "bg-muted")}>{s}</button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map(j => (
          <div key={j.id} className="rounded-xl bg-card border border-border p-3 shadow-sm">
            <p className="font-semibold text-sm">{j.title}</p>
            <p className="text-xs text-muted-foreground">{j.status} · {j.type} · {j.location || "—"}</p>
            <p className="text-xs mt-1">{fmt(j.agreed_amount || j.budget_max)} · escrow: {j.escrow_status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TxTab() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState<string>("all");
  useEffect(() => { (async () => {
    let q = supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(100);
    if (f !== "all") q = q.eq("type", f as any);
    const { data } = await q; setList(data || []);
  })(); }, [f]);
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto mb-3">
        {["all", "deposit", "withdrawal", "escrow", "release"].map(s => (
          <button key={s} onClick={() => setF(s)}
            className={cn("px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap",
              f === s ? "bg-primary text-white" : "bg-muted")}>{s}</button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map(t => (
          <div key={t.id} className="rounded-xl bg-card border border-border p-3 shadow-sm">
            <p className="font-semibold text-sm">{fmt(t.amount)} · {t.type}</p>
            <p className="text-xs text-muted-foreground">{t.status} · {new Date(t.created_at).toLocaleString()}</p>
            <p className="text-xs mt-1">{t.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
