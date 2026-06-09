import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — WorkBridge" }] }),
  component: NotificationsScreen,
});

type N = { id: string; type: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string };

function NotificationsScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data } = await supabase.from("notifications")
        .select("id, type, title, body, link, is_read, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      setItems((data ?? []) as N[]);
      setLoading(false);
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="flex items-center gap-3 px-5 pt-7 pb-4 bg-card border-b border-border">
        <Link to="/home" className="h-9 w-9 flex items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold">Notifications</h1>
      </header>
      <div className="px-5 py-4 space-y-2">
        {loading ? <p className="text-center text-sm text-muted-foreground py-10">Loading…</p>
          : items.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : items.map((n) => {
            const inner = (
              <div className={`rounded-2xl p-3 border ${n.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"}`}>
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-1">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            );
            return n.link
              ? <a key={n.id} href={n.link} className="block">{inner}</a>
              : <div key={n.id}>{inner}</div>;
          })}
      </div>
    </div>
  );
}
