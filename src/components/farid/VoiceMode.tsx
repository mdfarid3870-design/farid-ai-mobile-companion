import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPauseRequest, NADIRA_PAUSE_REPLY, VoiceSession } from "./voice-session";

type Props = {
  active: boolean;
  greeting: string;
  busy: boolean;
  lastReply: { id: string; text: string } | null;
  onCommand: (text: string) => void;
  nadira?: boolean;
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
  abort: () => void;
};

/** Pick the most human, JARVIS-like (deep, male, British) voice the phone offers — free, no credits. */
function pickVoice(bangla: boolean): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (bangla ? v.lang.startsWith("bn") : v.lang.startsWith("en")) s += 100;
    if (!bangla && v.lang === "en-GB") s += 40;
    if (/natural|neural|online|premium|enhanced/.test(n)) s += 30;
    if (/male|daniel|ryan|thomas|arthur|george|guy|uk english male|oliver/.test(n) && !/female/.test(n)) s += 25;
    if (/google/.test(n)) s += 10;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function speak(text: string, onDone?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return onDone?.();
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#`>_\[\]()]/g, "").replace(/\s+/g, " ").slice(0, 600);
  const u = new SpeechSynthesisUtterance(clean);
  const bangla = /[\u0980-\u09FF]/.test(clean);
  u.lang = bangla ? "bn-BD" : "en-GB";
  const voice = pickVoice(bangla);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  }
  // Calm, deep, confident delivery like JARVIS
  u.pitch = 0.8;
  u.rate = 0.95;
  u.volume = 1;
  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  window.speechSynthesis.speak(u);
}

/** Hands-free voice; complete pause requires the microphone button to resume. */
export function VoiceMode({ active, greeting, busy, lastReply, onCommand, nadira = false }: Props) {
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const sessionRef = useRef<VoiceSession | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const spokenId = useRef<string | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (!active) {
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    setSupported(true);
    const session = new VoiceSession({
      start: () => rec.start(),
      abort: () => { try { rec.abort(); } catch { /* Not running. */ } },
      cancel: () => window.speechSynthesis?.cancel(),
      speak,
      changed: () => { setMuted(session.muted); setSpeaking(session.speaking); },
    });
    sessionRef.current = session;
    setMuted(false);
    setSpeaking(false);
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
        if (!session.acceptsInput) continue;
        if (isPauseRequest(text)) {
          session.pause(nadira ? NADIRA_PAUSE_REPLY : "ঠিক আছে, একদম চুপ হয়ে গেলাম। আমি এখানেই আছি।");
          break;
        }
        if (busyRef.current) continue;
        onCommandRef.current(text);
      }
    };
    rec.onend = () => session.ended();
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        session.pause();
        setSupported(false);
      }
    };
    spokenId.current = lastReply?.id ?? null;
    session.say(greeting);
    return () => {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      session.dispose();
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, greeting, nadira]);

  useEffect(() => {
    if (!active || busy || !lastReply) return;
    if (spokenId.current === lastReply.id) return;
    spokenId.current = lastReply.id;
    if (sessionRef.current?.muted) return;
    sessionRef.current?.say(lastReply.text);
  }, [active, busy, lastReply, muted]);

  if (!active) return null;
  return (
    <Button
      type="button"
      onClick={() => {
        const session = sessionRef.current;
        if (!session) return;
        if (session.muted) session.resume();
        else session.pause();
      }}
      className="fixed bottom-28 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg glow-ring"
      disabled={!supported}
      aria-label={muted ? "Resume voice listening" : "Pause voice listening"}
      title={muted ? "Resume voice listening" : "Pause voice listening"}
      aria-pressed={!muted && supported}
    >
      {muted || !supported ? <MicOff className="size-4" /> : <Mic className={`size-4 ${speaking ? "" : "animate-pulse"}`} />}
      {!supported ? "Voice not supported" : speaking ? "বলছি…" : muted ? "মাইক বন্ধ" : "শুনছি…"}
    </Button>
  );
}
