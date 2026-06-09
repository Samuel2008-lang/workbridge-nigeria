import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/rate/$jobId")({
  head: () => ({ meta: [{ title: "Rate — WorkBridge" }] }),
  component: RateScreen,
});

const TAGS = ["Professional", "On time", "Great quality", "Communicative", "Friendly", "Late", "Poor quality", "No-show"];

function RateScreen() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [ratedUser, setRatedUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data: j } = await supabase.from("jobs").select("client_id, hired_worker_id").eq("id", jobId).maybeSingle();
      if (j) setRatedUser(user.id === j.client_id ? j.hired_worker_id : j.client_id);
    })();
  }, [jobId, navigate]);

  const toggle = (t: string) => setTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const submit = async () => {
    if (!ratedUser) return toast.error("Missing party");
    setBusy(true);
    const { error } = await supabase.rpc("submit_rating", {
      _job_id: jobId, _rated_user_id: ratedUser, _stars: stars, _comment: comment, _tags: tags,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(stars <= 2 ? "Rating submitted — held for admin review" : "Rating posted");
    navigate({ to: "/jobs/$jobId", params: { jobId } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-5 pt-7 pb-4 border-b border-border">
        <button onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId } })} className="h-9 w-9 flex items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold">Leave a rating</h1>
      </header>
      <div className="px-5 py-6 space-y-6">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n)}>
              <Star className={`h-10 w-10 ${n <= stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <button key={t} onClick={() => toggle(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tags.includes(t) ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">Comment (optional)</p>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
            placeholder="Share your experience…"
            className="w-full p-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
        </div>

        {stars <= 2 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            Reviews of 1–2 stars are held for admin review before publishing.
          </div>
        )}

        <Button onClick={submit} disabled={busy} className="w-full h-14 rounded-2xl text-base font-semibold">
          {busy ? "Submitting…" : "Submit rating"}
        </Button>
      </div>
    </div>
  );
}
