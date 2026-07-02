// Flutterwave webhook: charge.completed → credit wallet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const sig = req.headers.get("verif-hash") || "";
    const expected = Deno.env.get("FLUTTERWAVE_WEBHOOK_HASH") || "";
    if (!expected || sig !== expected) return new Response("Invalid signature", { status: 401 });

    const payload = await req.json();
    if (payload?.event !== "charge.completed" && payload?.["event.type"] !== "CARD_TRANSACTION") {
      return new Response("ignored", { status: 200 });
    }
    const d = payload?.data || payload;
    if (d?.status !== "successful" || d?.currency !== "NGN") return new Response("ignored", { status: 200 });

    const secret = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;
    const v = await fetch(`https://api.flutterwave.com/v3/transactions/${d.id}/verify`, {
      headers: { Authorization: `Bearer ${secret}` },
    }).then(r => r.json());
    if (v?.data?.status !== "successful") return new Response("verify failed", { status: 400 });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tx_ref: string = v.data.tx_ref;

    // Idempotency
    const { data: existing } = await sb.from("transactions").select("id")
      .eq("description", "Wallet top-up · " + tx_ref).maybeSingle();
    if (existing) return new Response("duplicate", { status: 200 });

    // tx_ref format WB-{userId}-{ts}
    const parts = tx_ref.split("-");
    const userId = parts.length >= 3 ? parts.slice(1, -1).join("-") : null;
    if (!userId) return new Response("bad tx_ref", { status: 400 });

    const { error } = await sb.rpc("deposit_to_wallet", {
      _user_id: userId, _amount: Number(v.data.amount), _reference: tx_ref,
    });
    if (error) return new Response(error.message, { status: 500 });
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(String(e?.message || e), { status: 500 });
  }
});
