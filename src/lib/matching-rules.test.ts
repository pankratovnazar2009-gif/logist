import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, evaluateMatch, type LoadFacts, type OfferFacts } from "./matching-rules.ts";

const load = (over: Partial<LoadFacts> = {}): LoadFacts => ({
  originRegion: "PL-MZ",
  destinationRegion: "DE",
  pickupDate: "2026-10-10",
  truckRequired: null,
  weightKg: null,
  pallets: null,
  ...over,
});

const offer = (over: Partial<OfferFacts> = {}): OfferFacts => ({
  originRegion: "PL-MZ",
  destinationRegion: "DE",
  availableFrom: "2026-10-10",
  availableTo: "2026-10-11",
  truckType: "firanka",
  capacityKg: null,
  ...over,
});

test("совпадение: тот же регион, направление и дата", () => {
  assert.equal(evaluateMatch(load(), offer()).ok, true);
});

test("другой регион загрузки — не подходит", () => {
  assert.deepEqual(evaluateMatch(load({ originRegion: "PL-MA" }), offer()), { ok: false, reason: "origin_region" });
});

test("неизвестный регион загрузки — не подходит (сравнивать нечего)", () => {
  assert.deepEqual(evaluateMatch(load({ originRegion: null }), offer()), { ok: false, reason: "origin_region" });
});

test("перевозчик 10–11 октября: подходят погрузки с 9 по 12 октября, 8 и 13 — нет", () => {
  for (const day of ["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"]) {
    assert.equal(evaluateMatch(load({ pickupDate: day }), offer()).ok, true, day);
  }
  for (const day of ["2026-10-08", "2026-10-13"]) {
    assert.deepEqual(evaluateMatch(load({ pickupDate: day }), offer()), { ok: false, reason: "dates" }, day);
  }
});

test("граница окна проходит через смену месяца", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(evaluateMatch(load({ pickupDate: "2026-11-01" }), offer({ availableFrom: "2026-10-30", availableTo: "2026-10-31" })).ok, true);
});

test("груз без даты подходит, но с меньшим баллом", () => {
  const dated = evaluateMatch(load(), offer());
  const flexible = evaluateMatch(load({ pickupDate: null }), offer());
  assert.equal(flexible.ok, true);
  if (dated.ok && flexible.ok) assert.ok(flexible.score < dated.score);
});

test("направление: разное — не подходит, у перевозчика «куда угодно» — подходит", () => {
  assert.deepEqual(evaluateMatch(load({ destinationRegion: "FR" }), offer()), { ok: false, reason: "destination_region" });
  assert.equal(evaluateMatch(load({ destinationRegion: "FR" }), offer({ destinationRegion: null })).ok, true);
});

test("бус не берёт 22 тонны, а фиранка — берёт", () => {
  const heavy = load({ weightKg: 22000 });
  assert.deepEqual(evaluateMatch(heavy, offer({ truckType: "bus" })), { ok: false, reason: "capacity" });
  assert.equal(evaluateMatch(heavy, offer({ truckType: "firanka" })).ok, true);
});

test("указанная перевозчиком грузоподъёмность важнее типовой", () => {
  assert.deepEqual(evaluateMatch(load({ weightKg: 12000 }), offer({ capacityKg: 10000 })), { ok: false, reason: "capacity" });
  assert.equal(evaluateMatch(load({ weightKg: 12000 }), offer({ truckType: "bus", capacityKg: 14000 })).ok, true);
});

test("40 паллет не влезут ни в один типовой кузов, 8 влезут в бус", () => {
  assert.deepEqual(evaluateMatch(load({ pallets: 40 }), offer()), { ok: false, reason: "capacity" });
  assert.equal(evaluateMatch(load({ pallets: 8 }), offer({ truckType: "bus" })).ok, true);
  assert.deepEqual(evaluateMatch(load({ pallets: 9 }), offer({ truckType: "bus" })), { ok: false, reason: "capacity" });
});

test("кузов: холодильник не подходит под фиранку, а plandeka ≈ firanka", () => {
  assert.deepEqual(evaluateMatch(load({ truckRequired: "chlodnia" }), offer({ truckType: "firanka" })), { ok: false, reason: "truck_body" });
  assert.equal(evaluateMatch(load({ truckRequired: "plandeka" }), offer({ truckType: "firanka" })).ok, true);
});

test("неизвестные вес, кузов и вместимость не исключают пару", () => {
  assert.equal(evaluateMatch(load(), offer({ truckType: null, capacityKg: null })).ok, true);
});
