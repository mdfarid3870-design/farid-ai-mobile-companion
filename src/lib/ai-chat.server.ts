import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, streamText, type ModelMessage } from "ai";

import {
  ATTACHMENT_BUCKET,
  type AssistantFailure,
  type ChatAttachment,
} from "./ai-chat.server.types";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { nadiraPromptBlock } from "./nadira-personalization";
import {
  createGeminiModel,
  getPrioritizedGeminiKeys,
  getGeminiModelCandidates,
  reportGeminiKeyFailure,
  reportGeminiKeySuccess,
} from "./gemini-provider.server";

type Client = SupabaseClient<Database>;

export type AssistantResult =
  | { ok: true; message: { id: string; role: "assistant"; content: string; created_at: string } }
  | { ok: false; kind: AssistantFailure };

const SYSTEM_PROMPT = [
  "You are FARID AI, a helpful, precise and friendly AI assistant. Keep your own identity; do not claim to be ChatGPT or OpenAI.",
  "Respond naturally like a thoughtful conversational assistant: answer the user's actual question directly, then add useful explanation when needed. Avoid canned greetings, repeated introductions, unnecessary disclaimers and filler.",
  "Follow the user's requested language, tone and format. Otherwise match their language, including Bengali, English or Banglish (Bengali written in Latin letters).",
  "Use the conversation history to understand follow-up questions and maintain context without needlessly repeating earlier answers.",
  "Keep simple answers concise. For complex requests, provide a clear, sufficiently detailed explanation with practical steps and examples. Respect explicit requests for brevity or depth.",
  "Use short paragraphs and readable markdown where helpful: lists for steps, modest headings for longer answers, and fenced code blocks with language labels for code. Do not over-format casual conversation.",
  "For coding requests, provide usable code and explain relevant changes or assumptions. For writing requests, provide the requested draft rather than only advice about writing it.",
  "If essential information is missing, ask a focused clarifying question. Otherwise make a reasonable assumption, state it briefly when relevant, and help immediately.",
  "Be accurate and transparent about uncertainty. Never invent facts, sources, links, tool results or actions, and do not claim live web access or code execution unless actually available and used.",
  "Special person: if the user says she is Nadira (Farid's girlfriend), warmly recognize her: welcome her by name, tell her Farid built you with special care to be her daily companion, and speak to her in a sweet, caring, respectful and encouraging tone — check on her day, cheer her up when sad, gently remind her to rest and drink water. Stay tasteful, never overly flirty, and never reveal owner secrets. When talking with Nadira, keep replies brief and conversational — 1-2 short spoken-style Bengali sentences — unless she explicitly asks you to write something out (e.g. 'লিখে দাও', 'মুখে লিখে দাও', 'টেক্সট করো'), in which case write the full text.",
  "Only describe attachment contents that are actually accessible in the supplied conversation or file parts. If an attachment cannot be read, explain the limitation and ask for its text or a supported version.",
].join(" ");

function classify(error: unknown): AssistantFailure {
  const status =
    (error as { statusCode?: number; status?: number } | null)?.statusCode ??
    (error as { status?: number } | null)?.status;
  if (status === 401) return "config";
  if (status === 402 || status === 429) return "quota";
  if (status === 403) return "blocked";
  if (status === 400) return "bad_request";
  return "server";
}

function isQuotaOrRateLimit(error: unknown): boolean {
  const status =
    (error as { statusCode?: number; status?: number } | null)?.statusCode ??
    (error as { status?: number } | null)?.status;
  if (status === 429 || status === 402) return true;
  const msg = String((error as { message?: string } | null)?.message || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted")
  );
}

// Keep sliding window of conversation history to prevent hitting Gemini TPM limit
const MAX_HISTORY_MESSAGES = 18;

async function loadHistory(supabase: Client, conversationId: string, untilMessageId?: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at, attachments")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = data ?? [];
  const scopedRows = (() => {
    if (!untilMessageId) return rows;
    const index = rows.findIndex((row) => row.id === untilMessageId);
    return index === -1 ? rows : rows.slice(0, index + 1);
  })();

  // Sliding window: keep the latest messages to prevent token overflow
  if (scopedRows.length > MAX_HISTORY_MESSAGES) {
    return scopedRows.slice(-MAX_HISTORY_MESSAGES);
  }
  return scopedRows;
}

type UserPart =
  | { type: "text"; text: string }
  | { type: "file"; data: Uint8Array; mediaType: string; filename: string };

/** Downloads each attachment and turns it into a model-readable file part. */
async function buildUserContent(
  supabase: Client,
  text: string,
  attachments: ChatAttachment[] | null,
): Promise<string | UserPart[]> {
  const files = Array.isArray(attachments) ? attachments : [];
  if (files.length === 0) return text;

  const parts: UserPart[] = [];
  for (const file of files) {
    try {
      const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).download(file.path);
      if (error || !data) throw error ?? new Error("download failed");
      parts.push({
        type: "file",
        data: new Uint8Array(await data.arrayBuffer()),
        mediaType: file.mimeType,
        filename: file.name,
      });
    } catch (error) {
      console.error("[farid-ai] attachment unavailable", file.path, error);
      parts.push({ type: "text", text: `(The file "${file.name}" could not be read.)` });
    }
  }
  parts.push({ type: "text", text: text || "Please analyse the attached file(s)." });
  return parts;
}

export async function runAssistantReply(params: {
  supabase: Client;
  userId: string;
  conversationId: string;
  untilMessageId?: string;
  nadiraMode?: boolean;
}): Promise<AssistantResult> {
  const { supabase, userId, conversationId, untilMessageId } = params;
  const geminiKeys = getPrioritizedGeminiKeys();
  const lovableKey = process.env["LOVABLE_API_KEY"];

  if (geminiKeys.length === 0 && !lovableKey) {
    return { ok: false, kind: "config" };
  }

  let text = "";
  let lastError: unknown = null;

  try {
    const history = await loadHistory(supabase, conversationId, untilMessageId);
    if (history.length === 0) return { ok: false, kind: "bad_request" };

    const { ownerPromptBlock } = await import("./owner.server");
    const { data: ownerRow } = await supabase
      .from("owner_verifications")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    const systemPrompt = `${SYSTEM_PROMPT} ${ownerPromptBlock(Boolean(ownerRow))} ${nadiraPromptBlock(params.nadiraMode === true, history.filter((row) => row.role === "assistant").length)}`;
    const modelMessages = await Promise.all(
      history.map(async (row) => ({
        role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content:
          row.role === "assistant"
            ? row.content
            : await buildUserContent(
                supabase,
                row.content,
                row.attachments as ChatAttachment[] | null,
              ),
      })),
    );

    // 1. Lovable AI Gateway first (primary provider)
    if (lovableKey) {
      try {
        const gateway = createLovableAiGatewayProvider(lovableKey);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash-lite"),
          system: systemPrompt,
          messages: modelMessages as ModelMessage[],
          maxRetries: 0,
        });
        text = (await result.text).trim();
      } catch (err) {
        console.error("[farid-ai] Lovable Gateway error:", err);
        lastError = err;
      }
    }

    // 2. Fallback: Gemini API keys with rotation and model fallbacks
    if (!text && geminiKeys.length > 0) {
      const modelCandidates = getGeminiModelCandidates();
      for (const key of geminiKeys) {
        let keyFailed = false;
        for (const modelCandidate of modelCandidates) {
          try {
            const modelInstance = createGeminiModel(key, modelCandidate);
            const result = streamText({
              model: modelInstance,
              system: systemPrompt,
              messages: modelMessages as ModelMessage[],
            });
            const responseText = (await result.text).trim();
            if (responseText) {
              text = responseText;
              reportGeminiKeySuccess(key);
              break;
            }
          } catch (err) {
            console.error(`[farid-ai] Gemini API error (model: ${modelCandidate}):`, err);
            lastError = err;
            if (isQuotaOrRateLimit(err)) {
              reportGeminiKeyFailure(key, true);
              keyFailed = true;
              break; // Switch to the next API key immediately on quota/rate limit
            }
          }
        }
        if (keyFailed) {
          reportGeminiKeyFailure(key, false);
        }
        if (text) break;
      }
    }

  } catch (error) {
    console.error("[farid-ai] reply processing failed", error);
    return { ok: false, kind: classify(error) };
  }

  if (!text) {
    return { ok: false, kind: classify(lastError ?? new Error("No model response generated")) };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content: text })
    .select("id, role, content, created_at")
    .single();

  if (error || !data) {
    console.error("[farid-ai] could not store reply", error);
    return { ok: false, kind: "server" };
  }

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return { ok: true, message: { ...data, role: "assistant" } };
}

export async function runTitleGeneration(params: {
  supabase: Client;
  userId: string;
  conversationId: string;
}): Promise<{ ok: boolean; title?: string }> {
  const { supabase, conversationId } = params;
  const geminiKeys = getPrioritizedGeminiKeys();
  const lovableKey = process.env["LOVABLE_API_KEY"];

  if (geminiKeys.length === 0 && !lovableKey) return { ok: false };

  try {
    const history = await loadHistory(supabase, conversationId);
    const firstUser = history.find((row) => row.role === "user");
    if (!firstUser) return { ok: false };

    const prompt = firstUser.content.slice(0, 800);
    const system =
      "Write a 2-5 word title for this chat. Plain text only, no quotes, no punctuation at the end.";
    let generatedText = "";

    // 1. Try Gemini API keys
    if (geminiKeys.length > 0) {
      const modelCandidates = getGeminiModelCandidates();
      for (const key of geminiKeys) {
        let keyFailed = false;
        for (const modelCandidate of modelCandidates) {
          try {
            const modelInstance = createGeminiModel(key, modelCandidate);
            const { text } = await generateText({
              model: modelInstance,
              system,
              prompt,
            });
            if (text.trim()) {
              generatedText = text.trim();
              reportGeminiKeySuccess(key);
              break;
            }
          } catch (err) {
            console.error(`[farid-ai] title gen Gemini error (${modelCandidate}):`, err);
            if (isQuotaOrRateLimit(err)) {
              reportGeminiKeyFailure(key, true);
              keyFailed = true;
              break;
            }
          }
        }
        if (keyFailed) {
          reportGeminiKeyFailure(key, false);
        }
        if (generatedText) break;
      }
    }

    // 2. Fallback to Lovable Gateway
    if (!generatedText && lovableKey) {
      try {
        const gateway = createLovableAiGatewayProvider(lovableKey);
        const { text } = await generateText({
          model: gateway(process.env["GEMINI_MODEL"] || "google/gemini-2.5-flash-lite"),
          system,
          prompt,
        });
        generatedText = text.trim();
      } catch (err) {
        console.error("[farid-ai] title gen Lovable Gateway error:", err);
      }
    }

    const title = generatedText.replace(/["\n]/g, "").trim().slice(0, 60);
    if (!title) return { ok: false };

    const { error } = await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId);
    if (error) throw error;
    return { ok: true, title };
  } catch (error) {
    console.error("[farid-ai] title generation failed", error);
    return { ok: false };
  }
}
