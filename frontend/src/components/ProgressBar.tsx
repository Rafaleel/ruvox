export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-2.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}
