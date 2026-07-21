import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, MessageCircle, User, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";

type Tab = {
  to: "/home" | "/search" | "/messages" | "/profile" | "/post-job";
  label: string;
  icon: typeof Home;
};

const WORKER_TABS: Tab[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
];

const CLIENT_TABS: Tab[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/post-job", label: "Post Job", icon: PlusCircle },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
];

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { preferredMode } = useProfile();
  const tabs = preferredMode === "client" ? CLIENT_TABS : WORKER_TABS;

  return (
    <div className="min-h-screen bg-background pb-24">
      {children}
      <nav className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-md border-t border-border bg-card/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/home" && pathname.startsWith(to));
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
