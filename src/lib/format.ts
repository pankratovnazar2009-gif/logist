import type { Messages } from "./i18n/messages";
import type { MatchView } from "./types";

const isRegion = (code: string, m: Messages): code is keyof Messages["regions"] => code in m.regions;
const isTruck = (value: string, m: Messages): value is keyof Messages["trucks"] => value in m.trucks;

/** Название региона на выбранном языке; неизвестный код показываем как есть. */
export const regionLabel = (code: string | null, m: Messages): string => (code && isRegion(code, m) ? m.regions[code] : (code ?? "?"));
export const truckLabel = (value: string | null, m: Messages): string => (value && isTruck(value, m) ? m.trucks[value] : (value ?? ""));

/** '2026-10-10' → '10.10.2026' (без сдвига часового пояса: это календарная дата, а не момент времени). */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

export const formatDateRange = (from: string, to: string): string => (from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`);

interface Place {
  origin: string | null;
  destination: string | null;
  origin_region: string | null;
  destination_region: string | null;
}

/** «Warszawa → Berlin», а если города не указаны — по регионам; неизвестное направление — «любое направление». */
export function routeText(place: Place, m: Messages): string {
  const from = place.origin || regionLabel(place.origin_region, m);
  const to = place.destination || (place.destination_region ? regionLabel(place.destination_region, m) : m.common.anyDirection);
  return `${from} → ${to}`;
}

/** Ссылка для контакта: телефон, e-mail или адрес (пост/профиль в Facebook). */
export function contactHref(contact: string): string | null {
  const phoneLike = contact.replace(/[\s()-]/g, "");
  if (/^\+?\d{7,15}$/.test(phoneLike)) return `tel:${phoneLike}`;
  if (contact.includes("@") && !contact.includes(" ")) return `mailto:${contact}`;
  if (/^https?:\/\//i.test(contact)) return contact;
  return null;
}

/** Подпись второй стороны пары: объявление из Facebook — по роли; участник из приложения — название компании или роль. */
export function counterpartLabel(counterpart: Pick<MatchView["counterpart"], "party" | "source" | "company">, m: Messages): string {
  if (counterpart.source === "facebook") return counterpart.party === "carrier" ? m.match.fbCarrier : m.match.fbShipper;
  return counterpart.company ?? (counterpart.party === "carrier" ? m.roles.carrier : m.roles.logist);
}
