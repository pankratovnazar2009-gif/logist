/**
 * Приводит текст к латинице без диакритики. Польские буквы (ł, ó, ż…) не входят в базовую SMS-кодировку:
 * одна такая буква переводит сообщение в UCS-2 — 70 знаков на часть вместо 160, то есть дороже и на несколько SMS.
 */
export function toSmsSafe(text: string): string {
  return text
    .replace(/[łŁ]/g, (ch) => (ch === "ł" ? "l" : "L"))
    .replace(/→/g, "-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\n\x20-\x7e]/g, "");
}
