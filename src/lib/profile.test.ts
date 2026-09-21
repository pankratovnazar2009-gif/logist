import { test } from "node:test";
import assert from "node:assert/strict";
import { initials, profileCompleteness } from "./profile.ts";

const empty = { role: "logist" as const, full_name: null, email: null, avatar_url: null, company_name: null, nip: null, languages: [], truck_types: [], preferred_routes: [] };

test("пустой профиль логиста — 0%, не хватает пяти пунктов", () => {
  const result = profileCompleteness(empty);
  assert.equal(result.percent, 0);
  assert.equal(result.missing.length, 5);
});

test("полностью заполненный профиль логиста — 100%", () => {
  const result = profileCompleteness({ ...empty, full_name: "Jan Kowalski", email: "jan@firma.pl", avatar_url: "https://x/y.jpg", nip: "1234563218", languages: ["pl"] });
  assert.deepEqual(result, { percent: 100, missing: [] });
});

test("у перевозчика в расчёт входят кузов и направления", () => {
  const carrier = { ...empty, role: "carrier" as const, full_name: "Jan Kowalski" };
  const result = profileCompleteness(carrier);
  assert.equal(result.missing.length, 6);
  assert.ok(result.missing.includes("typ nadwozia") && result.missing.includes("kierunki"));
});

test("название компании без NIP тоже считается за «фирма»", () => {
  assert.equal(profileCompleteness({ ...empty, company_name: "Trans-Bud" }).missing.includes("firma"), false);
});

test("инициалы: два слова, одно слово, пусто, лишние пробелы", () => {
  assert.equal(initials("Jan Kowalski"), "JK");
  assert.equal(initials("  anna   maria  nowak "), "AN");
  assert.equal(initials("Madonna"), "M");
  assert.equal(initials(null), "?");
  assert.equal(initials("   "), "?");
});
