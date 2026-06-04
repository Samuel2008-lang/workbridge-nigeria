import { createFileRoute } from "@tanstack/react-router";
import {
  Wrench,
  Sparkles,
  Keyboard,
  Mic,
  Search,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { JobCategoryCard } from "@/components/JobCategoryCard";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "WorkBridge — Find work. Earn money. Nigeria." },
      {
        name: "description",
        content:
          "WorkBridge connects Nigerians who need work done with people who want to earn — from plumbing to data entry.",
      },
      { property: "og:title", content: "WorkBridge — Nigeria's job marketplace" },
      {
        property: "og:description",
        content: "Post physical or digital jobs and get matched fast.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <MobileShell>
      <div className="mx-auto max-w-md">
        {/* Header */}
        <header className="px-5 pt-7 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Good morning 👋</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">WorkBridge</h1>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-medium">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Lagos
            </div>
          </div>

          {/* Search */}
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-card border border-border px-4 py-3 shadow-sm">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search plumbing, data entry..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </header>

        {/* Hero CTA */}
        <section className="px-5">
          <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-md">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/30" />
            <div className="absolute -right-2 bottom-0 h-16 w-16 rounded-full bg-accent/20" />
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-wider text-accent">
                Get started
              </p>
              <h2 className="mt-2 text-xl font-bold leading-tight">
                Post a job or start earning today
              </h2>
              <p className="mt-1 text-sm text-primary-foreground/80">
                Match with trusted workers across Nigeria in minutes.
              </p>
              <div className="mt-4 flex gap-2">
                <button className="flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                  Post a job <ArrowRight className="h-4 w-4" />
                </button>
                <button className="rounded-full border border-primary-foreground/30 px-4 py-2 text-sm font-semibold">
                  Find work
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="px-5 pt-7">
          <div className="mb-3 flex items-end justify-between">
            <h3 className="text-base font-semibold">Categories</h3>
            <button className="text-xs font-medium text-primary">See all</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <JobCategoryCard icon={Wrench} title="Plumbing" count="124" />
            <JobCategoryCard icon={Sparkles} title="Cleaning" count="86" tone="accent" />
            <JobCategoryCard icon={Keyboard} title="Data Entry" count="212" tone="accent" />
            <JobCategoryCard icon={Mic} title="Transcription" count="58" />
          </div>
        </section>

        {/* Featured jobs */}
        <section className="px-5 pt-7">
          <div className="mb-3 flex items-end justify-between">
            <h3 className="text-base font-semibold">Featured jobs</h3>
            <button className="text-xs font-medium text-primary">View all</button>
          </div>
          <ul className="space-y-3">
            {[
              {
                title: "Fix kitchen sink leak",
                meta: "Ikeja • Today",
                pay: "₦8,000",
                tag: "Physical",
              },
              {
                title: "Transcribe 30 min audio",
                meta: "Remote • 2 days",
                pay: "₦12,500",
                tag: "Digital",
              },
              {
                title: "Deep clean 2-bedroom flat",
                meta: "Lekki • Sat",
                pay: "₦20,000",
                tag: "Physical",
              },
            ].map((job) => (
              <li
                key={job.title}
                className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        job.tag === "Digital"
                          ? "bg-accent-soft text-accent-foreground"
                          : "bg-primary-soft text-primary"
                      }`}
                    >
                      {job.tag}
                    </span>
                    <p className="mt-1.5 font-semibold text-sm leading-snug">
                      {job.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{job.meta}</p>
                  </div>
                  <p className="text-sm font-bold text-primary whitespace-nowrap">
                    {job.pay}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </MobileShell>
  );
}
