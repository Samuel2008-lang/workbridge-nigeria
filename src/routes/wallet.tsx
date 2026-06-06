import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Plus, Wallet as WalletIcon, Building2, Check } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "My Wallet — WorkBridge" },
      { name: "description", content: "Manage your WorkBridge earnings and withdrawals." },
    ],
  }),
  component: WalletScreen,
});

type Tx = {
  id: string;
  type: "in" | "out";
  description: string;
  amount: number;
  date: string;
};

const TRANSACTIONS: Tx[] = [
  { id: "1", type: "in", description: "Payment for Plumbing Job", amount: 8500, date: "Today · 2:14 PM" },
  { id: "2", type: "out", description: "Withdrawal to GTBank ••3421", amount: 10000, date: "Yesterday · 9:02 AM" },
  { id: "3", type: "in", description: "Payment for Cleaning Job", amount: 12000, date: "Jun 3 · 5:48 PM" },
  { id: "4", type: "in", description: "Payment for Delivery", amount: 3500, date: "Jun 2 · 11:20 AM" },
  { id: "5", type: "out", description: "Withdrawal to Opay ••8810", amount: 5000, date: "May 30 · 6:31 PM" },
  { id: "6", type: "in", description: "Payment for Writing Job", amount: 5000, date: "May 28 · 1:05 PM" },
];

const PAYMENT_METHODS = [
  { id: "card1", label: "Verve •• 4421", sub: "Expires 09/27" },
  { id: "card2", label: "Mastercard •• 8810", sub: "Expires 11/26" },
];

const BANK_ACCOUNTS = [
  { id: "b1", bank: "GTBank", number: "•• 3421", name: "Amara O." },
  { id: "b2", bank: "Opay", number: "•• 8810", name: "Amara O." },
];

function formatNaira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function WalletScreen() {
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0].id);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedBank, setSelectedBank] = useState(BANK_ACCOUNTS[0].id);

  const withdrawValue = Number(withdrawAmount) || 0;
  const withdrawError =
    withdrawAmount && withdrawValue < 500
      ? "Minimum withdrawal is ₦500"
      : "";

  const handleAddMoney = () => {
    const n = Number(addAmount);
    if (!n || n <= 0) {
      toast.error("Enter an amount to add");
      return;
    }
    toast.success(`Opening Paystack for ${formatNaira(n)}…`);
    setAddOpen(false);
    setAddAmount("");
  };

  const handleWithdraw = () => {
    if (!withdrawValue || withdrawError) {
      toast.error(withdrawError || "Enter an amount");
      return;
    }
    toast.success(`Withdrawal of ${formatNaira(withdrawValue)} requested`);
    setWithdrawOpen(false);
    setWithdrawAmount("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="px-5 pt-7 pb-8 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Link to="/home" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <h1 className="text-lg font-bold">My Wallet</h1>
        </div>

        <p className="text-xs tracking-widest text-white/70 font-medium">CURRENT BALANCE</p>
        <p className="text-4xl font-bold mt-1">{formatNaira(45200)}</p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setAddOpen(true)}
            className="flex-1 h-12 rounded-xl bg-white text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Plus className="h-4 w-4" /> Add Money
          </button>
          <button
            onClick={() => setWithdrawOpen(true)}
            className="flex-1 h-12 rounded-xl bg-[#F5A623] text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <ArrowUpRight className="h-4 w-4" /> Withdraw
          </button>
        </div>
      </header>

      {/* Transactions */}
      <section className="px-5 mt-6">
        <h2 className="text-base font-bold text-foreground mb-2">Transaction History</h2>
        <div className="rounded-2xl border border-border bg-card">
          {TRANSACTIONS.map((tx, i) => (
            <div key={tx.id}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                    tx.type === "in" ? "bg-emerald-100" : "bg-rose-100",
                  )}
                >
                  {tx.type === "in" ? (
                    <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5 text-rose-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tx.date}</p>
                </div>
                <p
                  className={cn(
                    "text-sm font-bold whitespace-nowrap",
                    tx.type === "in" ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {tx.type === "in" ? "+" : "−"}
                  {formatNaira(tx.amount)}
                </p>
              </div>
              {i < TRANSACTIONS.length - 1 && <div className="h-px bg-border mx-4" />}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 mb-8">
          Withdrawals arrive within 1 to 2 business days
        </p>
      </section>

      {/* Add Money Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[90vh] overflow-y-auto">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Add Money</SheetTitle>
            <SheetDescription>Top up your wallet via Paystack</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-6 pt-4 space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                  ₦
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0"
                  className="w-full h-14 pl-9 pr-4 rounded-2xl border-2 border-border bg-card text-lg font-semibold focus:border-primary outline-none"
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Payment method</p>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-colors",
                      selectedMethod === m.id ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                      <WalletIcon className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.sub}</p>
                    </div>
                    {selectedMethod === m.id && <Check className="h-5 w-5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleAddMoney}
              className="w-full h-14 rounded-2xl text-base font-semibold"
            >
              Pay with Paystack
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Withdraw Sheet */}
      <Sheet open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[90vh] overflow-y-auto">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Withdraw</SheetTitle>
            <SheetDescription>Minimum withdrawal is ₦500</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-6 pt-4 space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                  ₦
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="500"
                  className="w-full h-14 pl-9 pr-4 rounded-2xl border-2 border-border bg-card text-lg font-semibold focus:border-primary outline-none"
                />
              </div>
              {withdrawError && (
                <p className="text-xs text-destructive mt-1.5">{withdrawError}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Send to</p>
              <div className="space-y-2">
                {BANK_ACCOUNTS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBank(b.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-colors",
                      selectedBank === b.id ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">
                        {b.bank} <span className="text-muted-foreground font-normal">{b.number}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{b.name}</p>
                    </div>
                    {selectedBank === b.id && <Check className="h-5 w-5 text-primary" />}
                  </button>
                ))}
                <button className="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-border text-foreground active:scale-[0.99]">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold">Add New Bank Account</span>
                </button>
              </div>
            </div>

            <Button
              onClick={handleWithdraw}
              className="w-full h-14 rounded-2xl text-base font-semibold"
            >
              Confirm Withdrawal
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Withdrawals arrive within 1 to 2 business days
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
