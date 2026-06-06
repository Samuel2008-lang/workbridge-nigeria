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

  const [firstName, setFirstName] = useState("");
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
  if (password.length < 8) passwordErrors.push("At least 8 characters");
  if (!/[A-Za-z]/.test(password)) passwordErrors.push("Include a letter");
  if (!/[0-9]/.test(password)) passwordErrors.push("Include a number");

  const firstNameError = !firstName.trim() ? "First name is required" : "";
  const cityError = !city.trim() ? "City is required" : "";

  const canSubmit =
    !firstNameError && !emailError && passwordErrors.length === 0 && !cityError;

  const inputClass = cn(
    "w-full h-14 rounded-2xl border-2 border-border bg-card px-4 text-base text-foreground",
    "placeholder:text-muted-foreground outline-none transition-colors",
    "focus:border-primary",
  );

  const handleContinue = async () => {
    setShowErrors(true);
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: { first_name: firstName, phone, city, language, role },
        },
      });
      if (error) throw error;

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "workbridge_profile",
          JSON.stringify({ firstName, email, phone, city, language, role }),
        );
      }
      toast.success("Account created");
      navigate({ to: "/home" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
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
        A few quick details to get you started
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
          {showErrors && firstNameError && (
            <p className="mt-1.5 text-xs text-destructive">{firstNameError}</p>
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
              placeholder="At least 8 characters, with a letter and number"
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
          onClick={handleContinue}
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
