import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
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
      { name: "description", content: "Sign up for WorkBridge." },
    ],
  }),
  component: SignupScreen,
});

const LANGUAGES = ["English", "Yoruba", "Igbo", "Hausa", "Pidgin"];

function SignupScreen() {
  const navigate = useNavigate();
  const { role } = Route.useSearch();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const emailError = !email
    ? "Email is required"
    : !/^\S+@\S+\.\S+$/.test(email)
      ? "Enter a valid email address"
      : "";

  const passwordErrors: string[] = [];
  if (password.length < 6) passwordErrors.push("Password must be at least 6 characters");

  const fullNameError = !fullName.trim() ? "Full name is required" : "";
  const cityError = !city.trim() ? "City is required" : "";

  const canSubmit =
    !fullNameError && !emailError && passwordErrors.length === 0 && !cityError;

  function formatSignupError(err: unknown): string {
    const raw =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message ?? "")
        : err instanceof Error
          ? err.message
          : String(err ?? "");
    console.error("[signup] Supabase/auth error:", err);
    if (/already|registered|exists|User already/i.test(raw)) {
      return "An account with this email already exists. Please log in.";
    }
    if (/password.*(6|least|short|weak)|least 6/i.test(raw)) {
      return "Password must be at least 6 characters";
    }
    return raw.trim() || "Sign up failed. Please try again.";
  }

  const inputClass = cn(
    "w-full h-14 rounded-2xl border-2 border-border bg-card px-4 text-base text-foreground",
    "placeholder:text-muted-foreground outline-none transition-colors",
    "focus:border-primary",
  );

  const preferredMode = role === "poster" ? "client" : "worker";

  const handleCreateAccount = async () => {
    setShowErrors(true);
    if (!canSubmit) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const firstName = fullName.trim().split(/\s+/)[0] ?? fullName.trim();
      const meta = {
        full_name: fullName.trim(),
        first_name: firstName,
        phone,
        city,
        language,
        role: role === "poster" ? "client" : role ?? "worker",
        preferred_mode: preferredMode,
      };

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: meta,
        },
      });

      if (error) {
        console.error("[signup] signUp error:", error);
        toast.error(formatSignupError(error));
        return;
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        console.error("[signup] email already registered (empty identities)");
        toast.error("An account with this email already exists. Please log in.");
        return;
      }

      if (data.user) {
        const { error: profileErr } = await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            full_name: fullName.trim(),
            phone_number: phone || null,
            location: city || null,
            language,
            preferred_mode: preferredMode,
            role: (role === "poster" ? "client" : role === "worker" ? "worker" : null) as
              | "worker"
              | "client"
              | null,
          },
          { onConflict: "id" },
        );
        if (profileErr) {
          console.error("[signup] profile upsert error (non-fatal):", profileErr);
          const { error: basicErr } = await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              full_name: fullName.trim(),
              phone_number: phone || null,
              location: city || null,
              language,
            },
            { onConflict: "id" },
          );
          if (basicErr) console.error("[signup] basic profile upsert error:", basicErr);
        }
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "workbridge_profile",
          JSON.stringify({
            fullName: fullName.trim(),
            firstName,
            email,
            phone,
            city,
            language,
            role,
            preferredMode,
          }),
        );
      }
      toast.success("Account created");
      // Issue 7: interests screen AFTER account creation, before home
      navigate({ to: "/job-interests" });
    } catch (err) {
      console.error("[signup] unexpected error:", err);
      toast.error(formatSignupError(err));
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
        A few quick details to get you started
      </p>

      <div className="flex-1 space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Samuel Egbon"
            className={inputClass}
          />
          {showErrors && fullNameError && (
            <p className="mt-1.5 text-xs text-destructive">{fullNameError}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Email address</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
          {showErrors && emailError && (
            <p className="mt-1.5 text-xs text-destructive">{emailError}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className={cn(inputClass, "pr-12")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {(showErrors || password.length > 0) && passwordErrors.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {passwordErrors.map((err) => (
                <li key={err} className="text-xs text-destructive">
                  • {err}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Phone number (optional)</label>
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
          {showErrors && cityError && (
            <p className="mt-1.5 text-xs text-destructive">{cityError}</p>
          )}
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
          onClick={() => void handleCreateAccount()}
          disabled={loading}
          className="w-full h-14 rounded-2xl text-base font-semibold"
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          By continuing you agree to our Terms and Privacy Policy
        </p>
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
