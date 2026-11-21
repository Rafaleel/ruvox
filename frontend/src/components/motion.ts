import type { CSSProperties } from "react";

/** Entrance delay for the `.rise` class: item `i` starts `i * 40ms` later. */
export const stagger = (i: number) => ({ "--i": i }) as CSSProperties;
