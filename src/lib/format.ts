import { ROUTE_OPTIONS, TRUCK_TYPES } from "./types";

export const regionLabel = (code: string | null): string => ROUTE_OPTIONS.find((r) => r.value === code)?.label ?? code ?? "?";
export const truckLabel = (value: string | null): string => TRUCK_TYPES.find((t) => t.value === value)?.label ?? value ?? "";

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

/** «Warszawa → Berlin», а если города не указаны — по регионам; неизвестное направление — «dowolny kierunek». */
export function routeText(place: Place): string {
  const from = place.origin || regionLabel(place.origin_region);
  const to = place.destination || (place.destination_region ? regionLabel(place.destination_region) : "dowolny kierunek");
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
