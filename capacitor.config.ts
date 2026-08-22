import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the FARID AI Android APK.
 *
 * `server.url` points the WebView at the deployed FARID AI site so the app
 * always runs the latest release. Replace it with your published URL before
 * running `npx cap sync android`.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.faridai",
  appName: "FARID AI",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0F14",
  },
  server: {
    url: "https://project--700eace0-4189-4d50-b28b-b493730c3ff3.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;
