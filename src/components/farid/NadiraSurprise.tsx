import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";

const HEARTS = ["❤️", "💖", "💕", "🌹", "✨"];

export function HeartBurst({ trigger }: { trigger: number }) {
  const [items, setItems] = useState<{ id: number; left: number; delay: number; e: string; size: number }[]>([]);
  useEffect(() => {
    if (!trigger) return;
    const next = Array.from({ length: 24 }, (_, i) => ({
      id: trigger * 100 + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      e: HEARTS[i % HEARTS.length],
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
