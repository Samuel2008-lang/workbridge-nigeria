import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Users, Bell } from "lucide-react";

export const Route = createFileRoute("/post-job-success")({
  head: () => ({ meta: [{ title: "Job posted — WorkBridge" }] }),
  component: PostJobSuccess,
});

function PostJobSuccess() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircle2 className="h-14 w-14 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Your job is live!</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">
        Workers nearby are being notified now. You'll see applications appear in your
        Messages tab.
      </p>

      <div className="mt-8 w-full max-w-sm space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4">
          <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Bell className="h-5 w-5 text-accent" />
          </div>
          <p className="text-sm text-foreground text-left">Notifying matching workers near you</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-foreground text-left">Applications usually arrive within minutes</p>
        </div>
      </div>

      <div className="mt-10 w-full max-w-sm space-y-3">
        <Link
          to="/home"
          className="block w-full h-14 leading-[56px] rounded-2xl bg-primary text-primary-foreground text-base font-semibold"
        >
          Back to home
        </Link>
        <Link
          to="/post-job"
          className="block w-full h-14 leading-[56px] rounded-2xl border-2 border-border text-foreground text-base font-semibold"
        >
          Post another job
        </Link>
      </div>
    </div>
  );
}
