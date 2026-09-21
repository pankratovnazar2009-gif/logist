// Правила подбора «груз ↔ предложение перевозчика». Чистые функции: без БД и без побочных эффектов,
// чтобы их можно было проверить тестами и использовать и на сервере, и в браузере.

export const DATE_TOLERANCE_DAYS = 1;

export interface LoadFacts {
  originRegion: string | null;
  destinationRegion: string | null;
  /** YYYY-MM-DD; null — дата гибкая. */
  pickupDate: string | null;
  truckRequired: string | null;
  weightKg: number | null;
  pallets: number | null;
}

export interface OfferFacts {
  originRegion: string;
  /** null — «куда угодно». */
  destinationRegion: string | null;
  availableFrom: string;
  availableTo: string;
  truckType: string | null;
  capacityKg: number | null;
}

export type MismatchReason = "origin_region" | "destination_region" | "dates" | "truck_body" | "capacity";

export type MatchVerdict = { ok: true; score: number } | { ok: false; reason: MismatchReason };

/** Ориентировочная вместимость по типу кузова — нужна, когда перевозчик не указал свою. */
const TYPICAL_CAPACITY: Record<string, { kg: number; pallets: number }> = {
  bus: { kg: 1500, pallets: 8 },
  chlodnia: { kg: 22000, pallets: 33 },
  firanka: { kg: 24000, pallets: 33 },
  plandeka: { kg: 24000, pallets: 33 },
};

/** Кузова, которые для груза взаимозаменяемы (борт с тентом). */
const INTERCHANGEABLE_BODIES = [["firanka", "plandeka"]];

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function bodiesCompatible(required: string, offered: string): boolean {
  if (required === offered) return true;
  return INTERCHANGEABLE_BODIES.some((group) => group.includes(required) && group.includes(offered));
}

/** Окно, в которое должна попасть погрузка: даты перевозчика ± допуск. */
export function pickupWindow(offer: Pick<OfferFacts, "availableFrom" | "availableTo">): { from: string; to: string } {
  return { from: addDays(offer.availableFrom, -DATE_TOLERANCE_DAYS), to: addDays(offer.availableTo, DATE_TOLERANCE_DAYS) };
}

function fitsCapacity(load: LoadFacts, offer: OfferFacts): boolean {
  const typical = offer.truckType ? TYPICAL_CAPACITY[offer.truckType] : undefined;
  const capacityKg = offer.capacityKg ?? typical?.kg ?? null;
  if (load.weightKg !== null && capacityKg !== null && load.weightKg > capacityKg) return false;
  // Паллеты сравниваем только по типовой вместимости кузова: точных данных у перевозчика обычно нет.
  if (load.pallets !== null && typical && load.pallets > typical.pallets) return false;
  return true;
}

/**
 * Подходит ли предложение перевозчика к грузу. Жёсткие условия: регион загрузки, направление (если известно
 * с обеих сторон), дата погрузки в окне ±1 день, кузов и вместимость. Неизвестное значение не исключает пару —
 * иначе в подбор не попадали бы объявления, где логист что-то не указал.
 */
export function evaluateMatch(load: LoadFacts, offer: OfferFacts): MatchVerdict {
  if (!load.originRegion || load.originRegion !== offer.originRegion) return { ok: false, reason: "origin_region" };

  if (load.destinationRegion && offer.destinationRegion && load.destinationRegion !== offer.destinationRegion) {
    return { ok: false, reason: "destination_region" };
  }

  let exactDate = false;
  if (load.pickupDate) {
    const window = pickupWindow(offer);
    if (load.pickupDate < window.from || load.pickupDate > window.to) return { ok: false, reason: "dates" };
    exactDate = load.pickupDate >= offer.availableFrom && load.pickupDate <= offer.availableTo;
  }

  if (load.truckRequired && offer.truckType && !bodiesCompatible(load.truckRequired, offer.truckType)) {
    return { ok: false, reason: "truck_body" };
  }
  if (!fitsCapacity(load, offer)) return { ok: false, reason: "capacity" };

  let score = 100;
  if (exactDate) score += 25;
  if (load.destinationRegion && offer.destinationRegion) score += 30;
  if (load.truckRequired && offer.truckType) score += 10;
  if (load.pickupDate) score += 5;
  return { ok: true, score };
}
