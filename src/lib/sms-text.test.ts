import { test } from "node:test";
import assert from "node:assert/strict";
import { toSmsSafe } from "./sms-text.ts";

test("польские буквы превращаются в латиницу", () => {
  assert.equal(toSmsSafe("Twój kod: zażółć gęślą jaźń ŁÓDŹ"), "Twoj kod: zazolc gesla jazn LODZ");
});

test("стрелка маршрута и эмодзи не ломают кодировку", () => {
  assert.equal(toSmsSafe("Poznań → Łódź 🚚"), "Poznan - Lodz ");
});

test("переносы строк и формат WebOTP сохраняются", () => {
  assert.equal(toSmsSafe("kod 123456\n\n@logist-lwe9.vercel.app #123456"), "kod 123456\n\n@logist-lwe9.vercel.app #123456");
});

test("после очистки сообщение помещается в одну SMS-часть (160 знаков)", () => {
  const otp = toSmsSafe("Pozna.logist: Twój kod logowania 123456. Ważny 5 minut. Nie podawaj go nikomu.\n\n@logist-lwe9.vercel.app #123456");
  assert.ok(otp.length <= 160, `length ${otp.length}`);
});
