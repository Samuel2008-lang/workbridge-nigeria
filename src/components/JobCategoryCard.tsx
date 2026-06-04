import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  count: string;
  tone?: "primary" | "accent";
}

export function JobCategoryCard({ icon: Icon, title, count, tone = "primary" }: Props) {
  const iconBg = tone === "primary" ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent";
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm border border-border/60">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{count} open jobs</p>
      </div>
    </div>
  );
}
