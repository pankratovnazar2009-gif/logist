import { z } from "zod";
import { addDays } from "../matching-rules";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value), "invalid_date");

/** 'PL-MZ' (воеводство) или 'DE' (страна). */
export const regionCode = z.string().regex(/^[A-Z]{2}(-[A-Z]{2})?$/);
const token = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/);
const optionalText = z.string().trim().max(500).optional();

const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Груз, который добавляет логист в приложении. */
export const directLoadSchema = z.object({
  origin: z.string().trim().min(1).max(200),
  destination: z.string().trim().min(1).max(200),
  origin_region: regionCode,
  destination_region: regionCode.optional(),
  pickup_date: isoDate.refine((d) => d >= addDays(todayUtc(), -1), "date_in_past"),
  cargo: optionalText,
  weight_kg: z.number().int().positive().max(60000).optional(),
  pallets: z.number().int().positive().max(100).optional(),
  truck_required: token.optional(),
  price: z.string().trim().max(60).optional(),
  contact_info: z.string().trim().max(200).optional(),
});

/** Груз из FB-группы, присланный воркфлоу n8n. Любое поле, кроме текста, может быть неизвестно. */
export const internalLoadSchema = z.object({
  origin: z.string().nullish(),
  destination: z.string().nullish(),
  origin_region: regionCode.nullish(),
  destination_region: regionCode.nullish(),
  pickup_date: isoDate.nullish(),
  cargo: z.string().nullish(),
  weight_kg: z.number().int().positive().max(60000).nullish(),
  pallets: z.number().int().positive().max(100).nullish(),
  truck_required: token.nullish(),
  price: z.string().nullish(),
  contact_info: z.string().nullish(),
  source_url: z.string().url().nullish(),
  raw_text: z.string().min(1),
});

const offerBase = {
  origin: z.string().trim().max(200).optional(),
  destination: z.string().trim().max(200).optional(),
  origin_region: regionCode,
  destination_region: regionCode.optional(),
  available_from: isoDate,
  available_to: isoDate,
  truck_type: token.optional(),
  capacity_kg: z.number().int().positive().max(60000).optional(),
};

/** Предложение перевозчика из приложения: «свободен с … по …». */
export const directOfferSchema = z
  .object({ ...offerBase, contact_info: z.string().trim().max(200).optional() })
  .refine((o) => o.available_to >= o.available_from, { message: "window_reversed", path: ["available_to"] })
  .refine((o) => o.available_to >= addDays(todayUtc(), -1), { message: "date_in_past", path: ["available_to"] });

/** Предложение перевозчика из FB-группы (n8n). */
export const internalOfferSchema = z
  .object({
    ...offerBase,
    origin: z.string().nullish(),
    destination: z.string().nullish(),
    destination_region: regionCode.nullish(),
    truck_type: token.nullish(),
    capacity_kg: z.number().int().positive().max(60000).nullish(),
    contact_info: z.string().nullish(),
    source_url: z.string().url().nullish(),
    raw_text: z.string().min(1),
  })
  .refine((o) => o.available_to >= o.available_from, { message: "window_reversed", path: ["available_to"] });

/**
 * Правка профиля. `null` очищает поле, отсутствие поля не меняет его.
 * Название компании из GUS (по NIP) вручную не правится — его выставляет сервер.
 */
export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(2).max(80).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  company_name: z.string().trim().min(2).max(120).nullable().optional(),
  nip: z.string().regex(/^\d{10}$/).nullable().optional(),
  languages: z.array(z.enum(["pl", "en", "de", "uk", "ru", "cs"])).max(6).optional(),
  truck_types: z.array(token).max(10).optional(),
  preferred_routes: z.array(regionCode).max(40).optional(),
});

export const matchActionSchema = z.object({ action: z.enum(["request", "confirm", "decline", "take"]) });

/** Ответ на вопрос «состоялась ли перевозка» — задаём через сутки после подтверждения (см. /api/internal/collect-outcomes). */
export const outcomeSchema = z.object({ outcome: z.enum(["completed", "failed"]) });

/** Груз/предложение живёт до конца следующего за датой дня — чтобы окно ±1 день ещё работало. */
export const expiresAtFor = (isoDate: string): string => `${addDays(isoDate, 2)}T00:00:00.000Z`;
