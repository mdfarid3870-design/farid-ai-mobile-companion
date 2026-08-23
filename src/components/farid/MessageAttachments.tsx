import type { ChatAttachment } from "@/lib/ai-chat.server.types";
import { signAttachment } from "@/lib/chat-store";
import { useQuery } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Video } from "lucide-react";
import { toast } from "sonner";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentCard({ attachment }: { attachment: ChatAttachment }) {
  const isImage = attachment.mimeType.startsWith("image/");
  const signed = useQuery({
    queryKey: ["attachment", attachment.path],
    queryFn: () => signAttachment(attachment.path),
    staleTime: 50 * 60 * 1000,
  });

  async function open() {
    try {
      const url = signed.data ?? (await signAttachment(attachment.path));
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("This file could not be opened.");
    }
  }

  if (isImage) {
    return (
      <button
        type="button"
        onClick={open}
        className="overflow-hidden rounded-xl border border-border bg-muted"
        aria-label={`Open ${attachment.name}`}
      >
        {signed.data ? (
          <img
            src={signed.data}
            alt={attachment.name}
            loading="lazy"
            className="max-h-56 w-full object-cover"
          />
        ) : (
          <div className="flex h-32 w-40 items-center justify-center text-muted-foreground">
            <ImageIcon className="size-6" />
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="tap-target flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-left"
      aria-label={`Open ${attachment.name}`}
    >
      <FileText className="size-4 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block truncate text-sm">{attachment.name}</span>
        <span className="block text-xs text-muted-foreground">{formatSize(attachment.size)}</span>
      </span>
    </button>
  );
}

export function MessageAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="mb-2 flex flex-col gap-2">
      {attachments.map((attachment) => (
        <AttachmentCard key={attachment.path} attachment={attachment} />
      ))}
    </div>
  );
}
