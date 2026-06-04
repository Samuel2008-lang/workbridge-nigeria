import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Briefcase, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/role-select")({
  head: () => ({
    meta: [
      { title: "Choose Your Role — WorkBridge" },
      { name: "description", content: "Select how you want to use WorkBridge — post jobs or find work." },
      { name: "theme-color", content: "#0F4A32" },
    ],
  }),
  component: RoleSelectScreen,
});

function RoleSelectScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-7 pb-4">
        <Link to="/welcome" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <div>
          <p className="text-xs text-muted-foreground">Step 1 of 3</p>
          <h1 className="text-lg font-bold text-foreground">How will you use WorkBridge?</h1>
        </div>
      </div>

      {/* Role cards */}
      <div className="flex-1 px-5 pt-4 space-y-4">
        <Link
          to="/login"
          className="flex items-center gap-4 rounded-2xl bg-card border border-border p-5 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-foreground">I want to post jobs</p>
            <p className="text-sm text-muted-foreground">Find workers for tasks you need done</p>
          </div>
        </Link>

        <Link
          to="/login"
          className="flex items-center gap-4 rounded-2xl bg-card border border-border p-5 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground">
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-foreground">I want to find work</p>
            <p className="text-sm text-muted-foreground">Earn money doing jobs near you</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
