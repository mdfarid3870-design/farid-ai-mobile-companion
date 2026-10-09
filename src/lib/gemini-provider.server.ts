import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Server-only helper for Google Gemini API integration.
 * Supports single key or comma-separated list of keys in GEMINI_API_KEY
 * for automatic key rotation and high availability.
 */

export function getGeminiApiKeys(): string[] {
  const rawEnv = process.env["GEMINI_API_KEY"] || "";
  return rawEnv
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function normalizeGeminiModel(rawModel?: string): string {
  if (!rawModel) return "gemini-2.0-flash";
  let model = rawModel.trim();
  if (model.startsWith("google/")) {
    model = model.slice("google/".length);
  }
  if (!model || model === "gemini-3.7-flash") {
    return "gemini-2.0-flash";
  }
  return model;
}

export function getGeminiModelCandidates(requestedModel?: string): string[] {
  const primary = normalizeGeminiModel(requestedModel || process.env["GEMINI_MODEL"]);
  const defaults = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash-lite",
  ];
  const list = [primary, ...defaults];
  return Array.from(new Set(list));
}

export function createGeminiModel(apiKey: string, modelName: string) {
  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelName);
}
