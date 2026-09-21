"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MatchView } from "@/lib/types";

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6.5l2.2 2.2L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Проверки, сделанные сервером: телефон — SMS-кодом, фирма — по NIP в реестре GUS. Пусто у FB-контрагентов. */
export function VerifiedBadges({ verified }: { verified: MatchView["counterpart"]["verified"] }) {
  const { m } = useI18n();
  if (!verified || (!verified.phone && !verified.company)) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={m.match.verification}>
      {verified.phone && (
        <li className="badge badge-success">
          <CheckIcon /> {m.match.verifiedPhone}
        </li>
      )}
      {verified.company && (
        <li className="badge badge-success">
          <CheckIcon /> {m.match.verifiedCompany}
        </li>
      )}
    </ul>
  );
}
