import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SIGNING_STATE_TRANSITIONS,
  assertCanTransitionTo,
  canTransitionTo,
} from "@/features/signing/domain/state-machine";
import { SigningStateError } from "@/features/signing/domain/signing-errors";

describe("signing state machine", () => {
  it("allows documented happy-path transitions", () => {
    assert.equal(canTransitionTo("DRAFT", "PREPARING"), true);
    assert.equal(canTransitionTo("PREPARING", "READY"), true);
    assert.equal(canTransitionTo("READY", "SENT"), true);
    assert.equal(canTransitionTo("SENT", "VIEWED"), true);
    assert.equal(canTransitionTo("VIEWED", "SIGNING"), true);
    assert.equal(canTransitionTo("SIGNING", "PARTIALLY_SIGNED"), true);
    assert.equal(canTransitionTo("PARTIALLY_SIGNED", "COMPLETED"), true);
    assert.equal(canTransitionTo("SIGNING", "COMPLETED"), true);
  });

  it("allows provider-forced terminal transitions", () => {
    for (const state of ["READY", "SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED"]) {
      assert.equal(canTransitionTo(state as never, "CANCELLED"), true);
      assert.equal(canTransitionTo(state as never, "EXPIRED"), true);
    }
  });

  it("allows DECLINED from any non-terminal state (provider-forced)", () => {
    assert.equal(canTransitionTo("READY", "DECLINED"), true);
    assert.equal(canTransitionTo("SIGNING", "DECLINED"), true);
    assert.equal(canTransitionTo("PREPARING", "DECLINED"), true);
  });

  it("rejects terminal-to-terminal and backwards transitions", () => {
    assert.equal(canTransitionTo("COMPLETED", "SIGNING"), false);
    assert.equal(canTransitionTo("CANCELLED", "READY"), false);
    assert.equal(canTransitionTo("DECLINED", "PARTIALLY_SIGNED"), false);
    assert.equal(canTransitionTo("EXPIRED", "COMPLETED"), false);
  });

  it("rejects impossible jumps", () => {
    assert.equal(canTransitionTo("DRAFT", "READY"), false);
    assert.equal(canTransitionTo("READY", "COMPLETED"), false);
    assert.equal(canTransitionTo("SENT", "COMPLETED"), false);
  });

  it("assertCanTransitionTo throws SigningStateError on invalid moves", () => {
    assert.throws(
      () => assertCanTransitionTo("READY", "COMPLETED"),
      SigningStateError,
    );
  });

  it("assertCanTransitionTo is a no-op on valid moves", () => {
    assert.doesNotThrow(() => assertCanTransitionTo("SIGNING", "PARTIALLY_SIGNED"));
  });

  it("terminal states have no outgoing transitions", () => {
    for (const state of ["COMPLETED", "DECLINED", "EXPIRED", "CANCELLED", "FAILED"] as const) {
      assert.equal(SIGNING_STATE_TRANSITIONS[state].length, 0);
    }
  });
});
