import type { AppUser } from "./types";

type ProfileFacts = Pick<AppUser, "role" | "full_name" | "email" | "avatar_url" | "company_name" | "nip" | "languages" | "truck_types" | "preferred_routes">;

export type MissingKey = "name" | "photo" | "email" | "company" | "languages" | "trucks" | "routes";

export interface Completeness {
  percent: number;
  /** Чего не хватает, в порядке важности; подпись на нужном языке подбирает интерфейс. */
  missing: MissingKey[];
}

/** Заполненность профиля: каждый пункт весит одинаково; перевозчику дополнительно нужны кузов и направления. */
export function profileCompleteness(user: ProfileFacts): Completeness {
  const steps: { done: boolean; key: MissingKey }[] = [
    { done: Boolean(user.full_name), key: "name" },
    { done: Boolean(user.avatar_url), key: "photo" },
    { done: Boolean(user.email), key: "email" },
    { done: Boolean(user.nip || user.company_name), key: "company" },
    { done: user.languages.length > 0, key: "languages" },
    ...(user.role === "carrier"
      ? [
          { done: user.truck_types.length > 0, key: "trucks" as const },
          { done: user.preferred_routes.length > 0, key: "routes" as const },
        ]
      : []),
  ];
  const done = steps.filter((s) => s.done).length;
  return { percent: Math.round((done / steps.length) * 100), missing: steps.filter((s) => !s.done).map((s) => s.key) };
}

/** «Jan Kowalski» → «JK»; без имени — пусто (аватар в этом случае рисует силуэт, а не вопросительный знак). */
export function initials(fullName: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
