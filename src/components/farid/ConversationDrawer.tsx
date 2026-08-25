import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Conversation } from "@/lib/ai-chat.server.types";
import { Pencil, Pin, PinOff, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BrandMark } from "./BrandMark";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (conversation: Conversation) => void;
  onDelete: (id: string) => void;
  accountEmail?: string | undefined;
  onSignOut: () => void;
  ownerVerified: boolean;
  onVerifyOwner: (code: string) => Promise<boolean>;
};

export function ConversationDrawer({
  open,
  onOpenChange,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onTogglePin,
  onDelete,
  accountEmail,
  onSignOut,
  ownerVerified,
  onVerifyOwner,
}: Props) {
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerCode, setOwnerCode] = useState("");
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Android hardware back closes the drawer instead of leaving the app.
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ faridDrawer: true }, "");
    const onPop = () => onOpenChange(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, onOpenChange]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((item) => item.title.toLowerCase().includes(term));
  }, [conversations, query]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[86vw] max-w-sm bg-sidebar p-0 safe-top safe-bottom">
          <SheetHeader className="border-b border-sidebar-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-left">
              <BrandMark className="size-7" />
              <span className="font-display text-base">FARID AI</span>
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-3 px-3 pt-3">
            <Button className="tap-target w-full justify-start gap-2" onClick={onNewChat}>
              <Plus className="size-4" /> New chat
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chats"
                className="h-11 pl-9"
                aria-label="Search chats"
              />
            </div>
          </div>

          <nav className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">No chats found.</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((conversation) => (
                  <li key={conversation.id}>
                    <div
                      className={`flex items-center gap-1 rounded-lg px-1 ${
                        conversation.id === activeId ? "bg-sidebar-accent" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(conversation.id)}
                        className="tap-target flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-sidebar-foreground transition-colors active:bg-sidebar-accent"
                      >
                        {conversation.pinned ? (
                          <Pin className="size-3.5 shrink-0 text-primary" />
                        ) : null}
                        <span className="truncate">{conversation.title}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={conversation.pinned ? "Unpin chat" : "Pin chat"}
                        onClick={() => onTogglePin(conversation)}
                      >
                        {conversation.pinned ? (
                          <PinOff className="size-4" />
                        ) : (
                          <Pin className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Rename chat"
                        onClick={() => {
                          setRenaming(conversation);
                          setRenameValue(conversation.title);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete chat"
                        onClick={() => setDeleting(conversation)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          <div className="border-t border-sidebar-border px-4 py-3">
            <p className="truncate text-xs text-muted-foreground">{accountEmail}</p>
            <Button
              variant="ghost"
              className="tap-target mt-1 h-9 w-full justify-start gap-2 px-0"
              onClick={() => {
                setOwnerCode("");
                setOwnerError(null);
                setOwnerOpen(true);
              }}
            >
              <ShieldCheck
                className={`size-4 ${ownerVerified ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className="text-sm">
                {ownerVerified ? "Verified creator" : "Owner verification"}
              </span>
            </Button>
            <Button variant="ghost" className="tap-target mt-1 h-9 px-0" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={renaming !== null} onOpenChange={(next) => !next && setRenaming(null)}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            className="h-11"
            aria-label="Chat title"
          />
          <DialogFooter>
            <Button variant="ghost" className="tap-target" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              className="tap-target"
              disabled={renameValue.trim().length === 0}
              onClick={() => {
                if (renaming) onRename(renaming.id, renameValue.trim());
                setRenaming(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” and all of its messages will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="tap-target">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="tap-target"
              onClick={() => {
                if (deleting) onDelete(deleting.id);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
