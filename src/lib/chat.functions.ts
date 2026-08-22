import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ReplyInput = z.object({
  conversationId: z.string().uuid(),
  /** Id of the last user message that the reply should answer. */
  messageId: z.string().uuid(),
});

const TitleInput = z.object({
  conversationId: z.string().uuid(),
});

/**
 * Generates the assistant reply for a conversation.
 * The full conversation history is read from the database (server side, under
 * the caller's own row-level access rules), sent to the model, and the reply is
 * persisted. The model credential stays on the server at all times.
 */
export const generateReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReplyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runAssistantReply } = await import("./ai-chat.server");
    return runAssistantReply({
      supabase: context.supabase,
      userId: context.userId,
      conversationId: data.conversationId,
      untilMessageId: data.messageId,
    });
  });

/** Derives a short conversation title from the first exchange. */
export const generateTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TitleInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runTitleGeneration } = await import("./ai-chat.server");
    return runTitleGeneration({
      supabase: context.supabase,
      userId: context.userId,
      conversationId: data.conversationId,
    });
  });
