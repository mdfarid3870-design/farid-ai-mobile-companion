import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart, Mail, Sparkles } from "lucide-react";

const HEARTS = ["❤️", "💖", "💕", "🌹", "✨"];

export function HeartBurst({ trigger }: { trigger: number }) {
  const [items, setItems] = useState<{ id: number; left: number; delay: number; e: string; size: number }[]>([]);
  useEffect(() => {
    if (!trigger) return;
    const next = Array.from({ length: 24 }, (_, i) => ({
      id: trigger * 100 + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      e: HEARTS[i % HEARTS.length] ?? "❤️",
      size: 16 + Math.random() * 20,
    }));
    setItems(next);
    const t = setTimeout(() => setItems([]), 3500);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      {items.map((h) => (
        <span
          key={h.id}
          className="heart-float absolute bottom-0"
          style={{ left: `${h.left}%`, animationDelay: `${h.delay}s`, fontSize: h.size }}
        >
          {h.e}
        </span>
      ))}
    </div>
  );
}

export function LoveNoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (open) setBurst(Date.now());
  }, [open]);
  return (
    <>
      <HeartBurst trigger={burst} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="love-card max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-love font-display text-2xl">Nadira, eta tomar jonno 💌</DialogTitle>
            <DialogDescription className="sr-only">A personal note from Farid</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-card-foreground">
            <p>প্রিয় নাদিরা,</p>
            <p>
              এই অ্যাপটার প্রতিটা বোতাম, প্রতিটা রঙ আমি অনেক যত্ন নিয়ে বানিয়েছি — কারণ আমি চেয়েছি তুমি যখন এটা
              খুলবে, তখন যেন একটু হাসো।
            </p>
            <p>
              FARID AI তোমার সঙ্গী — পড়াশোনা, কাজ, মন খারাপ, যা-ই হোক, ওকে বলো। আর মনে রেখো, ওর পেছনে সবসময় আমি আছি।
            </p>
            <p className="text-love text-right font-display font-semibold">— তোমার ফরিদ ❤️</p>
          </div>
          <button
            type="button"
            onClick={() => setBurst(Date.now())}
            className="tap-target mx-auto mt-2 rounded-full bg-love px-5 py-2 text-sm font-medium text-primary-foreground transition active:scale-95"
          >
            Send more love 💖
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NadiraWelcome({
  open,
  onClose,
  onOpenNote,
}: {
  open: boolean;
  onClose: () => void;
  onOpenNote: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="love-card max-w-[92vw] text-center sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-love text-center font-display text-3xl font-extrabold">
            Welcome, Nadira Afrin 🌹
          </DialogTitle>
          <DialogDescription className="text-center font-semibold text-card-foreground">
            এই পুরো জগতটা ফরিদ শুধু তোমার জন্য সাজিয়েছে ✨
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium leading-relaxed text-muted-foreground">
          তুমি এখানে সবসময় স্পেশাল। যা মনে আসে FARID AI কে বলো — সে তোমার যত্ন নেবে, ঠিক ফরিদের মতো 💖
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <Button
            type="button"
            onClick={onOpenNote}
            className="tap-target rounded-full bg-love px-5 py-2 text-sm font-bold text-primary-foreground transition active:scale-95"
          >
            💌 Open your love note
          </Button>
          <Button variant="ghost" type="button" onClick={onClose} className="tap-target text-sm font-semibold text-muted-foreground">
            Start chatting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NadiraWelcomeCard({ onOpenNote }: { onOpenNote: () => void }) {
  return (
    <section aria-label="Welcome for Nadira Afrin" className="nadira-welcome relative mx-auto w-full max-w-md overflow-hidden rounded-lg border p-6 text-center motion-safe:animate-rise sm:p-8">
      <div aria-hidden="true" className="flex items-center justify-center gap-4 text-love">
        <Sparkles className="size-4" /><span className="text-4xl">🌹</span><Heart className="size-4" />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase text-muted-foreground">With love, from Farid</p>
      <h2 className="text-love mt-2 font-display text-3xl font-bold leading-tight">Welcome,<br />Nadira Afrin</h2>
      <div aria-hidden="true" className="my-5 flex items-center justify-center gap-3">
        <span className="h-px w-12 bg-border" /><Heart className="size-4 text-love" /><span className="h-px w-12 bg-border" />
      </div>
      <p className="text-sm leading-7 text-card-foreground">তোমার হাসি, তোমার গল্প, তোমার ছোট ছোট স্বপ্ন—<br />সবকিছুর জন্য এখানে একটু ভালোবাসা রাখা আছে।</p>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">কেমন আছো, নাদিরা? আমি এখানেই আছি, তোমার পাশে।</p>
      <Button onClick={onOpenNote} className="bg-love mt-6 h-auto min-h-11 max-w-full whitespace-normal px-5 py-3 text-primary-foreground">
        <Mail className="size-4 shrink-0" /> A note for you
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">শুধু তোমার জন্য · ফরিদ ❤️</p>
    </section>
  );
}
