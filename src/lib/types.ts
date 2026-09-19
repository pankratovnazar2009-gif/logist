export type UserRole = "logist" | "carrier";

export interface AppUser {
  id: string;
  auth_user_id: string | null;
  phone: string | null;
  role: UserRole | null;
  company_name: string | null;
  nip: string | null;
  truck_types: string[];
  preferred_routes: string[];
  created_at: string;
}

export type LoadStatus = "active" | "matched" | "expired";
export type LoadSource = "facebook" | "direct";

export interface Load {
  id: string;
  source: LoadSource;
  logist_id: string | null;
  origin: string | null;
  destination: string | null;
  origin_region: string | null;
  destination_region: string | null;
  truck_required: string | null;
  price: string | null;
  raw_text: string | null;
  contact_info: string | null;
  status: LoadStatus;
  created_at: string;
  expires_at: string;
}

export const TRUCK_TYPES: { value: string; label: string }[] = [
  { value: "firanka", label: "Firanka" },
  { value: "chlodnia", label: "Chłodnia" },
  { value: "bus", label: "Bus" },
  { value: "plandeka", label: "Plandeka" },
];

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
];
