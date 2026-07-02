import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Monitor, Wrench, MapPin, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/post-job")({
  head: () => ({
    meta: [
      { title: "Post a Job — WorkBridge" },
      { name: "description", content: "Post a job and find workers near you." },
    ],
  }),
  component: PostJobScreen,
});

type WorkType = "digital" | "physical";
type Timing = "today" | "week" | "flexible";

function PostJobScreen() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [workType, setWorkType] = useState<WorkType | null>(null);
  const [timing, setTiming] = useState<Timing>("today");
  const [location, setLocation] = useState("Lagos, Nigeria");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [details, setDetails] = useState("");
  const [workers, setWorkers] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const titleError = !title.trim() ? "Describe the job" : "";
  const workTypeError = !workType ? "Pick the type of work" : "";
  const budgetError =
    !budgetMin || !budgetMax
      ? "Enter both minimum and maximum"
      : Number(budgetMin) > Number(budgetMax)
        ? "Minimum cannot exceed maximum"
        : "";

  const canSubmit = !titleError && !workTypeError && !budgetError;

  const handleSubmit = async () => {
    setShowErrors(true);
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to post a job");
        navigate({ to: "/login" });
        return;
      }
      const { data: ack } = await supabase.from("onboarding_acknowledgements")
        .select("id").eq("user_id", user.id).eq("type", "client_first_post").is("job_id", null).maybeSingle();
      if (!ack) {
        navigate({ to: "/client-onboarding" });
        return;
      }
      const fullDescription = details
        ? `${title}\n\n${details}\n\nTiming: ${timing} · Workers needed: ${workers}`
        : `${title}\n\nTiming: ${timing} · Workers needed: ${workers}`;
      const { error } = await supabase.from("jobs").insert({
        client_id: user.id,
        title,
        description: fullDescription,
        type: workType!,
        location,
        budget_min: Number(budgetMin),
        budget_max: Number(budgetMax),
        status: "open",
      });
      if (error) throw error;
      navigate({ to: "/post-job-success" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header
        className="px-5 pt-7 pb-6 text-white"
        style={{ background: "linear-gradient(180deg, #0F4A32 0%, #1A6B4A 100%)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <Link to="/home" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <h1 className="text-lg font-bold">Post a Job</h1>
        </div>
        <p className="text-sm text-white/80">Tell us what you need — simple and clear</p>
      </header>

      <div className="px-5 pt-6 space-y-6">
        {/* 1. Description */}
        <Field label="What do you need done?" error={showErrors ? titleError : ""}>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={3}
            placeholder="Describe the job simply e.g. Fix a leaking tap in my kitchen"
            className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none resize-none"
          />
        </Field>

        {/* 2. Type of work */}
        <Field label="Type of work" error={showErrors ? workTypeError : ""}>
          <div className="grid grid-cols-2 gap-3">
            <TypeCard
              icon={<Monitor className="h-6 w-6" />}
              title="💻 Digital"
              desc="On phone or computer"
              active={workType === "digital"}
              onClick={() => setWorkType("digital")}
            />
            <TypeCard
              icon={<Wrench className="h-6 w-6" />}
              title="🔧 Physical"
              desc="In person at a location"
              active={workType === "physical"}
              onClick={() => setWorkType("physical")}
            />
          </div>
        </Field>

        {/* 3. Timing */}
        <Field label="When do you need it?">
          <div className="flex gap-2">
            {([
              { id: "today", label: "Today" },
              { id: "week", label: "This Week" },
              { id: "flexible", label: "Flexible" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTiming(t.id)}
                className={cn(
                  "flex-1 h-11 rounded-full border-2 text-sm font-semibold transition-colors",
                  timing === t.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        {/* 4. Location */}
        <Field label="Your location">
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none"
            />
          </div>
          <div className="mt-2 h-32 rounded-2xl overflow-hidden border border-border bg-muted relative">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(#d4e1d8 1px, transparent 1px), linear-gradient(90deg, #d4e1d8 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <MapPin className="h-5 w-5 text-primary" fill="currentColor" />
              </div>
            </div>
          </div>
        </Field>

        {/* 5. Budget */}
        <Field label="Your budget" error={showErrors ? budgetError : ""}>
          <div className="grid grid-cols-2 gap-3">
            <BudgetInput
              label="Minimum"
              value={budgetMin}
              onChange={setBudgetMin}
            />
            <BudgetInput
              label="Maximum"
              value={budgetMax}
              onChange={setBudgetMax}
            />
          </div>
        </Field>

        {/* 6. More details */}
        <Field label="More details (optional)">
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="Anything else workers should know"
            className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none resize-none"
          />
        </Field>

        {/* 7. Workers count */}
        <Field label="How many workers do you need?">
          <div className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-2">
            <button
              onClick={() => setWorkers((w) => Math.max(1, w - 1))}
              className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center active:scale-95"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-2xl font-bold text-foreground">{workers}</span>
            <button
              onClick={() => setWorkers((w) => Math.min(10, w + 1))}
              className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center active:scale-95"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Field>
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 inset-x-0 mx-auto max-w-md p-5 bg-background border-t border-border">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full h-14 rounded-2xl text-base font-semibold"
        >
          {loading ? "Posting…" : "Post Job — Find Workers"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-2 block">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TypeCard({
  icon,
  title,
  desc,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border-2 p-4 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-card",
      )}
    >
      <div className={cn("mb-2", active ? "text-primary" : "text-foreground")}>{icon}</div>
      <p className="font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}

function BudgetInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
          ₦
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full h-14 pl-9 pr-4 rounded-2xl border-2 border-border bg-card text-base font-semibold focus:border-primary outline-none"
        />
      </div>
    </div>
  );
}
