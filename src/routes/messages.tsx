import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — WorkBridge" }] }),
  component: MessagesScreen,
});

type Thread = {
  otherId: string;
  otherName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

function MessagesScreen() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setLoading(false);
        return;
      }

      const { data: messages } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, content, is_read, created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!messages || !active) {
        if (active) setLoading(false);
        return;
      }

      // group by other-party id
      const map = new Map<string, Thread>();
      for (const m of messages) {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!map.has(otherId)) {
          map.set(otherId, {
            otherId,
            otherName: "User",
            lastMessage: m.content,
            lastAt: m.created_at,
            unread: 0,
          });
        }
        const t = map.get(otherId)!;
        if (!m.is_read && m.receiver_id === user.id) t.unread += 1;
      }

      const otherIds = Array.from(map.keys());
      if (otherIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", otherIds);
        profiles?.forEach((p) => {
          const t = map.get(p.id);
          if (t && p.full_name) t.otherName = p.full_name;
        });
      }

      if (active) {
        setThreads(Array.from(map.values()));
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <MobileShell>
      <header className="px-5 pt-7 pb-4 bg-card border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">Conversations with clients and workers</p>
      </header>

      <div className="px-5 py-5">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-10">Loading…</p>
        ) : threads.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Once you apply to or post a job, conversations will appear here.
            </p>
            <Link
              to="/search"
              className="inline-block mt-4 px-5 h-11 leading-[44px] rounded-full bg-primary text-primary-foreground text-sm font-semibold"
            >
              Find a job
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {threads.map((t) => (
              <li
                key={t.otherId}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {t.otherName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground text-sm">{t.otherName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.lastAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.lastMessage}</p>
                </div>
                {t.unread > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {t.unread}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
