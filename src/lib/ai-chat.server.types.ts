/** Client-safe types shared with the server chat helpers. */
export type AssistantFailure =
  | "offline"
  | "config"
  | "quota"
  | "blocked"
  | "bad_request"
  | "server";

/** A file the user attached to a message (stored in the private chat bucket). */
export type ChatAttachment = {
  /** Storage path inside the `chat-attachments` bucket. */
  path: string;
  name: string;
  mimeType: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  attachments: ChatAttachment[];
};

export type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export const ATTACHMENT_BUCKET = "chat-attachments";
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];
export const ATTACHMENT_ACCEPT = ACCEPTED_ATTACHMENT_TYPES.join(",");
