export const NADIRA_PAUSE_REPLY = "ঠিক আছে নাদিরা, একদম চুপ হয়ে গেলাম। আমি এখানেই আছি।";
export const GENERAL_PAUSE_REPLY = "ঠিক আছে, একদম চুপ হয়ে গেলাম। আমি এখানেই আছি।";

/** Short pause commands only, so longer questions mentioning "stop" still reach the AI. */
export function isPauseRequest(text: string) {
  const t = text.trim();
  if (!t || t.split(/\s+/).length > 6) return false;
  return /(?:\b(?:chup|quiet|silent|silence|stop|thamo|off)\b|চুপ|থামো|সাইলেন্ট|অফ|বন্ধ করো|কথা বন্ধ)/i.test(t);
}

/**
 * Owns listening independently of React renders and ignores stale speech callbacks.
 * While speaking, the mic keeps running but only pause commands are accepted (barge-in).
 */
export class VoiceSession {
  muted = false;
  speaking = false;
  private disposed = false;
  private running = false;
  private generation = 0;

  constructor(private audio: {
    start: () => void;
    abort: () => void;
    cancel: () => void;
    speak: (text: string, done: () => void) => void;
    changed: () => void;
  }) {}

  get acceptsInput() { return !this.disposed && !this.muted && !this.speaking; }
  get acceptsPause() { return !this.disposed && !this.muted; }

  listen() {
    if (!this.acceptsPause || this.running) return;
    try { this.audio.start(); this.running = true; } catch { /* Already running. */ }
  }

  ended() {
    this.running = false;
    this.listen();
  }

  say(text: string) {
    if (this.disposed) return;
    const generation = ++this.generation;
    this.speaking = true;
    this.audio.cancel();
    this.audio.changed();
    this.audio.speak(text, () => {
      if (this.disposed || generation !== this.generation) return;
      this.speaking = false;
      this.audio.changed();
      this.listen();
    });
  }

  pause(acknowledgment?: string) {
    this.muted = true;
    this.audio.abort();
    this.running = false;
    if (acknowledgment) this.say(acknowledgment);
    else {
      ++this.generation;
      this.speaking = false;
      this.audio.cancel();
      this.audio.changed();
    }
  }

  resume() {
    ++this.generation;
    this.muted = false;
    this.speaking = false;
    this.audio.cancel();
    this.audio.changed();
    this.listen();
  }

  dispose() {
    this.disposed = true;
    ++this.generation;
    this.audio.abort();
    this.audio.cancel();
  }
}
