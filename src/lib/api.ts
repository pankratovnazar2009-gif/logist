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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "unknown_error");
  return body as T;
}

export const api = {
  requestOtp: (phone: string) => request<{ ok: true }>("/api/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string) =>
    request<{ token: string; user: import("./types").AppUser }>("/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  me: () => request<{ user: import("./types").AppUser }>("/api/users/me"),
  saveProfile: (payload: { role: "logist" | "carrier"; nip?: string; truck_types?: string[]; preferred_routes?: string[] }) =>
    request<{ user: import("./types").AppUser }>("/api/users/me/profile", { method: "POST", body: JSON.stringify(payload) }),
  lookupNip: (nip: string) =>
    request<{ company: { name: string; regon: string; city: string | null; street: string | null } }>(`/api/nip/${nip}`),
  listLoads: () => request<{ loads: import("./types").Load[] }>("/api/loads"),
  getLoad: (id: string) => request<{ load: import("./types").Load }>(`/api/loads/${id}`),
  createLoad: (payload: {
    origin: string;
    destination: string;
    origin_region?: string;
    destination_region?: string;
    truck_required?: string;
    price?: string;
    contact_info?: string;
  }) => request<{ load: import("./types").Load }>("/api/loads", { method: "POST", body: JSON.stringify(payload) }),
};
