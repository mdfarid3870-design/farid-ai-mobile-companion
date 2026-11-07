import { describe, test } from "node:test";
import assert from "node:assert/strict";
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
    for (const phrase of ["quiet", "chup", "chup thako", "chup hoye jao", "stop", "stop talking", "be quiet", "চুপ থাকো"]) assert.equal(isPauseRequest(phrase), true);
    assert.equal(isPauseRequest("please explain stopwatch timing"), false);
  });
  test("acknowledges pause with listening stopped and never restarts after acknowledgment", () => {
    const h = setup(); h.session.listen();
    h.session.pause(NADIRA_PAUSE_REPLY);
    assert.deepEqual(h.spoken, [NADIRA_PAUSE_REPLY]);
    assert.equal(h.session.acceptsInput, false);
    assert.equal(h.aborts(), 1);
    h.session.ended(); h.finish(); h.session.ended();
    assert.equal(h.starts(), 1);
    assert.equal(h.session.muted, true);
    h.session.resume();
    assert.equal(h.starts(), 2);
    assert.equal(h.session.acceptsInput, true);
  });
  test("only pause commands are accepted during speech, and pause cuts speech off", () => {
    const h = setup(); h.session.listen(); h.session.say("Hello");
    assert.equal(h.session.acceptsInput, false);
    assert.equal(h.session.acceptsPause, true);
    h.session.pause();
    assert.equal(h.session.speaking, false);
    h.finish(); h.session.ended();
    assert.equal(h.starts(), 1);
  });
  test("recognizes silent/off commands in Bangla", () => {
    for (const p of ["সাইলেন্ট", "silent", "off", "অফ", "চুপ"]) assert.equal(isPauseRequest(p), true);
  });
  test("late speech callbacks cannot restart a manually muted or disposed session", () => {
    const h = setup(); h.session.listen(); h.session.say("Hello");
    h.session.pause(); h.session.ended(); h.finish();
    assert.equal(h.starts(), 1);
    h.session.dispose(); h.session.resume(); h.session.ended();
    assert.equal(h.starts(), 1);
  });
});