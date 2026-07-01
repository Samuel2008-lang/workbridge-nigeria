import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WorkBridge" },
      { name: "theme-color", content: "#0F4A32" },
    ],
  }),
  component: SplashScreen,
});

function SplashScreen() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate loading bar over 2 seconds
    const startTime = Date.now();
    const duration = 2000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const nextProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(nextProgress);

      if (nextProgress < 100) {
        requestAnimationFrame(animate);
      }
    };

    const rafId = requestAnimationFrame(animate);

    // Navigate after 2.5 seconds
    const timer = setTimeout(() => {
      navigate({ to: "/welcome" });
    }, 2500);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(180deg, #0F4A32 0%, #2D9E6F 100%)",
      }}
    >
      {/* Logo */}
      <img
        src="/__l5e/assets-v1/cd15fc17-e5a9-4bdc-a4a5-99380f3b47b0/workbridge-logo.png"
        alt="WorkBridge"
        className="h-[100px] w-[100px] rounded-2xl animate-pulse-gentle"
      />

      {/* Brand name */}
      <h1
        className="mt-6 text-[36px] font-bold text-white"
        style={{ fontFamily: '"Sora", sans-serif' }}
      >
        WorkBridge
      </h1>

      {/* Tagline */}
      <p
        className="mt-2 text-sm text-white/60"
        style={{ fontFamily: '"Sora", sans-serif' }}
      >
        Connecting the world to work
      </p>

      {/* Loading bar at bottom */}
      <div className="absolute bottom-16 left-8 right-8">
        <div className="h-0.5 w-full rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
