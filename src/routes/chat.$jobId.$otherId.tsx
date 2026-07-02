import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send, Paperclip, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/$jobId/$otherId")({
  head: () => ({ meta: [{ title: "Chat — WorkBridge" }] }),
  component: ChatScreen,
});

type Msg = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
};

function ChatScreen() {
  const { jobId, otherId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("User");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<{ client_id: string; hired_worker_id: string | null; type: string; payment_mode: string } | null>(null);
  const [cashReq, setCashReq] = useState<{ id: string; status: string; requested_by: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const scroll = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate({ to: "/login" }); return; }
    setMe(user.id);

    const [{ data: prof }, { data: j }, { data: cr }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", otherId).maybeSingle(),
      supabase.from("jobs").select("client_id, hired_worker_id, type, payment_mode").eq("id", jobId).maybeSingle(),
      supabase.from("cash_payment_requests").select("id, status, requested_by").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (prof?.full_name) setOtherName(prof.full_name);
    if (j) setJob(j as any);
    setCashReq(cr as any);

    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, media_url, media_type, created_at")
      .eq("job_id", jobId)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMsgs((data ?? []) as Msg[]);
    scroll();

    await supabase.from("messages").update({ is_read: true })
      .eq("job_id", jobId).eq("sender_id", otherId).eq("receiver_id", user.id);
  }, [jobId, otherId, navigate]);

  const isClient = me && job?.client_id === me;
  const isPhysical = job?.type === "physical";
  const cashAgreed = job?.payment_mode === "cash";
  const canRequestCash = isClient && isPhysical && !cashAgreed && (!cashReq || cashReq.status === "declined");
  const canRespondCash = !isClient && cashReq?.status === "pending";

  const requestCash = async () => {
    if (!me) return;
    const { error } = await supabase.from("cash_payment_requests").insert({ job_id: jobId, requested_by: me });
    if (error) return toast.error(error.message);
    toast.success("Cash payment request sent");
    load();
  };

  const respondCash = async (accept: boolean) => {
    if (!cashReq) return;
    const { error } = await supabase.rpc("respond_cash_request", { _request_id: cashReq.id, _accept: accept });
    if (error) return toast.error(error.message);
    toast.success(accept ? "Cash agreed" : "Cash declined");
    load();
  };


  useEffect(() => {
    load();
    const ch = supabase
      .channel(`chat:${jobId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `job_id=eq.${jobId}` },
        (payload) => {
          const m = payload.new as Msg;
          if ((m.sender_id === otherId || m.receiver_id === otherId)) {
            setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
            scroll();
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [jobId, otherId, load]);

  const send = async (overrides?: Partial<Msg>) => {
    if (!me) return;
    const content = (overrides?.content ?? text).trim();
    if (!content && !overrides?.media_url) return;
    setSending(true);
    const { data, error } = await supabase.from("messages").insert({
      job_id: jobId, sender_id: me, receiver_id: otherId,
      content: content || (overrides?.media_type ?? "📎 attachment"),
      media_url: overrides?.media_url ?? null,
      media_type: overrides?.media_type ?? null,
    }).select("id, sender_id, receiver_id, content, media_url, media_type, created_at").single();
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
    if (data) { setMsgs((prev) => [...prev, data as Msg]); scroll(); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !me) return;
    if (file.size > 25 * 1024 * 1024) return toast.error("File too large (max 25 MB)");
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${jobId}/${me}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 7);
    setUploading(false);
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
    await send({ media_url: signed?.signedUrl ?? path, media_type: kind, content: file.name });
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 pt-6 pb-3 border-b border-border bg-card">
        <button onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId } })} className="h-9 w-9 flex items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
          {otherName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{otherName}</p>
          <p className="text-[11px] text-muted-foreground">Job chat</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">No messages yet. Say hi 👋</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {m.media_url && m.media_type === "image" && (
                  <img src={m.media_url} alt="" className="rounded-lg mb-1 max-h-60" />
                )}
                {m.media_url && m.media_type === "video" && (
                  <video src={m.media_url} controls className="rounded-lg mb-1 max-h-60" />
                )}
                {m.media_url && m.media_type === "audio" && (
                  <audio src={m.media_url} controls className="mb-1 max-w-full" />
                )}
                {m.media_url && m.media_type === "file" && (
                  <a href={m.media_url} target="_blank" rel="noreferrer" className="underline block mb-1">📎 {m.content}</a>
                )}
                {(!m.media_url || m.media_type === "image" || m.media_type === "video" || m.media_type === "audio") && (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
                <p className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-card p-3 flex items-center gap-2">
        <input ref={fileRef} type="file" hidden onChange={onFile}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message…" className="flex-1 h-10 px-4 rounded-full border border-border bg-background text-sm outline-none focus:border-primary" />
        <button onClick={() => send()} disabled={sending || (!text.trim())}
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
