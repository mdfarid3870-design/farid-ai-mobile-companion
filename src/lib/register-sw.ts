/**
 * Guarded service-worker registration.
 * The worker must never register inside the Lovable preview/dev iframe, only in
 * a real production install (browser or Android WebView shell).
 */
const SW_URL = "/sw.js";

function isBlockedContext() {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.self !== window.top) return true;
  if (new URL(window.location.href).searchParams.has("sw")) {
    return new URL(window.location.href).searchParams.get("sw") === "off";
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  const blockedSuffixes = [
    "lovableproject.com",
    "lovableproject-dev.com",
    "beta.lovable.dev",
  ];
  return blockedSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

async function unregisterExisting() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const url =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          "";
        return url.endsWith(SW_URL);
      })
      .map((registration) => registration.unregister()),
  );
}

export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isBlockedContext()) {
    await unregisterExisting();
    return;
  }
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    /* offline support is best-effort */
  }
}
