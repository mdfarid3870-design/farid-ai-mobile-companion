import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Server-only helper for Google Gemini API integration.
 * Designed for unlimited / uninterrupted chat via:
 * 1. Multi-key pooling across GEMINI_API_KEY, GEMINI_API_KEYS, and GEMINI_KEY_*
 * 2. Automatic round-robin load balancing
 * 3. In-memory rate-limit / quota cooldowns (skips rate-limited keys automatically)
 * 4. Model cascading fallback (2.0-flash -> 2.0-flash-lite -> 1.5-flash -> 1.5-flash-8b)
 */

interface KeyState {
  cooldownUntil: number;
  failureCount: number;
}

// In-memory key state tracker for intelligent key rotation
const keyStates = new Map<string, KeyState>();
let roundRobinIndex = 0;

export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];

  const rawEnv =
    process.env["GEMINI_API_KEY"] || process.env["GEMINI_API_KEYS"] || "";

  if (rawEnv) {
    const splitKeys = rawEnv
      .split(/[,\n;]/)
      .map((k) => k.trim())
      .filter(Boolean);
    keys.push(...splitKeys);
  }

  // Also harvest any indexed keys: GEMINI_KEY_1, GEMINI_KEY_2, etc.
  for (const [envKey, value] of Object.entries(process.env)) {
    if (
      envKey.startsWith("GEMINI_KEY_") ||
      envKey.startsWith("GEMINI_API_KEY_")
    ) {
      if (value && typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed && !keys.includes(trimmed)) {
          keys.push(trimmed);
        }
      }
    }
  }

  return Array.from(new Set(keys));
}

/**
 * Returns keys sorted with healthy keys first and rotated via round-robin
 * so no single key gets slammed with all the requests.
 */
export function getPrioritizedGeminiKeys(): string[] {
  const allKeys = getGeminiApiKeys();
  if (allKeys.length <= 1) return allKeys;

  const now = Date.now();
  const healthy: string[] = [];
  const inCooldown: string[] = [];

  for (const key of allKeys) {
    const state = keyStates.get(key);
    if (state && state.cooldownUntil > now) {
      inCooldown.push(key);
    } else {
      healthy.push(key);
    }
  }

  // Rotate healthy keys so requests are evenly distributed
  if (healthy.length > 1) {
    const offset = roundRobinIndex % healthy.length;
    roundRobinIndex = (roundRobinIndex + 1) % 1000000;
    const rotated = [...healthy.slice(offset), ...healthy.slice(0, offset)];
    return [...rotated, ...inCooldown];
  }

  return [...healthy, ...inCooldown];
}

export function reportGeminiKeyFailure(key: string, isRateLimitOrQuota: boolean) {
  const now = Date.now();
  const current = keyStates.get(key) || { cooldownUntil: 0, failureCount: 0 };
  const failures = current.failureCount + 1;
  // If rate limit (429) or quota exceeded, cool down for 60s * min(failures, 5)
  const cooldownMs = isRateLimitOrQuota
    ? Math.min(failures * 60_000, 300_000)
    : 10_000;

  keyStates.set(key, {
    cooldownUntil: now + cooldownMs,
    failureCount: failures,
  });
}

export function reportGeminiKeySuccess(key: string) {
  const current = keyStates.get(key);
  if (current && (current.failureCount > 0 || current.cooldownUntil > 0)) {
    keyStates.set(key, {
      cooldownUntil: 0,
      failureCount: 0,
    });
  }
}

export function normalizeGeminiModel(rawModel?: string): string {
  if (!rawModel) return "gemini-2.0-flash";
  let model = rawModel.trim();
  if (model.startsWith("google/")) {
    model = model.slice("google/".length);
  }
  if (model.startsWith("models/")) {
    model = model.slice("models/".length);
  }
  if (!model || model === "gemini-3.7-flash") {
    return "gemini-2.0-flash";
  }
  return model;
}

export function getGeminiModelCandidates(requestedModel?: string): string[] {
  const primary = normalizeGeminiModel(
    requestedModel || process.env["GEMINI_MODEL"]
  );

  // Ordered fallback models: modern, fast, and high-quota models first
  const defaults = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
  ];

  const list = [primary, ...defaults];
  return Array.from(new Set(list));
}

export function createGeminiModel(apiKey: string, modelName: string) {
  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelName);
}
