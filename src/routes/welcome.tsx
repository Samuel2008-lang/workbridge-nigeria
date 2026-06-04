import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to WorkBridge" },
      { name: "description", content: "Get started with WorkBridge — Nigeria's job marketplace." },
      { name: "theme-color", content: "#1A6B4A" },
    ],
  }),
  component: WelcomeScreen,
});

function WelcomeScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-6 py-12">
      {/* Top content */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-6xl">🌉</div>
        <h1 className="mt-6 text-3xl font-bold text-foreground">
          Welcome to WorkBridge
        </h1>
        <p className="mt-3 max-w-xs text-base text-muted-foreground leading-relaxed">
          Connect with people who need work done, or earn money doing physical and digital jobs across Nigeria.
        </p>
      </div>

      {/* Bottom actions */}
      <div className="w-full max-w-xs space-y-3">
        <Link
          to="/home"
          className="flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20"
        >
          Get Started
          <ArrowRight className="h-5 w-5" />
        </Link>
        <Link
          to="/home"
          className="flex items-center justify-center rounded-full border border-border py-3.5 text-base font-medium text-foreground"
        >
          I already have an account
        </Link>
      </div>
    </div>
  );
}
