import { supabase } from "@/integrations/supabase/client";
import {
  ATTACHMENT_BUCKET,
  MAX_ATTACHMENT_BYTES,
  isAcceptedAttachmentType,
  type ChatAttachment,
  type ChatMessage,
  type Conversation,
} from "@/lib/ai-chat.server.types";

const LAST_CONVERSATION_KEY = "farid-ai-last-conversation";

/** Remembers the open conversation so reopening the app restores it. */
export function rememberConversation(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_CONVERSATION_KEY, id);
    else localStorage.removeItem(LAST_CONVERSATION_KEY);
  } catch {
    /* ignore restricted storage */
  }
}

export function recallConversation(): string | null {
  try {
    return localStorage.getItem(LAST_CONVERSATION_KEY);
  } catch {
    return null;
  }
}

export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, pinned, created_at, updated_at")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at, attachments")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function createConversation(userId: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title: "New chat" })
    .select("id, title, pinned, created_at, updated_at")
    .single();
  if (error || !data) throw error ?? new Error("Could not create chat");
  return data;
}

export async function insertUserMessage(params: {
  conversationId: string;
  userId: string;
  content: string;
  attachments?: ChatAttachment[];
}): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      user_id: params.userId,
      role: "user",
      content: params.content,
      attachments: params.attachments ?? [],
    })
    .select("id, conversation_id, role, content, created_at, attachments")
    .single();
  if (error || !data) throw error ?? new Error("Could not send message");
  return data as ChatMessage;
}

export async function renameConversation(id: string, title: string) {
  const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function setPinned(id: string, pinned: boolean) {
  const { error } = await supabase.from("conversations").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function updateMessage(id: string, content: string) {
  const { error } = await supabase.from("messages").update({ content }).eq("id", id);
  if (error) throw error;
}

/** Removes every message created after the given message (used by edit/regenerate). */
export async function deleteMessagesAfter(conversationId: string, createdAt: string) {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId)
    .gt("created_at", createdAt);
  if (error) throw error;
}

export async function deleteMessage(id: string) {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

/** Uploads one attachment into the caller's private folder and returns its metadata. */
export async function uploadAttachment(params: {
  file: File;
  userId: string;
  conversationId: string;
}): Promise<ChatAttachment> {
  const { file, userId, conversationId } = params;
  if (!isAcceptedAttachmentType(file)) {
    throw new Error(
      `${file.name} isn't a supported file type. Use photos, videos, PDFs, ZIPs, DOC/DOCX, or TXT.`,
    );
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is larger than 10 MB.`);
  }

  const mimeType = file.type || "application/octet-stream";
  const path = `${userId}/${conversationId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`${file.name} could not be uploaded.`);

  return { path, name: file.name, mimeType, size: file.size };
}

/** Short-lived signed URL so attachments can be previewed or opened. */
export async function signAttachment(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data) throw error ?? new Error("Could not open the file");
  return data.signedUrl;
}
