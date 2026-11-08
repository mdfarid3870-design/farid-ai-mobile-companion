import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { nadiraGreeting, nadiraPromptBlock, ReplyInput } from "./nadira-personalization";

const ids = { conversationId: "00000000-0000-4000-8000-000000000001", messageId: "00000000-0000-4000-8000-000000000002" };

describe("Nadira personalization", () => {
  test("explicit Nadira flag survives reply validation; ordinary users default off", () => {
    assert.equal(ReplyInput.parse({ ...ids, nadiraMode: true }).nadiraMode, true);
    assert.equal(ReplyInput.parse(ids).nadiraMode, false);
    assert.throws(() => ReplyInput.parse({ ...ids, nadiraMode: "true" }));
    assert.equal(nadiraPromptBlock(false, 0), "");
  });
  test("greetings vary on successive activations and cycle predictably", () => {
    assert.equal(new Set([0, 1, 2].map(nadiraGreeting)).size, 3);
    assert.equal(nadiraGreeting(3), nadiraGreeting(0));
  });
  test("reply address rotates across the three requested addresses", () => {
    for (const [turn, address] of ["নাদিরা ভাবী", "ভাবী", "নাদিরা"].entries()) {
      assert.ok(nadiraPromptBlock(true, turn).includes(`prefer “${address}”`));
    }
  });
});