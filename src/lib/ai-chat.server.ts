import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, streamText, type LanguageModel, type ModelMessage } from "ai";

import {
  ATTACHMENT_BUCKET,
  type AssistantFailure,
  type ChatAttachment,
} from "./ai-chat.server.types";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import {
  createGeminiModel,
  getGeminiApiKeys,
  getGeminiModelCandidates,
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

async function loadHistory(supabase: Client, conversationId: string, untilMessageId?: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at, attachments")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = data ?? [];
  if (!untilMessageId) return rows;
  const index = rows.findIndex((row) => row.id === untilMessageId);
  return index === -1 ? rows : rows.slice(0, index + 1);
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
}): Promise<AssistantResult> {
  const { supabase, userId, conversationId, untilMessageId } = params;
  const geminiKeys = getGeminiApiKeys();
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
    const systemPrompt = `${SYSTEM_PROMPT} ${ownerPromptBlock(Boolean(ownerRow))}`;
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

    // 1. Try Gemini API keys with rotation and model fallbacks
    if (geminiKeys.length > 0) {
      const modelCandidates = getGeminiModelCandidates();
      for (const key of geminiKeys) {
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
              break;
            }
          } catch (err) {
            console.error(`[farid-ai] Gemini API error (model: ${modelCandidate}):`, err);
            lastError = err;
          }
        }
        if (text) break;
      }
    }

    // 2. Fallback to Lovable AI Gateway if Gemini didn't produce text
    if (!text && lovableKey) {
      try {
        const gateway = createLovableAiGatewayProvider(lovableKey);
        const defaultModel = process.env["GEMINI_MODEL"] || "google/gemini-3.7-flash";
        const result = streamText({
          model: gateway(defaultModel),
          system: systemPrompt,
          messages: modelMessages as ModelMessage[],
        });
        text = (await result.text).trim();
      } catch (err) {
        console.error("[farid-ai] Lovable Gateway error:", err);
        lastError = err;
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
  const geminiKeys = getGeminiApiKeys();
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
              break;
            }
          } catch (err) {
            console.error(`[farid-ai] title gen Gemini error (${modelCandidate}):`, err);
          }
        }
        if (generatedText) break;
      }
    }

    // 2. Fallback to Lovable Gateway
    if (!generatedText && lovableKey) {
      try {
        const gateway = createLovableAiGatewayProvider(lovableKey);
        const { text } = await generateText({
          model: gateway(process.env["GEMINI_MODEL"] || "google/gemini-3.1-flash-lite"),
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
