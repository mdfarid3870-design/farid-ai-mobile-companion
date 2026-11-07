import { describe, expect, test } from "bun:test";
import { isPauseRequest, NADIRA_PAUSE_REPLY, VoiceSession } from "./voice-session";

function setup() {
  let starts = 0;
  let aborts = 0;
  let done = () => {};
  const spoken: string[] = [];
  const session = new VoiceSession({
    start: () => { starts++; }, abort: () => { aborts++; }, cancel: () => {}, changed: () => {},
    speak: (text, callback) => { spoken.push(text); done = callback; },
  });
  return { session, spoken, starts: () => starts, aborts: () => aborts, finish: () => done() };
}

describe("Nadira microphone pause", () => {
  test("recognizes quiet, chup, chup thako and stop without matching unrelated words", () => {
    for (const phrase of ["quiet", "chup", "chup thako", "chup hoye jao", "stop", "stop talking", "be quiet", "চুপ থাকো"]) expect(isPauseRequest(phrase)).toBe(true);
    expect(isPauseRequest("please explain stopwatch timing")).toBe(false);
  });
  test("acknowledges pause with listening stopped and never restarts after acknowledgment", () => {
    const h = setup(); h.session.listen();
    h.session.pause(NADIRA_PAUSE_REPLY);
    expect(h.spoken).toEqual([NADIRA_PAUSE_REPLY]);
    expect(h.session.acceptsInput).toBe(false);
    expect(h.aborts()).toBe(1);
    h.session.ended(); h.finish(); h.session.ended();
    expect(h.starts()).toBe(1);
    expect(h.session.muted).toBe(true);
    h.session.resume();
    expect(h.starts()).toBe(2);
    expect(h.session.acceptsInput).toBe(true);
  });
  test("blocks microphone echoes during speech then resumes after completion", () => {
    const h = setup(); h.session.listen(); h.session.say("Hello");
    h.session.ended();
    expect(h.session.acceptsInput).toBe(false);
    expect(h.starts()).toBe(1);
    h.finish(); expect(h.starts()).toBe(2);
  });
  test("late speech callbacks cannot restart a manually muted or disposed session", () => {
    const h = setup(); h.session.listen(); h.session.say("Hello");
    h.session.pause(); h.session.ended(); h.finish();
    expect(h.starts()).toBe(1);
    h.session.dispose(); h.session.resume(); h.session.ended();
    expect(h.starts()).toBe(1);
  });
});