// Verify a Flutterwave transaction and credit the user's wallet.
// Called by the client after a successful inline payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { transaction_id, tx_ref, expected_amount } = await req.json();
    const secret = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!secret) throw new Error("Flutterwave secret not configured");
    if (!transaction_id) throw new Error("transaction_id required");

    const authHeader = req.headers.get("Authorization") || "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Not authenticated");

    // Idempotency: skip if we already processed this tx_ref
    if (tx_ref) {
      const { data: existing } = await sb.from("transactions").select("id")
        .eq("description", "Wallet top-up · " + tx_ref).maybeSingle();
      if (existing) return new Response(JSON.stringify({ ok: true, already: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const res = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.json();
    const d = body?.data;
    if (body?.status !== "success" || d?.status !== "successful") {
      return new Response(JSON.stringify({ ok: false, error: "verification_failed" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (d.currency !== "NGN") {
      return new Response(JSON.stringify({ ok: false, error: "wrong_currency" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (expected_amount && Number(d.amount) < Number(expected_amount)) {
      return new Response(JSON.stringify({ ok: false, error: "amount_mismatch" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { error } = await sb.rpc("deposit_to_wallet", {
      _user_id: user.id, _amount: Number(d.amount), _reference: d.tx_ref || tx_ref || String(transaction_id),
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, amount: d.amount }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
