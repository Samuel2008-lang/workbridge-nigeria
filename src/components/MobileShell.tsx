import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background pb-24">
      {children}
      <nav className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-md border-t border-border bg-card/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <li key={label}>
                <Link
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
