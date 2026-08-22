/** Client-safe types shared with the server chat helpers. */
export type AssistantFailure =
  | "offline"
  | "config"
  | "quota"
  | "blocked"
  | "bad_request"
  | "server";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};
