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
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  ACCEPTED_ATTACHMENT_TYPES,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/ai-chat.server.types";
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
  uploadAttachment,
} from "@/lib/chat-store";
import { FRIENDLY_ERRORS, OFFLINE_MESSAGE } from "@/lib/friendly-errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  Menu,
  Moon,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Sun,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "./BrandMark";
import { ConversationDrawer } from "./ConversationDrawer";
import { MessageAttachments } from "./MessageAttachments";

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
  const [startedNewChat, setStartedNewChat] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
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
    if (activeId || startedNewChat || !conversations.data) return;
    const remembered = recallConversation();
    const match = conversations.data.find((item) => item.id === remembered);
    const next = match?.id ?? conversations.data[0]?.id ?? null;
    if (next) setActiveId(next);
  }, [activeId, startedNewChat, conversations.data]);

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

  const addFiles = useCallback(
    (picked: FileList | null) => {
      if (!picked?.length) return;
      const next: File[] = [];
      for (const file of Array.from(picked)) {
        const type = file.type || "application/octet-stream";
        if (!ACCEPTED_ATTACHMENT_TYPES.includes(type)) {
          toast.error(`${file.name} isn't supported. Use images, PDF or TXT.`);
          continue;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} is larger than 10 MB.`);
          continue;
        }
        next.push(file);
      }
      setFiles((current) => {
        const merged = [...current, ...next];
        if (merged.length > MAX_ATTACHMENTS) {
          toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
        }
        return merged.slice(0, MAX_ATTACHMENTS);
      });
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      const attached = files;
      if ((!content && attached.length === 0) || pending || uploading || !user) return;
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
          setStartedNewChat(false);
          setActiveId(created.id);
        }

        let attachments: ChatAttachment[] = [];
        if (attached.length) {
          setUploading(true);
          try {
            attachments = await Promise.all(
              attached.map((file) =>
                uploadAttachment({ file, userId: user.id, conversationId: conversationId as string }),
              ),
            );
          } finally {
            setUploading(false);
          }
        }

        const inserted = await insertUserMessage({
          conversationId,
          userId: user.id,
          content: content || `Sent ${attachments.length} file(s)`,
          attachments,
        });
        setDraft("");
        setFiles([]);
        refresh(conversationId);
        await runReply(conversationId, inserted.id, isFirstExchange);
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Message could not be sent. Please try again.",
        );
      }
    },
    [activeId, files, messages.data?.length, online, pending, refresh, runReply, uploading, user],
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
  const activeTitle = "FaridAI";

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
            setStartedNewChat(true);
            setActiveId(null);
            setDraft("");
            setFiles([]);
            setEditing(null);
            setEditValue("");
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
            <ConversationEmptyState>
              <BrandMark className="size-14 shadow-glow" />
              <h2 className="mt-3 font-display text-xl font-semibold">
                How can I help you today?
              </h2>
              <p className="text-sm text-muted-foreground">Ask anything — FARID AI is ready.</p>
              <div className="mt-4 grid w-full max-w-md gap-2">
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
                  <MessageAttachments attachments={message.attachments ?? []} />
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
            <PromptInputFooter className="flex-col items-stretch gap-2">
              {files.length ? (
                <div className="flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className="flex max-w-[70%] items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs"
                    >
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="size-3.5 shrink-0 text-primary" />
                      ) : (
                        <FileText className="size-3.5 shrink-0 text-primary" />
                      )}
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        className="text-muted-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Attach images or documents"
                  disabled={pending || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  className="hidden"
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <PromptInputSubmit
                  {...(pending || uploading ? { status: "submitted" as const } : {})}
                  disabled={pending || uploading || (draft.trim().length === 0 && files.length === 0)}
                />
              </div>
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
          setStartedNewChat(false);
          setActiveId(id);
          setDrawerOpen(false);
        }}
        onNewChat={() => {
          setStartedNewChat(true);
          setActiveId(null);
          setDraft("");
          setFiles([]);
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
