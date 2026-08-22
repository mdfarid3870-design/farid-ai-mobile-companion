import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Server-only provider for the Lovable AI Gateway.
 * The API key never leaves the server, so no model credential is ever
 * shipped inside the web bundle or an Android APK.
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}
