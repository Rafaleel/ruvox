import type { CSSProperties } from "react";
import { cx } from "../cx";

/** Onion dome outline: a bulb wider than its base that ends in a point. */
const onion = (cx: number, y: number, w: number, h: number) => {
  const r = w / 2;
  return `M${cx - r} ${y} C${cx - r * 1.3} ${y - h * 0.5} ${cx - r * 0.3} ${y - h * 0.66} ${cx} ${y - h} C${cx + r * 0.3} ${y - h * 0.66} ${cx + r * 1.3} ${y - h * 0.5} ${cx + r} ${y} Z`;
};

/** A rib following the dome's curve; `f` runs from -1 (left edge) to 1 (right). */
const rib = (cx: number, y: number, w: number, h: number, f: number) => {
  const r = (w / 2) * f;
  return `M${cx + r} ${y} C${cx + r * 1.35} ${y - h * 0.5} ${cx + r * 0.3} ${y - h * 0.68} ${cx} ${y - h}`;
};

type Fill = "paper" | "accent" | "gold";
const fills: Record<Fill, string> = {
  paper: "var(--sheet)",
  accent: "color-mix(in srgb, var(--accent) 20%, var(--sheet))",
  gold: "color-mix(in srgb, var(--gold) 32%, var(--sheet))",
};

function Cross({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="var(--gold)" strokeWidth={1.6} strokeLinecap="round">
      <path d={`M${x} ${y} V${y - 18}`} />
      <path d={`M${x - 5} ${y - 12} H${x + 5}`} />
      <path d={`M${x - 3.5} ${y - 6} L${x + 3.5} ${y - 8.5}`} />
      <circle cx={x} cy={y + 1.5} r={2} fill="var(--gold)" stroke="none" />
    </g>
  );
}

function Church({
  cx,
  base,
  drumW,
  drumH,
  domeW,
  domeH,
  fill = "paper",
  ribs = [],
}: {
  cx: number;
  base: number;
  drumW: number;
  drumH: number;
  domeW: number;
  domeH: number;
  fill?: Fill;
  ribs?: number[];
}) {
  return (
    <g>
      <rect
        x={cx - drumW / 2}
        y={base}
        width={drumW}
        height={drumH}
        fill="var(--sheet)"
      />
      {[-0.55, 0, 0.55].map((k) => (
        <path
          key={k}
          d={`M${cx + k * drumW * 0.5 - 3} ${base + 22} v-9 a3 3 0 0 1 6 0 v9 Z`}
          strokeWidth={1.2}
          opacity={0.7}
        />
      ))}
      <path d={onion(cx, base, domeW, domeH)} fill={fills[fill]} />
      {ribs.map((f) => (
        <path
          key={f}
          d={rib(cx, base, domeW, domeH, f)}
          strokeWidth={1.1}
          opacity={0.6}
        />
      ))}
      <Cross x={cx} y={base - domeH - 2} />
    </g>
  );
}

const GROUND = 200;

/** Swallowtail merlons of a Kremlin wall: the foreground band. */
const wall = () => {
  let d = `M-1990 ${GROUND} V178`;
  for (let x = -1990; x < 2710; x += 24) d += ` H${x} v-10 l6 6 l6 -6 v10`;
  return `${d} H2710 V${GROUND} Z`;
};

const stars = [
  [40, 40],
  [118, 22],
  [214, 14],
  [300, 30],
  [420, 18],
  [520, 30],
  [676, 70],
];

/**
 * Line-art skyline of onion domes and a tent-roof tower, drawn with the design
 * tokens. It fills the width of its parent and keeps a 720:204 proportion.
 */
export function DomeSkyline({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 720 204"
      aria-hidden="true"
      focusable="false"
      className={cx("overflow-visible", className)}
      style={style}
      fill="none"
      stroke="var(--ink-2)"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <circle cx={612} cy={44} r={15} stroke="var(--gold)" />
      <circle cx={618} cy={40} r={15} fill="var(--sheet)" stroke="none" />
      {stars.map(([x, y]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={1.6}
          fill="var(--ink-3)"
          stroke="none"
          opacity={0.7}
        />
      ))}

      <Church
        cx={62}
        base={128}
        drumW={40}
        drumH={72}
        domeW={52}
        domeH={58}
        ribs={[-0.4, 0.4]}
      />
      <Church
        cx={146}
        base={108}
        drumW={52}
        drumH={92}
        domeW={72}
        domeH={74}
        fill="accent"
        ribs={[-0.6, -0.2, 0.2, 0.6]}
      />

      {/* tent-roof tower */}
      <g>
        <rect x={326} y={118} width={68} height={82} fill="var(--sheet)" />
        <path d="M318 118 L360 62 L402 118 Z" fill="var(--sheet)" />
        <path d="M326 106 H394 M334 94 H386 M342 82 H378" opacity={0.55} />
        <path d="M360 118 V62" opacity={0.35} />
        <path d="M344 142 v-14 a6 6 0 0 1 12 0 v14 M364 142 v-14 a6 6 0 0 1 12 0 v14" />
        <path d={onion(360, 62, 24, 26)} fill={fills.gold} />
        <Cross x={360} y={34} />
      </g>

      <Church
        cx={246}
        base={120}
        drumW={44}
        drumH={80}
        domeW={60}
        domeH={62}
        fill="gold"
        ribs={[-0.5, 0.5]}
      />
      <Church
        cx={466}
        base={112}
        drumW={54}
        drumH={88}
        domeW={76}
        domeH={80}
        fill="accent"
        ribs={[-0.65, -0.3, 0.3, 0.65]}
      />
      <Church
        cx={560}
        base={138}
        drumW={36}
        drumH={62}
        domeW={46}
        domeH={46}
        ribs={[-0.4, 0.4]}
      />
      <Church
        cx={648}
        base={150}
        drumW={32}
        drumH={50}
        domeW={40}
        domeH={38}
        fill="gold"
      />

      <path d={wall()} fill="var(--sheet)" />
    </svg>
  );
}
