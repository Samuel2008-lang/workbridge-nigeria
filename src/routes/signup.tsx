import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  role: z.enum(["worker", "poster"]).optional(),
});

export const Route = createFileRoute("/signup")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Create your account — WorkBridge" },
      { name: "description", content: "Sign up for WorkBridge with your phone number." },
    ],
  }),
  component: SignupScreen,
});

const LANGUAGES = ["English", "Yoruba", "Igbo", "Hausa", "Pidgin"];

function normalizePhone(raw: string): string {
  // Nigeria: convert 0XXXXXXXXXX -> +234XXXXXXXXXX
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (raw.startsWith("+")) return `+${digits}`;
  return `+234${digits}`;
}

function SignupScreen() {
  const navigate = useNavigate();
  const { role } = Route.useSearch();

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);

  const canSubmit = firstName.trim() && phone.trim().length >= 10 && city.trim();

  const inputClass = cn(
    "w-full h-14 rounded-2xl border-2 border-border bg-card px-4 text-base text-foreground",
    "placeholder:text-muted-foreground outline-none transition-colors",
    "focus:border-primary",
  );

  const handleContinue = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    const fullPhone = normalizePhone(phone);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) throw error;
      toast.success("Verification code sent");
      navigate({
        to: "/verify-otp",
        search: { phone: fullPhone, firstName, city, language, role },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send code";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-5 pt-7 pb-6">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/role-select" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <p className="text-sm font-medium text-muted-foreground">Step 2 of 3</p>
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-2">Create your account</h1>
      <p className="text-base text-muted-foreground mb-8">
        Just your phone number — nothing complicated
      </p>

      <div className="flex-1 space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Your first name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Amara"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Phone number</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 08012345678"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Your city or area</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Lagos, Abuja, Port Harcourt"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Preferred language</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger
              className={cn(
                "w-full !h-14 rounded-2xl border-2 border-border bg-card px-4 text-base",
                "focus:border-primary focus:ring-0",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Button
          onClick={handleContinue}
          disabled={!canSubmit || loading}
          className="w-full h-14 rounded-2xl text-base font-semibold"
        >
          {loading ? "Sending code..." : "Continue"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          By continuing you agree to our Terms and Privacy Policy
        </p>
      </div>
    </div>
  );
}
