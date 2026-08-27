import type { SupabaseClient } from "@supabase/supabase-js";
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
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
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

// ===========================
// ✨ NEW FEATURES - 15 ENHANCEMENTS
// ===========================

/**
 * Extra helper set kept for upcoming features. Some of these target tables and
 * columns that are not part of the current schema yet, so they go through a
 * loosely typed client instead of the generated types.
 */
const db = supabase as unknown as SupabaseClient<any>;

// 🔍 1. SEARCH MESSAGES
export async function searchMessages(searchText: string): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .ilike("content", `%${searchText}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

// 🏷️ 2. CONVERSATION TAGS
export async function addConversationTag(conversationId: string, tag: string) {
  const tags = await getConversationTags(conversationId);
  if (!tags.includes(tag)) {
    tags.push(tag);
    const { error } = await db
      .from("conversations")
      .update({ tags })
      .eq("id", conversationId);
    if (error) throw error;
  }
}

export async function getConversationTags(conversationId: string): Promise<string[]> {
  const { data, error } = await db
    .from("conversations")
    .select("tags")
    .eq("id", conversationId)
    .single();

  if (error) throw error;
  return (data?.tags as string[]) ?? [];
}

export async function removeConversationTag(conversationId: string, tag: string) {
  const tags = await getConversationTags(conversationId);
  const updated = tags.filter((t) => t !== tag);
  const { error } = await db
    .from("conversations")
    .update({ tags: updated })
    .eq("id", conversationId);
  if (error) throw error;
}

// 👍 3. MESSAGE REACTIONS
export async function addMessageReaction(messageId: string, type: "like" | "helpful" | "bookmark") {
  const { error } = await db
    .from("messages")
    .update({ reactions: { [type]: true } })
    .eq("id", messageId);
  if (error) throw error;
}

// 💾 4. EXPORT CONVERSATION
export async function exportConversation(conversationId: string, format: "json" | "txt" | "markdown") {
  const { data: messages, error: msgError } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError) throw msgError;

  const { data: conv } = await db
    .from("conversations")
    .select("title")
    .eq("id", conversationId)
    .single();

  const title = (conv as any)?.title || "Chat Export";

  switch (format) {
    case "json":
      return JSON.stringify({ title, messages }, null, 2);
    case "txt":
      return (messages ?? [])
        .map((m: any) => `[${m.role.toUpperCase()}]\n${m.content}\n`)
        .join("\n---\n\n");
    case "markdown":
      return `# ${title}\n\n${(messages ?? [])
        .map((m: any) => `**${m.role === "user" ? "👤 You" : "🤖 FARID AI"}**\n\n${m.content}\n\n`)
        .join("---\n\n")}`;
    default:
      return JSON.stringify(messages);
  }
}

// 📊 5. CHAT STATISTICS
export async function getChatStats(userId: string) {
  const { data: conversations } = await db
    .from("conversations")
    .select("id")
    .eq("user_id", userId);

  const { data: messages } = await db
    .from("messages")
    .select("id")
    .eq("user_id", userId);

  return {
    totalConversations: conversations?.length ?? 0,
    totalMessages: messages?.length ?? 0,
    averageMessagesPerChat: conversations && messages 
      ? messages.length / (conversations.length || 1)
      : 0,
  };
}

// 👤 6. USER PROFILE
export async function getUserProfile(userId: string) {
  const { data, error } = await db
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function updateUserProfile(userId: string, profile: any) {
  const { data, error } = await db
    .from("user_profiles")
    .upsert({
      user_id: userId,
      ...profile,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ⚙️ 7. USER SETTINGS
export async function getUserSettings(userId: string) {
  const { data, error } = await db
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function updateUserSettings(userId: string, settings: any) {
  const { data, error } = await db
    .from("user_settings")
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ⭐ 8. SAVED MESSAGES
export async function saveMessage(userId: string, messageId: string) {
  const { error } = await db
    .from("saved_messages")
    .insert({ user_id: userId, message_id: messageId });

  if (error) throw error;
}

export async function getSavedMessages(userId: string) {
  const { data, error } = await db
    .from("saved_messages")
    .select("message_id")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}

// 📦 9. ARCHIVED CHATS
export async function archiveConversation(conversationId: string, archived: boolean) {
  const { error } = await db
    .from("conversations")
    .update({ archived })
    .eq("id", conversationId);

  if (error) throw error;
}

// ⚡ 10. QUICK ACTIONS
export async function addQuickAction(userId: string, name: string, prompt: string) {
  const { data, error } = await db
    .from("quick_actions")
    .insert({ user_id: userId, name, prompt })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getQuickActions(userId: string) {
  const { data, error } = await db
    .from("quick_actions")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}

// 🔀 11. CONVERSATION BRANCHING
export async function createConversationBranch(messageId: string, response: string) {
  const { data, error } = await db
    .from("message_branches")
    .insert({ message_id: messageId, response })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMessageBranches(messageId: string) {
  const { data, error } = await db
    .from("message_branches")
    .select("*")
    .eq("message_id", messageId);

  if (error) throw error;
  return data ?? [];
}

// 📌 12. PINNED MESSAGES
export async function pinMessage(messageId: string, pinned: boolean) {
  const { error } = await db
    .from("messages")
    .update({ pinned })
    .eq("id", messageId);

  if (error) throw error;
}

export async function getPinnedMessages(conversationId: string) {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("pinned", true);

  if (error) throw error;
  return data ?? [];
}

// 🌐 13. LANGUAGE SUPPORT
export async function translateMessage(text: string, targetLanguage: string) {
  // Ready for translation API integration
  return text;
}

// 🗑️ 14. AUTO DELETE CHATS
export async function setAutoDeleteChat(conversationId: string, daysAfter: number | null) {
  const { error } = await db
    .from("conversations")
    .update({ auto_delete_after_days: daysAfter })
    .eq("id", conversationId);

  if (error) throw error;
}

// 📈 15. CONVERSATION ANALYTICS
export async function getConversationAnalytics(conversationId: string) {
  const { data: messages } = await db
    .from("messages")
    .select("role, created_at")
    .eq("conversation_id", conversationId);

  const userMessages = (messages ?? []).filter((m: any) => m.role === "user").length;
  const assistantMessages = (messages ?? []).filter((m: any) => m.role === "assistant").length;

  return {
    totalMessages: (messages ?? []).length,
    userMessages,
    assistantMessages,
    ratio: userMessages > 0 ? assistantMessages / userMessages : 0,
  };
}
