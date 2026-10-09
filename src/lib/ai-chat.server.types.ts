/** Client-safe types shared with the server chat helpers. */
export type AssistantFailure =
  "offline" | "config" | "quota" | "blocked" | "bad_request" | "server";

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
  "image/*",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/*",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];
export const ACCEPTED_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".zip",
  ".doc",
  ".docx",
  ".txt",
  ".mp4",
  ".mov",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
];

export function isAcceptedAttachmentType(file: File): boolean {
  if (file.type) {
    for (const type of ACCEPTED_ATTACHMENT_TYPES) {
      if (type.endsWith("/*")) {
        if (file.type.startsWith(type.slice(0, -1))) return true;
      } else if (type === file.type) {
        return true;
      }
    }
  }
  const lastDot = file.name.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = file.name.toLowerCase().slice(lastDot);
  return ACCEPTED_ATTACHMENT_EXTENSIONS.includes(ext);
}

export const ATTACHMENT_ACCEPT = "image/*,video/*,.pdf,.zip,.doc,.docx,.txt,.mp4,.mov";
