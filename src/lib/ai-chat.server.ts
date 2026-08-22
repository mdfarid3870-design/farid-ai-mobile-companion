import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, streamText } from "ai";

import { ATTACHMENT_BUCKET, type AssistantFailure, type ChatAttachment } from "./ai-chat.server.types";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

type Client = SupabaseClient<Database>;

export type AssistantResult =
  | { ok: true; message: { id: string; role: "assistant"; content: string; created_at: string } }
  | { ok: false; kind: AssistantFailure };

const SYSTEM_PROMPT = [
  "You are FARID AI, a helpful, precise and friendly AI assistant.",
  "Answer in the language the user writes in.",
  "Use short paragraphs and markdown (lists, bold, code blocks) when it helps readability.",
  "Never claim you can read attached files unless their text is included in the conversation.",
].join(" ");

function defaultModel() {
  return process.env["GEMINI_MODEL"] || "google/gemini-3.7-flash";
}

function classify(error: unknown): AssistantFailure {
  const status = (error as { statusCode?: number; status?: number } | null)?.statusCode ??
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
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, kind: "config" };

  let text: string;
  try {
    const history = await loadHistory(supabase, conversationId, untilMessageId);
    if (history.length === 0) return { ok: false, kind: "bad_request" };

    const gateway = createLovableAiGatewayProvider(apiKey);
    const modelMessages = await Promise.all(
      history.map(async (row) => ({
        role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content:
          row.role === "assistant"
            ? row.content
            : await buildUserContent(supabase, row.content, row.attachments as ChatAttachment[] | null),
      })),
    );
    // Streamed inside the handler so long answers never stall the connection.
    const result = streamText({
      model: gateway(defaultModel()),
      system: SYSTEM_PROMPT,
      messages: modelMessages as Parameters<typeof streamText>[0]["messages"],
    });
    text = (await result.text).trim();
  } catch (error) {
    console.error("[farid-ai] reply failed", error);
    return { ok: false, kind: classify(error) };
  }

  if (!text) return { ok: false, kind: "server" };

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
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false };

  try {
    const history = await loadHistory(supabase, conversationId);
    const firstUser = history.find((row) => row.role === "user");
    if (!firstUser) return { ok: false };

    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway(process.env["GEMINI_MODEL"] || "google/gemini-3.1-flash-lite"),
      system: "Write a 2-5 word title for this chat. Plain text only, no quotes, no punctuation at the end.",
      prompt: firstUser.content.slice(0, 800),
    });

    const title = text.replace(/["\n]/g, "").trim().slice(0, 60);
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
