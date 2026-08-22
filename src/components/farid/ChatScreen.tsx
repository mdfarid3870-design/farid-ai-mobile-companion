import {
  Conversation as ConversationView,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useOnline } from "@/hooks/useOnline";
import { useTheme } from "@/hooks/useTheme";
import type { ChatMessage } from "@/lib/ai-chat.server.types";
import { generateReply, generateTitle } from "@/lib/chat.functions";
import {
  createConversation,
  deleteConversation,
  deleteMessagesAfter,
  fetchConversations,
  fetchMessages,
  insertUserMessage,
  recallConversation,
  rememberConversation,
  renameConversation,
  setPinned,
  updateMessage,
} from "@/lib/chat-store";
import { FRIENDLY_ERRORS, OFFLINE_MESSAGE } from "@/lib/friendly-errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Menu, Moon, Paperclip, Pencil, Plus, RefreshCw, Sun, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "./BrandMark";
import { ConversationDrawer } from "./ConversationDrawer";

const SUGGESTIONS = [
  "Explain quantum computing simply",
  "Write a polite follow-up email",
  "Give me a 20-minute workout plan",
  "Debug this JavaScript error",
];

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ChatScreen() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const online = useOnline();
  const queryClient = useQueryClient();
  const reply = useServerFn(generateReply);
  const titleFn = useServerFn(generateTitle);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });

  const messages = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => fetchMessages(activeId as string),
    enabled: Boolean(activeId),
  });

  // Restore the chat the user had open last time the app was launched.
  useEffect(() => {
    if (activeId || !conversations.data) return;
    const remembered = recallConversation();
    const match = conversations.data.find((item) => item.id === remembered);
    const next = match?.id ?? conversations.data[0]?.id ?? null;
    if (next) setActiveId(next);
  }, [activeId, conversations.data]);

  useEffect(() => {
    rememberConversation(activeId);
  }, [activeId]);

  const refresh = useCallback(
    (conversationId: string | null) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      }
    },
    [queryClient],
  );

  const runReply = useCallback(
    async (conversationId: string, messageId: string, isFirstExchange: boolean) => {
      setPending(true);
      try {
        const result = await reply({ data: { conversationId, messageId } });
        if (!result.ok) toast.error(FRIENDLY_ERRORS[result.kind]);
        if (result.ok && isFirstExchange) {
          await titleFn({ data: { conversationId } }).catch(() => undefined);
        }
      } catch {
        toast.error(FRIENDLY_ERRORS.server);
      } finally {
        setPending(false);
        refresh(conversationId);
      }
    },
    [refresh, reply, titleFn],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || pending || !user) return;
      if (!online) {
        toast.error(OFFLINE_MESSAGE);
        return;
      }

      let conversationId = activeId;
      let isFirstExchange = (messages.data?.length ?? 0) === 0;
      try {
        if (!conversationId) {
          const created = await createConversation(user.id);
          conversationId = created.id;
          isFirstExchange = true;
          setActiveId(created.id);
        }
        const inserted = await insertUserMessage({
          conversationId,
          userId: user.id,
          content,
        });
        setDraft("");
        refresh(conversationId);
        await runReply(conversationId, inserted.id, isFirstExchange);
      } catch {
        toast.error("Message could not be sent. Please try again.");
      }
    },
    [activeId, messages.data?.length, online, pending, refresh, runReply, user],
  );

  const regenerate = useCallback(
    async (assistant: ChatMessage) => {
      if (!activeId || pending) return;
      if (!online) {
        toast.error(OFFLINE_MESSAGE);
        return;
      }
      const list = messages.data ?? [];
      const index = list.findIndex((item) => item.id === assistant.id);
      const previousUser = [...list.slice(0, index)].reverse().find((item) => item.role === "user");
      if (!previousUser) return;
      await deleteMessagesAfter(activeId, previousUser.created_at);
      refresh(activeId);
      await runReply(activeId, previousUser.id, list.length <= 2);
    },
    [activeId, messages.data, online, pending, refresh, runReply],
  );

  const submitEdit = useCallback(async () => {
    if (!editing || !activeId) return;
    const content = editValue.trim();
    if (!content) return;
    if (!online) {
      toast.error(OFFLINE_MESSAGE);
      return;
    }
    setEditing(null);
    await updateMessage(editing.id, content);
    await deleteMessagesAfter(activeId, editing.created_at);
    refresh(activeId);
    await runReply(activeId, editing.id, false);
  }, [activeId, editValue, editing, online, refresh, runReply]);

  const removeConversation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_data, id) => {
      if (id === activeId) setActiveId(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => toast.error("Chat could not be deleted."),
  });

  const list = messages.data ?? [];
  const activeTitle =
    conversations.data?.find((item) => item.id === activeId)?.title ?? "FARID AI";

  return (
    <div className="app-shell flex flex-col bg-background">
      <header className="safe-top flex items-center gap-1 border-b border-border/60 bg-background/90 px-2 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Open chats"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BrandMark className="size-7" />
          <span className="truncate font-display text-sm font-semibold">{activeTitle}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="New chat"
          onClick={() => {
            setActiveId(null);
            setDraft("");
          }}
        >
          <Plus className="size-5" />
        </Button>
      </header>

      {!online ? (
        <div className="flex items-center justify-center gap-2 bg-destructive/15 px-3 py-2 text-xs text-destructive">
          <WifiOff className="size-3.5" /> {OFFLINE_MESSAGE}
        </div>
      ) : null}

      <ConversationView className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-3 pb-4">
          {list.length === 0 && !pending ? (
            <ConversationEmptyState
              icon={<BrandMark className="size-12" />}
              title="How can I help you today?"
              description="Ask anything — FARID AI is ready."
            >
              <div className="mt-4 grid w-full gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="tap-target rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-card-foreground transition-colors active:bg-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : null}

          {list.map((message) =>
            editing?.id === message.id ? (
              <div key={message.id} className="ml-auto w-full max-w-[95%] space-y-2">
                <Textarea
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  className="min-h-24 text-base"
                  aria-label="Edit message"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" className="tap-target" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button className="tap-target" onClick={submitEdit}>
                    Send
                  </Button>
                </div>
              </div>
            ) : (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.role === "assistant" ? (
                    <MessageResponse>{message.content}</MessageResponse>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </MessageContent>
                <MessageActions>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy message"
                    onClick={async () => {
                      const done = await copyToClipboard(message.content);
                      if (!done) {
                        toast.error("Copying isn't available on this device.");
                        return;
                      }
                      setCopiedId(message.id);
                      window.setTimeout(() => setCopiedId(null), 1500);
                    }}
                  >
                    {copiedId === message.id ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                  {message.role === "assistant" ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Regenerate reply"
                      disabled={pending}
                      onClick={() => regenerate(message)}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit message"
                      disabled={pending}
                      onClick={() => {
                        setEditing(message);
                        setEditValue(message.content);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </MessageActions>
              </Message>
            ),
          )}

          {pending ? (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>FARID AI is thinking…</Shimmer>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </ConversationView>

      <div className="safe-bottom border-t border-border/60 bg-background px-3 pb-2 pt-2">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(message: PromptInputMessage, event) => {
              event.preventDefault();
              send(message.text || draft);
            }}
          >
            <PromptInputTextarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message FARID AI…"
              className="text-base"
            />
            <PromptInputFooter className="justify-between">
              {/* File analysis is not implemented yet; the picker is honest about it. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Attach a file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.length) {
                    toast("File attachments are coming soon — FARID AI can't read files yet.");
                  }
                  event.target.value = "";
                }}
              />
              <PromptInputSubmit
                {...(pending ? { status: "submitted" as const } : {})}
                disabled={pending || draft.trim().length === 0}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>

      <ConversationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        conversations={conversations.data ?? []}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setDrawerOpen(false);
        }}
        onNewChat={() => {
          setActiveId(null);
          setDraft("");
          setDrawerOpen(false);
        }}
        onRename={async (id, title) => {
          try {
            await renameConversation(id, title);
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          } catch {
            toast.error("Chat could not be renamed.");
          }
        }}
        onTogglePin={async (conversation) => {
          try {
            await setPinned(conversation.id, !conversation.pinned);
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          } catch {
            toast.error("Chat could not be updated.");
          }
        }}
        onDelete={(id) => removeConversation.mutate(id)}
        accountEmail={user?.email ?? undefined}
        onSignOut={signOut}
      />
    </div>
  );
}
