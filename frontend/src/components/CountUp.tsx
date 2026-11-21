import { useEffect, useRef } from "react";

const DURATION_MS = 550;

/**
 * A number that counts up from zero when it appears. The text is written to the
 * DOM directly (React renders no children), so the final value is always the
 * element's text for screen readers and tests, and nothing animates under
 * `prefers-reduced-motion`.
 */
export function CountUp({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = String(value);
    const calm =
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm || value <= 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      // Ease-out: fast at first, settling on the final value.
      el.textContent = String(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    el.textContent = "0";
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = String(value);
    };
  }, [value]);
  return <span ref={ref} className={className} />;
}
