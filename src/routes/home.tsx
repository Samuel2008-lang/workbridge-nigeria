import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Award, Briefcase, Wrench, Sparkles, Truck, PenLine, ChefHat, Leaf, ImageIcon } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { cn } from "@/lib/utils";

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
  { label: "Digital", emoji: "🖼️", icon: ImageIcon, tint: "bg-blue-100 text-blue-700" },
  { label: "Trades", emoji: "🔧", icon: Wrench, tint: "bg-amber-100 text-amber-700" },
  { label: "Cleaning", emoji: "🧹", icon: Sparkles, tint: "bg-emerald-100 text-emerald-700" },
  { label: "Delivery", emoji: "🚚", icon: Truck, tint: "bg-orange-100 text-orange-700" },
  { label: "Writing", emoji: "📝", icon: PenLine, tint: "bg-purple-100 text-purple-700" },
  { label: "Cooking", emoji: "🍳", icon: ChefHat, tint: "bg-rose-100 text-rose-700" },
  { label: "Gardening", emoji: "🌿", icon: Leaf, tint: "bg-lime-100 text-lime-700" },
];

const JOBS = [
  {
    id: "1",
    title: "Fix leaking kitchen sink",
    client: "Mrs. Adeyemi",
    rating: 4.8,
    pay: 8500,
    eta: "~2 hrs",
    type: "Physical",
    category: "Trades",
    tint: "bg-amber-100 text-amber-700",
    icon: Wrench,
  },
  {
    id: "2",
    title: "Transcribe 30-min interview audio",
    client: "BrightMedia Ltd",
    rating: 4.9,
    pay: 5000,
    eta: "~3 hrs",
    type: "Digital",
    category: "Writing",
    tint: "bg-purple-100 text-purple-700",
    icon: PenLine,
  },
  {
    id: "3",
    title: "Deep clean 2-bedroom apartment",
    client: "Tunde O.",
    rating: 4.7,
    pay: 12000,
    eta: "~4 hrs",
    type: "Physical",
    category: "Cleaning",
    tint: "bg-emerald-100 text-emerald-700",
    icon: Sparkles,
  },
  {
    id: "4",
    title: "Same-day package delivery to Ikeja",
    client: "QuickShip NG",
    rating: 4.6,
    pay: 3500,
    eta: "~1 hr",
    type: "Physical",
    category: "Delivery",
    tint: "bg-orange-100 text-orange-700",
    icon: Truck,
  },
];

function formatNaira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function HomeScreen() {
  return (
    <MobileShell>
      {/* Gradient header */}
      <header
        className="px-5 pt-7 pb-24 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70">Good morning 👋</p>
            <h1 className="text-2xl font-bold mt-0.5">Amara</h1>
          </div>
          <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold border border-white/30">
            A
          </div>
        </div>

        {/* Wallet card */}
        <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 backdrop-blur p-5 shadow-lg">
          <p className="text-[11px] tracking-widest text-white/70 font-medium">WALLET BALANCE</p>
          <p className="text-3xl font-bold mt-1">{formatNaira(12500)}</p>
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

      {/* Stats row — overlapping the header */}
      <section className="px-5 -mt-14">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Briefcase className="h-4 w-4 text-primary" />} value="24" label="Jobs Done" />
          <StatCard
            icon={<Star className="h-4 w-4 text-accent" fill="currentColor" />}
            value="4.8"
            label="Rating"
          />
          <StatCard
            icon={<Award className="h-4 w-4 text-primary" />}
            value="Silver"
            label="Level"
          />
        </div>
      </section>

      {/* Categories */}
      <section className="mt-6">
        <h2 className="px-5 text-base font-bold text-foreground mb-3">Categories</h2>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              className="flex-shrink-0 flex flex-col items-center gap-2 w-20"
            >
              <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center text-2xl", c.tint)}>
                {c.emoji}
              </div>
              <span className="text-xs font-medium text-foreground">{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Job feed */}
      <section className="mt-6 px-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Jobs near you</h2>
          <button className="text-xs font-semibold text-primary">See all</button>
        </div>
        <div className="space-y-3">
          {JOBS.map((job) => (
            <Link
              key={job.id}
              to="/home"
              className="block rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex gap-3">
                <div className={cn("h-12 w-12 flex-shrink-0 rounded-xl flex items-center justify-center", job.tint)}>
                  <job.icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-foreground text-sm leading-tight">{job.title}</p>
                    <p className="text-primary font-bold text-sm whitespace-nowrap">{formatNaira(job.pay)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{job.client}</span>
                      <span>·</span>
                      <Star className="h-3 w-3 text-accent" fill="currentColor" />
                      <span>{job.rating}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{job.eta}</p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Tag>{job.type}</Tag>
                    <Tag>{job.category}</Tag>
                  </div>
                </div>
              </div>
            </Link>
          ))}
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
