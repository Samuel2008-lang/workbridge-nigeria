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
      {/* Top center logo */}
      <div className="flex justify-center animate-fade-in">
        <img
          src="/__l5e/assets-v1/cd15fc17-e5a9-4bdc-a4a5-99380f3b47b0/workbridge-logo.png"
          alt="WorkBridge"
          className="h-[120px] w-[120px]"
        />
      </div>

      {/* Lower half content with slide-up animation */}
      <div className="animate-slide-up mb-4">
        {/* Heading */}
        <h1 className="text-[32px] font-bold leading-tight text-white">
          Work for everyone.{" "}
          <span style={{ color: "#F5A623" }}>Anywhere.</span>
        </h1>

        {/* Paragraph */}
        <p className="mt-4 text-sm leading-relaxed text-white/70 max-w-sm">
          No experience needed. No complicated forms. Just real work, real pay,
          and real opportunity for everyone.
        </p>

        {/* Buttons */}
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
