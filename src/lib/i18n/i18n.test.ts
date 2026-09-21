import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLocale, isLocale } from "./locales.ts";
import { en } from "./messages/en.ts";
import { pl } from "./messages/pl.ts";
import { ru } from "./messages/ru.ts";
import { uk } from "./messages/uk.ts";

test("язык браузера: берём первый поддерживаемый, регион отбрасываем", () => {
  assert.equal(detectLocale(["ru-RU", "en-US"]), "ru");
  assert.equal(detectLocale(["de-DE", "uk-UA", "pl"]), "uk");
  assert.equal(detectLocale(["EN-gb"]), "en");
});

test("неизвестные языки и пустой список — польский по умолчанию", () => {
  assert.equal(detectLocale(["de-DE", "fr"]), "pl");
  assert.equal(detectLocale([]), "pl");
});

test("isLocale отсекает мусор из localStorage", () => {
  assert.equal(isLocale("ru"), true);
  assert.equal(isLocale("de"), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(undefined), false);
});

test("русское склонение: 1 совпадение, 2–4 совпадения, 5+ и 11–14 совпадений", () => {
  const word = (n: number) => ru.status.matches(n).replace(`${n} `, "");
  assert.equal(word(1), "совпадение");
  assert.equal(word(21), "совпадение");
  assert.equal(word(2), "совпадения");
  assert.equal(word(24), "совпадения");
  assert.equal(word(5), "совпадений");
  assert.equal(word(11), "совпадений");
  assert.equal(word(14), "совпадений");
  assert.equal(word(111), "совпадений");
});

test("украинское склонение: 1 збіг, 2–4 збіги, 5+ і 11–14 збігів", () => {
  const word = (n: number) => uk.status.matches(n).replace(`${n} `, "");
  assert.equal(word(1), "збіг");
  assert.equal(word(3), "збіги");
  assert.equal(word(12), "збігів");
  assert.equal(word(25), "збігів");
});

test("английское и польское число совпадений", () => {
  assert.equal(en.status.matches(1), "1 match");
  assert.equal(en.status.matches(3), "3 matches");
  assert.equal(pl.status.matches(3), "3 dopasow.");
});

test("во всех языках одинаковый набор ключей (тип это гарантирует, здесь — страховка от any)", () => {
  const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v).map((s) => `${k}.${s}`) : [k]));
  const reference = keys(pl).sort();
  for (const [name, messages] of Object.entries({ en, ru, uk })) {
    assert.deepEqual(keys(messages).sort(), reference, name);
  }
});
