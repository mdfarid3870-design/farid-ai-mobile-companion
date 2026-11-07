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
  test("blocks microphone echoes during speech then resumes after completion", () => {
    const h = setup(); h.session.listen(); h.session.say("Hello");
    h.session.ended();
    assert.equal(h.session.acceptsInput, false);
    assert.equal(h.starts(), 1);
    h.finish(); assert.equal(h.starts(), 2);
  });
  test("late speech callbacks cannot restart a manually muted or disposed session", () => {
    const h = setup(); h.session.listen(); h.session.say("Hello");
    h.session.pause(); h.session.ended(); h.finish();
    assert.equal(h.starts(), 1);
    h.session.dispose(); h.session.resume(); h.session.ended();
    assert.equal(h.starts(), 1);
  });
});