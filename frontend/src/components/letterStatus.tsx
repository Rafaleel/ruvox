import type { LetterStatus } from "../api/client";
import { cx } from "./cx";

export type Mastery = LetterStatus["status"];

/** One source of truth for how a mastery level is named and painted. */
export const MASTERY_META: Record<
  Mastery,
  { label: string; plural: string; tile: string; pip: string }
> = {
  new: {
    label: "nova",
    plural: "novas",
    tile: "border border-dashed border-rule bg-transparent text-ink-2",
    pip: "text-ink-3",
  },
  learning: {
    label: "aprendendo",
    plural: "aprendendo",
    tile: "bg-accent-soft text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_50%,transparent)]",
    pip: "text-accent",
  },
  familiar: {
    label: "familiar",
    plural: "familiares",
    tile: "bg-gold-soft text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold)_60%,transparent)]",
    pip: "text-gold-ink",
  },
  mastered: {
    label: "dominada",
    plural: "dominadas",
    tile: "bg-success text-on-success",
    pip: "text-on-success",
  },
};

export const MASTERY_ORDER: Mastery[] = [
  "new",
  "learning",
  "familiar",
  "mastered",
];

/** A pie slice from 12 o'clock, clockwise, for a fraction of a 20 unit circle. */
const slice = (fraction: number) => {
  const a = fraction * Math.PI * 2;
  const x = 10 + 7 * Math.sin(a);
  const y = 10 - 7 * Math.cos(a);
  return `M10 10 L10 3 A7 7 0 ${fraction > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
};

/**
 * The status as a shape, so it never relies on color alone: an empty ring
 * (new), a half pie (learning), three quarters (familiar) and a ring with a
 * check (mastered). Sized in `em`; color comes from `currentColor`.
 */
export function StatusPip({
  status,
  className,
}: {
  status: Mastery;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className={cx("size-[1em] shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={10} cy={10} r={7} />
      {status === "learning" && (
        <path d={slice(0.5)} fill="currentColor" stroke="none" />
      )}
      {status === "familiar" && (
        <path d={slice(0.75)} fill="currentColor" stroke="none" />
      )}
      {status === "mastered" && <path d="M6.6 10.2 L9 12.5 L13.6 7.6" />}
    </svg>
  );
}
