import { test } from "node:test";
import assert from "node:assert/strict";
import { availableActions, otherParty, parseMatchState, type MatchState } from "./match-state.ts";

test("груз из Facebook (canConnect=false): в ожидании доступно «взять» или отклонить, не «запросить»", () => {
  const pending: MatchState = { status: "pending" };
  assert.deepEqual(availableActions(pending, "carrier", false), ["take", "decline"]);
});

test("обе стороны в приложении (canConnect=true): в ожидании доступен обычный путь «запросить»", () => {
  const pending: MatchState = { status: "pending" };
  assert.deepEqual(availableActions(pending, "carrier", true), ["request", "decline"]);
});

test("та сторона, что запросила, может только отозвать; другая — подтвердить или отклонить", () => {
  const requestedByCarrier: MatchState = { status: "requested", by: "carrier" };
  assert.deepEqual(availableActions(requestedByCarrier, "carrier", true), ["decline"]);
  assert.deepEqual(availableActions(requestedByCarrier, "logist", true), ["confirm", "decline"]);
});

test("подтверждено / отклонено / закрыто — действий больше нет", () => {
  const states: MatchState[] = [{ status: "confirmed" }, { status: "declined", by: "carrier" }, { status: "closed", reason: "expired" }];
  for (const state of states) assert.deepEqual(availableActions(state, "carrier", true), [], state.status);
});

test("otherParty — простая перестановка", () => {
  assert.equal(otherParty("logist"), "carrier");
  assert.equal(otherParty("carrier"), "logist");
});

test("parseMatchState разбирает все пять состояний из строки БД", () => {
  assert.deepEqual(parseMatchState({ status: "pending" }), { status: "pending" });
  assert.deepEqual(parseMatchState({ status: "requested", requested_by: "logist" }), { status: "requested", by: "logist" });
  assert.deepEqual(parseMatchState({ status: "confirmed" }), { status: "confirmed" });
  assert.deepEqual(parseMatchState({ status: "declined", declined_by: "carrier" }), { status: "declined", by: "carrier" });
  assert.deepEqual(parseMatchState({ status: "closed", closed_reason: "load_taken" }), { status: "closed", reason: "load_taken" });
});
