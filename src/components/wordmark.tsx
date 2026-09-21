/** Название продукта. Точка в акцентном цвете — узнаваемая деталь; она же используется в шапке, на входе и в SMS. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-[family-name:var(--font-display)] font-extrabold tracking-tight ${className}`}>
      Pozna<span style={{ color: "var(--color-accent)" }}>.</span>logist
    </span>
  );
}
