import type { AssistantFailure } from "./ai-chat.server.types";

/** User-facing copy. Raw server errors and stack traces are never surfaced. */
export const FRIENDLY_ERRORS: Record<AssistantFailure, string> = {
  offline: "Internet connection is unavailable.",
  config: "FARID AI server is temporarily unavailable.",
  quota: "AI usage limit has been reached. Please try again later.",
  blocked: "AI access is currently disabled for this app.",
  bad_request: "That message could not be processed. Try rephrasing it.",
  server: "FARID AI server is temporarily unavailable.",
};

export const OFFLINE_MESSAGE = "You're offline. Please reconnect to use FARID AI.";
