import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, Plus, Lock, Clock, ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "My Wallet — WorkBridge" },
      { name: "description", content: "Manage your WorkBridge earnings, escrow and withdrawals." },
    ],
  }),
  component: WalletScreen,
});

type Wallet = {
  available_balance: number;
  pending_balance: number;
  frozen_balance: number;
  pin_hash: string | null;
};
type Tx = {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  balance_bucket: string | null;
  created_at: string;
  sender_id: string;
  receiver_id: string;
};

function formatNaira(n: number) {
  return `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function daysUntil(date: string | null) {
  if (!date) return null;
  const diffMs = new Date(date).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function WalletScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [frozenJobs, setFrozenJobs] = useState<{ id: string; amount: number; frozen_until: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // sheets
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // form state
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPin, setWithdrawPin] = useState("");
  const [addAmount, setAddAmount] = useState("");

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [{ data: w }, { data: t }, { data: jobs }] = await Promise.all([
      supabase.from("wallets").select("available_balance,pending_balance,frozen_balance,pin_hash")
        .eq("user_id", user.id).maybeSingle(),
      supabase.from("transactions").select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false }).limit(30),
      supabase.from("jobs").select("id, agreed_amount, frozen_until, commission_amount")
        .eq("hired_worker_id", user.id).eq("escrow_status", "frozen"),
    ]);

    setWallet(w as Wallet | null);
    setTxs((t || []) as Tx[]);
    setFrozenJobs(
      (jobs || []).map((j: any) => ({
        id: j.id,
        amount: Number(j.agreed_amount) - Number(j.commission_amount || 0),
        frozen_until: j.frozen_until,
      })),
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const total = wallet
    ? Number(wallet.available_balance) + Number(wallet.pending_balance) + Number(wallet.frozen_balance)
    : 0;

  async function handleSetPin() {
    if (!/^\d{4}$/.test(newPin)) { toast.error("PIN must be 4 digits"); return; }
    if (newPin !== newPinConfirm) { toast.error("PINs do not match"); return; }
    const { data, error } = await supabase.rpc("set_wallet_pin", { _pin: newPin });
    if (error) { toast.error(error.message); return; }
    toast.success("Wallet PIN set");
    setPinSetupOpen(false);
    setNewPin(""); setNewPinConfirm("");
    await load();
  }

  async function handleWithdraw() {
    const amt = Number(withdrawAmount);
    if (!amt || amt < 500) { toast.error("Minimum withdrawal is ₦500"); return; }
    if (!/^\d{4}$/.test(withdrawPin)) { toast.error("Enter your 4-digit PIN"); return; }
    const { data, error } = await supabase.rpc("withdraw_from_wallet", { _amount: amt, _pin: withdrawPin });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.ok) {
      const msg = res?.error === "invalid_pin" ? "Wrong PIN"
        : res?.error === "insufficient_funds" ? "Not enough available balance"
        : res?.error === "pin_not_set" ? "Set up your PIN first"
        : "Withdrawal failed";
      toast.error(msg);
      return;
    }
    toast.success(`₦${amt.toLocaleString()} withdrawal requested — arrives within minutes to a few hours`);
    setWithdrawOpen(false); setWithdrawAmount(""); setWithdrawPin("");
    await load();
  }

  async function handleAddMoney() {
    const amt = Number(addAmount);
    if (!amt || amt < 100) { toast.error("Enter at least ₦100"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please log in"); return; }
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    // Load Flutterwave inline script
    const w = window as any;
    if (!w.FlutterwaveCheckout) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://checkout.flutterwave.com/v3.js";
        s.onload = () => resolve(); s.onerror = () => reject(new Error("script"));
        document.head.appendChild(s);
      }).catch(() => {});
    }
    const pubKey = (import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY as string) || "FLWPUBK_TEST-SANDBOXDEMOKEY-X";
    const txRef = `WB-${user.id}-${Date.now()}`;
    if (!w.FlutterwaveCheckout) { toast.error("Payment SDK failed to load"); return; }
    setAddOpen(false);
    w.FlutterwaveCheckout({
      public_key: pubKey,
      tx_ref: txRef,
      amount: amt,
      currency: "NGN",
      payment_options: "card,ussd,banktransfer",
      customer: { email: user.email, name: prof?.full_name || user.email },
      customizations: { title: "WorkBridge Wallet Top-up", description: "Add money to your wallet" },
      redirect_url: window.location.origin + "/wallet",
      callback: async (resp: any) => {
        try {
          const { data, error } = await supabase.functions.invoke("flutterwave-verify", {
            body: { transaction_id: resp.transaction_id, tx_ref: txRef, expected_amount: amt },
          });
          if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message || "Verify failed");
          toast.success(`₦${amt.toLocaleString()} has been added to your wallet successfully!`);
          await load();
        } catch (e: any) { toast.error(e.message || "Payment verification failed"); }
      },
      onclose: () => {},
    });
    setAddAmount("");
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header with TOTAL */}
      <header className="px-5 pt-7 pb-6 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}>
        <div className="flex items-center gap-3 mb-5">
          <Link to="/home" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <h1 className="text-lg font-bold">My Wallet</h1>
        </div>
        <p className="text-xs tracking-widest text-white/70 font-medium">TOTAL BALANCE</p>
        <p className="text-4xl font-bold mt-1">{loading ? "—" : formatNaira(total)}</p>

        <div className="flex gap-3 mt-5">
          <button onClick={() => setAddOpen(true)}
            className="flex-1 h-12 rounded-xl bg-white text-foreground text-sm font-semibold flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Add Money
          </button>
          <button onClick={() => {
            if (!wallet?.pin_hash) { setPinSetupOpen(true); return; }
            setWithdrawOpen(true);
          }} className="flex-1 h-12 rounded-xl bg-[#F5A623] text-foreground text-sm font-semibold flex items-center justify-center gap-2">
            <ArrowUpRight className="h-4 w-4" /> Withdraw
          </button>
        </div>
      </header>

      {/* Three balance cards */}
      <section className="px-5 mt-5 space-y-3">
        {/* Available */}
        <div className="rounded-2xl border-l-4 border-emerald-500 bg-card p-4 flex items-center gap-3 shadow-sm">
          <div className="h-11 w-11 rounded-full bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Available</p>
            <p className="text-xl font-bold text-foreground">{formatNaira(wallet?.available_balance ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Free to withdraw or use</p>
          </div>
        </div>

        {/* Pending (escrow) */}
        <div className="rounded-2xl border-l-4 border-amber-500 bg-card p-4 flex items-center gap-3 shadow-sm">
          <div className="h-11 w-11 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending</p>
            <p className="text-xl font-bold text-foreground">{formatNaira(wallet?.pending_balance ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Locked in escrow for active jobs</p>
          </div>
        </div>

        {/* Frozen */}
        <div className="rounded-2xl border-l-4 border-sky-500 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-sky-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-sky-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Frozen</p>
              <p className="text-xl font-bold text-foreground">{formatNaira(wallet?.frozen_balance ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Auto-confirmed — unlocks soon</p>
            </div>
          </div>
          {frozenJobs.length > 0 && (
            <ul className="mt-3 space-y-1.5 pl-14">
              {frozenJobs.map((fj) => {
                const d = daysUntil(fj.frozen_until);
                return (
                  <li key={fj.id} className="text-xs text-sky-700 flex items-center justify-between">
                    <span>{formatNaira(fj.amount)}</span>
                    <span className="font-medium">
                      {d === 0 ? "Available within hours" : `Available in ${d} day${d === 1 ? "" : "s"}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Transactions */}
      <section className="px-5 mt-6">
        <h2 className="text-base font-bold text-foreground mb-2">Transaction History</h2>
        <div className="rounded-2xl border border-border bg-card">
          {loading ? (
            <p className="p-5 text-center text-sm text-muted-foreground">Loading…</p>
          ) : txs.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            txs.map((tx, i) => {
              const incoming = tx.receiver_id === userId && tx.sender_id !== userId;
              const isOut = tx.type === "withdrawal" || (tx.sender_id === userId && tx.receiver_id !== userId);
              return (
                <div key={tx.id}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                      isOut ? "bg-rose-100" : "bg-emerald-100",
                    )}>
                      {isOut
                        ? <ArrowUpRight className="h-5 w-5 text-rose-600" />
                        : <ArrowDownLeft className="h-5 w-5 text-emerald-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {tx.description || tx.type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(tx.created_at).toLocaleString()} · {tx.status}
                      </p>
                    </div>
                    <p className={cn("text-sm font-bold whitespace-nowrap",
                      isOut ? "text-rose-600" : "text-emerald-600")}>
                      {isOut ? "−" : "+"}{formatNaira(tx.amount)}
                    </p>
                  </div>
                  {i < txs.length - 1 && <div className="h-px bg-border mx-4" />}
                </div>
              );
            })
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-6">
          Withdrawals via Flutterwave arrive within minutes to a few hours. Minimum ₦500.
        </p>
      </section>

      {/* PIN setup sheet */}
      <Sheet open={pinSetupOpen} onOpenChange={setPinSetupOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Set up your withdrawal PIN</SheetTitle>
            <SheetDescription>4 digits — required for every withdrawal.</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-6 pt-4 space-y-4">
            <input inputMode="numeric" maxLength={4} value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter 4-digit PIN"
              className="w-full h-14 px-4 rounded-2xl border-2 border-border bg-card text-lg font-semibold tracking-[0.5em] text-center" />
            <input inputMode="numeric" maxLength={4} value={newPinConfirm}
              onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ""))}
              placeholder="Confirm PIN"
              className="w-full h-14 px-4 rounded-2xl border-2 border-border bg-card text-lg font-semibold tracking-[0.5em] text-center" />
            <Button onClick={handleSetPin} className="w-full h-14 rounded-2xl text-base font-semibold">
              Save PIN
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Withdraw sheet */}
      <Sheet open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Withdraw</SheetTitle>
            <SheetDescription>
              Available: {formatNaira(wallet?.available_balance ?? 0)} · Minimum ₦500
            </SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-6 pt-4 space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">₦</span>
              <input type="number" inputMode="numeric" value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="500"
                className="w-full h-14 pl-9 pr-4 rounded-2xl border-2 border-border bg-card text-lg font-semibold" />
            </div>
            <input inputMode="numeric" maxLength={4} value={withdrawPin}
              onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Wallet PIN"
              className="w-full h-14 px-4 rounded-2xl border-2 border-border bg-card text-lg font-semibold tracking-[0.5em] text-center" />
            <Button onClick={handleWithdraw} className="w-full h-14 rounded-2xl text-base font-semibold">
              Confirm Withdrawal
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Withdrawals are processed via Flutterwave.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add money sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Add Money</SheetTitle>
            <SheetDescription>Top up your wallet via Flutterwave.</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-6 pt-4 space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">₦</span>
              <input type="number" inputMode="numeric" value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)} placeholder="0"
                className="w-full h-14 pl-9 pr-4 rounded-2xl border-2 border-border bg-card text-lg font-semibold" />
            </div>
            <Button onClick={handleAddMoney} className="w-full h-14 rounded-2xl text-base font-semibold">
              Continue to Flutterwave
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
