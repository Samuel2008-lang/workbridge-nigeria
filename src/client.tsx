import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

/**
 * Default TanStack Start client hydrates a server-rendered document.
 * Capacitor serves a static SPA shell (data-capacitor-shell="true") with no
 * SSR markup, so we mount with createRoot into #root instead.
 */
const isCapacitorShell =
  typeof document !== "undefined" &&
  document.documentElement.dataset.capacitorShell === "true";

startTransition(() => {
  if (isCapacitorShell) {
    const rootEl = document.getElementById("root");
    if (!rootEl) {
      throw new Error("Capacitor shell is missing #root");
    }
    createRoot(rootEl).render(
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
    return;
  }

  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
