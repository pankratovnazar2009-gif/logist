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
  counterpart: {
    party: import("./match-state").Party;
    source: LoadSource;
    label: string;
    contact: string | null;
    sourceUrl: string | null;
    /** Имя, фото и e-mail — только после подтверждения пары; до этого null. */
    person: { name: string | null; avatarUrl: string | null; email: string | null } | null;
    /** Проверки, которые сервер сделал сам: телефон подтверждён SMS-кодом, фирма — по NIP в GUS. Для FB-объявлений null. */
    verified: { phone: boolean; company: boolean } | null;
  };
  created_at: string;
}

export const TRUCK_TYPES: { value: string; label: string }[] = [
  { value: "firanka", label: "Firanka" },
  { value: "chlodnia", label: "Chłodnia" },
  { value: "bus", label: "Bus" },
  { value: "plandeka", label: "Plandeka" },
];

/** Регионы Польши и страны, между которыми возят грузы. Код — то, по чему сравнивает подбор. */
export const ROUTE_OPTIONS: { value: string; label: string }[] = [
  { value: "PL-MZ", label: "Mazowieckie" },
  { value: "PL-MA", label: "Małopolskie" },
  { value: "PL-WP", label: "Wielkopolskie" },
  { value: "PL-DS", label: "Dolnośląskie" },
  { value: "PL-LD", label: "Łódzkie" },
  { value: "PL-PM", label: "Pomorskie" },
  { value: "PL-SL", label: "Śląskie" },
  { value: "PL-LU", label: "Lubelskie" },
  { value: "PL-PK", label: "Podkarpackie" },
  { value: "PL-PD", label: "Podlaskie" },
  { value: "PL-ZP", label: "Zachodniopomorskie" },
  { value: "PL-LB", label: "Lubuskie" },
  { value: "PL-KP", label: "Kujawsko-pomorskie" },
  { value: "PL-WM", label: "Warmińsko-mazurskie" },
  { value: "PL-SK", label: "Świętokrzyskie" },
  { value: "PL-OP", label: "Opolskie" },
  { value: "DE", label: "Niemcy" },
  { value: "FR", label: "Francja" },
  { value: "NL", label: "Holandia" },
  { value: "CZ", label: "Czechy" },
  { value: "SK", label: "Słowacja" },
  { value: "AT", label: "Austria" },
  { value: "BE", label: "Belgia" },
  { value: "IT", label: "Włochy" },
  { value: "ES", label: "Hiszpania" },
  { value: "LT", label: "Litwa" },
  { value: "DK", label: "Dania" },
  { value: "SE", label: "Szwecja" },
  { value: "HU", label: "Węgry" },
  { value: "GB", label: "Wielka Brytania" },
];
