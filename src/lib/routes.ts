import type { UserRole } from "./types";

/** Главный экран роли: логист работает с грузами, перевозчик — со своими поездками. */
export function homePath(role: UserRole | null): string {
  if (role === "carrier") return "/offers";
  if (role === "logist") return "/loads";
  return "/onboarding";
}
