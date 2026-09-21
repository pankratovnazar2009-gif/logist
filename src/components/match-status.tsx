import type { ClosedReason, MatchState, Party } from "@/lib/match-state";

const CLOSED_TEXT: Record<ClosedReason, string> = {
  load_taken: "Ładunek został już przydzielony komuś innemu.",
  offer_taken: "Ten przewoźnik jest już zajęty.",
  expired: "Ogłoszenie wygasło.",
  cancelled: "Ogłoszenie zostało wycofane.",
};

/** Эта пара ждёт реакции именно этого пользователя. */
export const needsMyAction = (state: MatchState, viewer: Party): boolean => state.status === "requested" && state.by !== viewer;

export function MatchStateBadge({ state, viewer }: { state: MatchState; viewer: Party }) {
  switch (state.status) {
    case "pending":
      return <span className="badge badge-accent">nowe</span>;
    case "requested":
      return state.by === viewer ? <span className="badge badge-warning">czeka na odpowiedź</span> : <span className="badge badge-danger">wymaga reakcji</span>;
    case "confirmed":
      return <span className="badge badge-success">połączono</span>;
    case "declined":
      return <span className="badge badge-warning">odrzucone</span>;
    case "closed":
      return <span className="badge badge-warning">zamknięte</span>;
  }
}

/** Что происходит с парой и что делать дальше — простыми словами, с точки зрения пользователя. */
export function describeState(state: MatchState, viewer: Party, canConnect: boolean): string {
  switch (state.status) {
    case "pending":
      return canConnect
        ? "Możesz poprosić o kontakt. Dane kontaktowe odblokują się dopiero po potwierdzeniu przez drugą stronę."
        : "Ogłoszenie z grupy Facebook — kontakt jest publiczny, możesz działać od razu.";
    case "requested":
      return state.by === viewer
        ? "Prośba wysłana. Czekamy na potwierdzenie drugiej strony — dostaniesz SMS."
        : "Druga strona chce się z Tobą połączyć. Potwierdź, aby odblokować kontakt.";
    case "confirmed":
      return "Połączono. Kontakt do drugiej strony jest odblokowany.";
    case "declined":
      return state.by === viewer ? "Odrzuciłeś to dopasowanie." : "Druga strona odrzuciła to dopasowanie.";
    case "closed":
      return CLOSED_TEXT[state.reason];
  }
}
