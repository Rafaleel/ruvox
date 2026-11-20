import type { Session } from "../api/client";

const BADGES = {
  ai: { label: "IA", hint: "Perguntas geradas pela IA" },
  offline: { label: "Offline", hint: "Perguntas do conteúdo local, sem IA" },
} as const;

export function SourceBadge({ source }: { source: Session["source"] }) {
  const { label, hint } = BADGES[source];
  return (
    <span
      title={hint}
      className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-muted"
    >
      {label}
      <span className="sr-only">: {hint}</span>
    </span>
  );
}
