import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Search, Briefcase, User } from "lucide-react";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20">
      {children}
      <nav className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-md border-t border-border bg-card/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {[
            { to: "/", label: "Home", icon: Home },
            { to: "/", label: "Browse", icon: Search },
            { to: "/", label: "Jobs", icon: Briefcase },
            { to: "/", label: "Profile", icon: User },
          ].map(({ to, label, icon: Icon }) => (
            <li key={label}>
              <Link
                to={to}
                className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground hover:text-primary"
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
