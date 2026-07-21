import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to WorkBridge" },
      { name: "description", content: "Get started with WorkBridge — Nigeria's job marketplace." },
      { name: "theme-color", content: "#0F4A32" },
    ],
  }),
  component: WelcomeScreen,
});

function WelcomeScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden px-6 py-10"
      style={{
        background: "linear-gradient(180deg, #0F4A32 0%, #2D9E6F 100%)",
      }}
    >
      {/* Top center logo — transparent, no border/shadow, rounded */}
      <div className="flex justify-center pt-2 animate-fade-in">
        <div
          className="h-[120px] w-[120px] bg-transparent border-0 outline-none shadow-none"
          style={{
            borderRadius: 22,
            overflow: "hidden",
            background: "transparent",
          }}
        >
          <img
            src="/workbridge-logo.png"
            alt="WorkBridge"
            className="h-full w-full object-cover border-0 outline-none shadow-none"
            style={{
              borderRadius: 22,
              background: "transparent",
              display: "block",
            }}
          />
        </div>
      </div>

      {/* Lower half content — reduced gap from logo */}
      <div className="animate-slide-up mb-4 mt-2">
        <h1 className="text-[32px] font-bold leading-tight text-white">
          Work for everyone.{" "}
          <span style={{ color: "#F5A623" }}>Anywhere.</span>
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-white/70 max-w-sm">
          No experience needed. No complicated forms. Just real work, real pay,
          and real opportunity for everyone.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            to="/role-select"
            className="flex items-center justify-center rounded-full py-4 text-base font-semibold text-[#0F4A32] shadow-lg"
            style={{ backgroundColor: "#F5A623" }}
          >
            Get Started — It&apos;s Free
          </Link>
          <Link
            to="/login"
            className="flex items-center justify-center rounded-full border border-white/40 py-4 text-base font-medium text-white"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
