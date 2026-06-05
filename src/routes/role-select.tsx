import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Role = "worker" | "poster";

export const Route = createFileRoute("/role-select")({
  head: () => ({
    meta: [
      { title: "Choose Your Role — WorkBridge" },
      { name: "description", content: "Join WorkBridge as a worker or a job poster." },
    ],
  }),
  component: RoleSelectScreen,
});

function RoleSelectScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Role | null>(null);

  const cards: { id: Role; emoji: string; title: string; subtitle: string }[] = [
    { id: "worker", emoji: "👷", title: "I need work", subtitle: "Find jobs, earn money, grow your skills" },
    { id: "poster", emoji: "🏢", title: "I have work to give", subtitle: "Post jobs, find trusted workers nearby" },
  ];

  const handleContinue = () => {
    if (!selected) return;
    navigate({ to: "/signup", search: { role: selected } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-5 pt-7 pb-6">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/welcome" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <p className="text-sm font-medium text-muted-foreground">Step 1 of 3</p>
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-2">Who are you joining as?</h1>
      <p className="text-base text-muted-foreground mb-8">You can always switch later</p>

      <div className="flex-1 space-y-4">
        {cards.map((card) => {
          const isSelected = selected === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelected(card.id)}
              className={cn(
                "w-full flex items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all active:scale-[0.98]",
                isSelected
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-card hover:border-muted-foreground/30",
              )}
            >
              <div className="text-5xl leading-none">{card.emoji}</div>
              <div className="flex-1">
                <p className="text-lg font-bold text-foreground">{card.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selected}
        className="w-full h-14 rounded-2xl text-base font-semibold mt-6"
      >
        Continue
      </Button>
    </div>
  );
}
