import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log In — WorkBridge" },
      { name: "description", content: "Sign in to your WorkBridge account." },
      { name: "theme-color", content: "#F7F9F8" },
    ],
  }),
  component: LoginScreen,
});

function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-7 pb-4">
        <Link to="/welcome" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-lg font-bold text-foreground">Log In</h1>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pt-6">
        <p className="text-sm text-muted-foreground">
          Welcome back! Enter your details to continue.
        </p>

        <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
          {/* Email */}
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative mt-1.5">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="text-right">
            <Link to="/login" className="text-sm font-medium text-primary">
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20"
          >
            Log In
          </button>
        </form>

        {/* Sign up link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/role-select" className="font-semibold text-primary">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
