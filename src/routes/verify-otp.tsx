import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  phone: z.string(),
  firstName: z.string().optional(),
  city: z.string().optional(),
  language: z.string().optional(),
  role: z.enum(["worker", "poster"]).optional(),
});

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [{ title: "Verify your phone — WorkBridge" }],
  }),
  component: VerifyOtpScreen,
});

function VerifyOtpScreen() {
  const navigate = useNavigate();
  const { phone } = Route.useSearch();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length < 6 || loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
      if (error) throw error;
      toast.success("Phone verified");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-5 pt-7 pb-6">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/signup" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <p className="text-sm font-medium text-muted-foreground">Step 3 of 3</p>
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-2">Enter the code</h1>
      <p className="text-base text-muted-foreground mb-8">We sent a 6-digit code to {phone}</p>

      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="123456"
        className={cn(
          "w-full h-16 rounded-2xl border-2 border-border bg-card px-4 text-center text-2xl tracking-[0.5em] font-semibold",
          "outline-none focus:border-primary",
        )}
      />

      <div className="flex-1" />

      <Button
        onClick={handleVerify}
        disabled={code.length < 6 || loading}
        className="w-full h-14 rounded-2xl text-base font-semibold"
      >
        {loading ? "Verifying..." : "Verify & Continue"}
      </Button>
    </div>
  );
}
