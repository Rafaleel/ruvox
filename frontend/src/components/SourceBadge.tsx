import { Sparkles, WifiOff } from "lucide-react";
import type { Session } from "../api/client";
import { Badge } from "./Badge";

const BADGES = {
  ai: {
    label: "IA",
    hint: "Perguntas geradas pela IA",
    tone: "gold",
    icon: Sparkles,
  },
  offline: {
    label: "Offline",
    hint: "Perguntas do conteúdo local, sem IA",
    tone: "neutral",
    icon: WifiOff,
  },
} as const;

export function SourceBadge({ source }: { source: Session["source"] }) {
  const { label, hint, tone, icon } = BADGES[source];
  return (
    <Badge
      tone={tone}
      icon={icon}
      title={hint}
      className="gap-1.5 py-1 text-[0.8125rem] ring-1 ring-current/25 ring-inset"
    >
      {label}
      <span className="sr-only">: {hint}</span>
    </Badge>
  );
}
