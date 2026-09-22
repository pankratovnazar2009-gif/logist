export type UserRole = "logist" | "carrier";

export interface AppUser {
  id: string;
  auth_user_id: string | null;
  phone: string | null;
  role: UserRole | null;
  company_name: string | null;
  nip: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  languages: string[];
  truck_types: string[];
  preferred_routes: string[];
  created_at: string;
}

/** Языки, на которых водители и логисты общаются на рынке; код — как в Accept-Language. */
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "uk", label: "Українська" },
  { value: "ru", label: "Русский" },
  { value: "cs", label: "Čeština" },
];

export type LoadStatus = "active" | "matched" | "taken" | "cancelled" | "expired";
export type OfferStatus = "active" | "taken" | "cancelled" | "expired";
export type LoadSource = "facebook" | "direct";

export interface Load {
  id: string;
  source: LoadSource;
  logist_id: string | null;
  origin: string | null;
  destination: string | null;
  origin_region: string | null;
  destination_region: string | null;
  pickup_date: string | null;
  cargo: string | null;
  weight_kg: number | null;
  pallets: number | null;
  truck_required: string | null;
  price: string | null;
  raw_text: string | null;
  contact_info: string | null;
  source_url: string | null;
  status: LoadStatus;
  created_at: string;
  expires_at: string;
}

/** «Свободен с … по …, еду отсюда (туда)» — объявление перевозчика из приложения или из FB-группы. */
export interface CarrierOffer {
  id: string;
  source: LoadSource;
  carrier_id: string | null;
  origin: string | null;
  destination: string | null;
  origin_region: string;
  destination_region: string | null;
  available_from: string;
  available_to: string;
  truck_type: string | null;
  capacity_kg: number | null;
  contact_info: string | null;
  source_url: string | null;
  status: OfferStatus;
  created_at: string;
  expires_at: string;
}

export type LoadWithCount = Load & { match_count: number };
export type OfferWithCount = CarrierOffer & { match_count: number };

export interface NewLoadPayload {
  origin: string;
  destination: string;
  origin_region: string;
  destination_region?: string;
  pickup_date: string;
  cargo?: string;
  weight_kg?: number;
  pallets?: number;
  truck_required?: string;
  price?: string;
  contact_info?: string;
}

export interface NewOfferPayload {
  origin?: string;
  destination?: string;
  origin_region: string;
  destination_region?: string;
  available_from: string;
  available_to: string;
  truck_type?: string;
  capacity_kg?: number;
  contact_info?: string;
}

export type LoadSummary = Pick<
  Load,
  "id" | "source" | "origin" | "destination" | "origin_region" | "destination_region" | "pickup_date" | "cargo" | "weight_kg" | "pallets" | "truck_required" | "price" | "status" | "expires_at"
>;

export type OfferSummary = Pick<
  CarrierOffer,
  "id" | "source" | "origin" | "destination" | "origin_region" | "destination_region" | "available_from" | "available_to" | "truck_type" | "capacity_kg" | "status" | "expires_at"
>;

/** Пара глазами конкретного пользователя. Контакт контрагента приходит с сервера только тогда, когда его можно показывать. */
export interface MatchView {
  id: string;
  state: import("./match-state").MatchState;
  score: number;
  viewer: import("./match-state").Party;
  load: LoadSummary;
  offer: OfferSummary;
  actions: import("./match-state").MatchAction[];
  /** Состоялась ли перевозка — спрашиваем через сутки после подтверждения; строит базу проверенных перевозчиков. */
  outcome: "unknown" | "completed" | "failed";
  /** Пара подтверждена и результат ещё не отмечен — самое время показать «состоялось / нет». */
  canReportOutcome: boolean;
  counterpart: {
    party: import("./match-state").Party;
    source: LoadSource;
    /** Название компании из GUS (только для участников из приложения); подпись на нужном языке собирает интерфейс. */
    company: string | null;
    contact: string | null;
    sourceUrl: string | null;
    /** Имя, фото и e-mail — только после подтверждения пары; до этого null. */
    person: { name: string | null; avatarUrl: string | null; email: string | null } | null;
    /** Проверки, которые сервер сделал сам: телефон подтверждён SMS-кодом, фирма — по NIP в GUS. Для FB-объявлений null. */
    verified: { phone: boolean; company: boolean } | null;
  };
  created_at: string;
}

/** Коды регионов Польши и стран, между которыми возят грузы. Код — то, по чему сравнивает подбор; подписи берутся из выбранного языка. */
export const REGION_CODES = [
  "PL-MZ", "PL-MA", "PL-WP", "PL-DS", "PL-LD", "PL-PM", "PL-SL", "PL-LU", "PL-PK", "PL-PD", "PL-ZP", "PL-LB", "PL-KP", "PL-WM", "PL-SK", "PL-OP",
  "DE", "FR", "NL", "CZ", "SK", "AT", "BE", "IT", "ES", "LT", "DK", "SE", "HU", "GB",
] as const;
export type RegionCode = (typeof REGION_CODES)[number];

export const TRUCK_VALUES = ["firanka", "chlodnia", "bus", "plandeka"] as const;
export type TruckValue = (typeof TRUCK_VALUES)[number];
