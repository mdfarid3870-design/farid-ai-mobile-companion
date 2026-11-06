import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type Props = {
  active: boolean;
  greeting: string;
  busy: boolean;
  lastReply: { id: string; text: string } | null;
  onCommand: (text: string) => void;
};

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

const SILENT = /(chup|চুপ|stop talking|be quiet|silent|thamo|থামো)/i;
const WAKE = /(kotha bolo|কথা বলো|কথা বল|speak|talk to me|shuru|শুরু)/i;

function speak(text: string, onDone?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return onDone?.();
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#`>_\[\]()]/g, "").slice(0, 600);
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = /[\u0980-\u09FF]/.test(clean) ? "bn-BD" : "en-US";
  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  window.speechSynthesis.speak(u);
}

/** Hands-free voice: greets, listens continuously, obeys "chup thako" / "kotha bolo". */
export function VoiceMode({ active, greeting, busy, lastReply, onCommand }: Props) {
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<Rec | null>(null);
  const state = useRef({ muted: false, speaking: false, active: false });
  const spokenId = useRef<string | null>(null);
  const greeted = useRef(false);
  state.current = { muted, speaking, active };

  useEffect(() => {
    if (!active) {
      recRef.current?.stop();
      window.speechSynthesis?.cancel();
      greeted.current = false;
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "bn-BD";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i] as (ArrayLike<{ transcript: string }> & { isFinal: boolean }) | undefined;
        if (!r) continue;
        if (!r.isFinal) continue;
        const text = r[0]?.transcript.trim() ?? "";
        if (!text) continue;
        if (SILENT.test(text)) {
          window.speechSynthesis?.cancel();
          setSpeaking(false);
          setMuted(true);
          continue;
        }
        if (WAKE.test(text) && state.current.muted) {
          setMuted(false);
          speak("জি, বলুন। আমি শুনছি।");
          continue;
        }
        if (state.current.muted || state.current.speaking) continue;
        onCommandRef.current(text);
      }
    };
    rec.onend = () => {
      if (state.current.active) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setSupported(false);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* ignore */
    }
    if (!greeted.current) {
      greeted.current = true;
      spokenId.current = lastReply?.id ?? null;
      setSpeaking(true);
      speak(greeting, () => setSpeaking(false));
    }
    return () => {
      rec.onend = null;
      rec.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (!active || busy || !lastReply || muted) return;
    if (spokenId.current === lastReply.id) return;
    spokenId.current = lastReply.id;
    setSpeaking(true);
    speak(lastReply.text, () => setSpeaking(false));
  }, [active, busy, lastReply, muted]);

  if (!active) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (!muted) window.speechSynthesis?.cancel();
        setMuted((m) => !m);
      }}
      className="fixed bottom-28 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg glow-ring"
      aria-label={muted ? "Voice off" : "Voice on"}
    >
      {muted || !supported ? <MicOff className="size-4" /> : <Mic className={`size-4 ${speaking ? "" : "animate-pulse"}`} />}
      {!supported ? "Voice not supported" : muted ? "চুপ আছি — \"কথা বলো\"" : speaking ? "বলছি…" : "শুনছি…"}
    </button>
  );
}
