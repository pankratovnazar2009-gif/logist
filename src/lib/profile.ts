import type { AppUser } from "./types";

type ProfileFacts = Pick<AppUser, "role" | "full_name" | "email" | "avatar_url" | "company_name" | "nip" | "languages" | "truck_types" | "preferred_routes">;

export interface Completeness {
  percent: number;
  /** Чего не хватает, в порядке важности — для подсказки «добавь …». */
  missing: string[];
}

/** Заполненность профиля: каждый пункт весит одинаково; перевозчику дополнительно нужны кузов и направления. */
export function profileCompleteness(user: ProfileFacts): Completeness {
  const steps: { done: boolean; label: string }[] = [
    { done: Boolean(user.full_name), label: "imię i nazwisko" },
    { done: Boolean(user.avatar_url), label: "zdjęcie" },
    { done: Boolean(user.email), label: "e-mail" },
    { done: Boolean(user.nip || user.company_name), label: "firma" },
    { done: user.languages.length > 0, label: "języki" },
    ...(user.role === "carrier"
      ? [
          { done: user.truck_types.length > 0, label: "typ nadwozia" },
          { done: user.preferred_routes.length > 0, label: "kierunki" },
        ]
      : []),
  ];
  const done = steps.filter((s) => s.done).length;
  return { percent: Math.round((done / steps.length) * 100), missing: steps.filter((s) => !s.done).map((s) => s.label) };
}

/** «Jan Kowalski» → «JK»; без имени — «?», чтобы аватар не был пустым. */
export function initials(fullName: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
