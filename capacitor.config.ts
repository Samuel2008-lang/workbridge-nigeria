import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for WorkBridge Android packaging.
 *
 * webDir points at Nitro/Vite public output. `npm run build` generates
 * index.html there via scripts/generate-capacitor-index.mjs.
 */
const config: CapacitorConfig = {
  appId: "ng.workbridge.app",
  appName: "WorkBridge",
  webDir: ".output/public",
  server: {
    // Use https scheme on Android so WebView APIs behave like a secure origin.
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#0F4A32",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#0F4A32",
    },
  },
};

export default config;
