// API живёт в том же Next.js-приложении (src/app/api), поэтому запросы идут на тот же origin.
const API_URL = "";
const TOKEN_KEY = "logist_app_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** Поля, которые можно менять в профиле; null очищает поле. */
export interface ProfilePatch {
  full_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  nip?: string | null;
  languages?: string[];
  truck_types?: string[];
  preferred_routes?: string[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  for (const [key, value] of Object.entries((init?.headers ?? {}) as Record<string, string | undefined>)) {
    if (value === undefined) headers.delete(key);
    else headers.set(key, value);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "unknown_error");
  return withProfileDefaults(body) as T;
}

/**
 * Пока миграция 0003 не выполнена, у пользователя из БД нет полей профиля. Подставляем пустые значения,
 * чтобы экран профиля открывался (а не падал), а сохранение честно сообщало об ошибке.
 */
function withProfileDefaults(body: unknown): unknown {
  if (!body || typeof body !== "object" || !("user" in body)) return body;
  const user = (body as { user: unknown }).user;
  if (!user || typeof user !== "object") return body;
  const u = user as Record<string, unknown>;
  return { ...body, user: { ...u, full_name: u.full_name ?? null, email: u.email ?? null, avatar_url: u.avatar_url ?? null, languages: u.languages ?? [] } };
}

export const api = {
  requestOtp: (phone: string) => request<{ ok: true }>("/api/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string) =>
    request<{ token: string; user: import("./types").AppUser }>("/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  me: () => request<{ user: import("./types").AppUser }>("/api/users/me"),
  updateProfile: (patch: ProfilePatch) =>
    request<{ user: import("./types").AppUser }>("/api/users/me", { method: "PATCH", body: JSON.stringify(patch) }),
  uploadAvatar: (photo: Blob) => {
    const form = new FormData();
    form.append("file", photo, "avatar.jpg");
    // Content-Type не задаём: браузер сам добавит multipart-границу.
    return request<{ user: import("./types").AppUser }>("/api/users/me/avatar", { method: "POST", body: form, headers: { "Content-Type": undefined as unknown as string } });
  },
  removeAvatar: () => request<{ user: import("./types").AppUser }>("/api/users/me/avatar", { method: "DELETE" }),
  saveProfile: (payload: { role: "logist" | "carrier"; nip?: string; truck_types?: string[]; preferred_routes?: string[] }) =>
    request<{ user: import("./types").AppUser }>("/api/users/me/profile", { method: "POST", body: JSON.stringify(payload) }),
  lookupNip: (nip: string) =>
    request<{ company: { name: string; regon: string; city: string | null; street: string | null } }>(`/api/nip/${nip}`),
  listLoads: () => request<{ loads: import("./types").LoadWithCount[] }>("/api/loads"),
  getLoad: (id: string) => request<{ load: import("./types").Load }>(`/api/loads/${id}`),
  createLoad: (payload: import("./types").NewLoadPayload) =>
    request<{ load: import("./types").Load }>("/api/loads", { method: "POST", body: JSON.stringify(payload) }),
  cancelLoad: (id: string) => request<{ ok: true }>(`/api/loads/${id}`, { method: "DELETE" }),

  listOffers: () => request<{ offers: import("./types").OfferWithCount[] }>("/api/offers"),
  getOffer: (id: string) => request<{ offer: import("./types").CarrierOffer }>(`/api/offers/${id}`),
  createOffer: (payload: import("./types").NewOfferPayload) =>
    request<{ offer: import("./types").CarrierOffer }>("/api/offers", { method: "POST", body: JSON.stringify(payload) }),
  cancelOffer: (id: string) => request<{ ok: true }>(`/api/offers/${id}`, { method: "DELETE" }),

  listMatches: (scope: { load?: string; offer?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(scope).filter((e): e is [string, string] => Boolean(e[1]))).toString();
    return request<{ matches: import("./types").MatchView[] }>(`/api/matches${query ? `?${query}` : ""}`);
  },
  getMatch: (id: string) => request<{ match: import("./types").MatchView }>(`/api/matches/${id}`),
  matchAction: (id: string, action: import("./match-state").MatchAction) =>
    request<{ match: import("./types").MatchView }>(`/api/matches/${id}`, { method: "POST", body: JSON.stringify({ action }) }),
  reportOutcome: (id: string, outcome: "completed" | "failed") =>
    request<{ match: import("./types").MatchView }>(`/api/matches/${id}/outcome`, { method: "POST", body: JSON.stringify({ outcome }) }),
};
