import {
  ChartNoAxesColumn,
  Gamepad2,
  House,
  Music2,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { cx } from "./cx";
import { useDockHidden } from "./DockProvider";
import { Icon } from "./Icon";

const links: { to: string; label: string; end: boolean; icon: LucideIcon }[] = [
  { to: "/", label: "Início", end: true, icon: House },
  { to: "/play", label: "Jogar", end: false, icon: Gamepad2 },
  { to: "/songs", label: "Músicas", end: false, icon: Music2 },
  { to: "/progress", label: "Progresso", end: false, icon: ChartNoAxesColumn },
  { to: "/settings", label: "Configurações", end: false, icon: Settings },
];

/**
 * The floating pill dock: the only navigation. Inactive labels collapse on
 * narrow windows (they stay in the accessibility tree), the accent pill slides
 * to the active item, and `useHideDock` slides the whole thing away.
 */
export function Dock() {
  const { pathname } = useLocation();
  const hidden = useDockHidden();
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  // The first measurement must not animate from the left edge.
  const [ready, setReady] = useState(false);

  const active = links.findIndex(({ to, end }) =>
    end ? pathname === to : pathname.startsWith(to),
  );

  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    const measure = () => {
      const item = root.querySelectorAll<HTMLElement>("a")[active];
      setPill(item ? { x: item.offsetLeft, w: item.offsetWidth } : null);
    };
    measure();
    // Widths change with the fluid root size and with the collapsing labels.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    root.querySelectorAll("a").forEach((a) => observer.observe(a));
    return () => observer.disconnect();
  }, [active]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3">
      <nav
        aria-label="Navegação principal"
        inert={hidden}
        className={cx(
          "pointer-events-auto rounded-full bg-sheet/85 p-1.5 shadow-float backdrop-blur-xl backdrop-saturate-150",
          "transition-[transform,opacity] duration-300 ease-out-soft",
          hidden && "translate-y-[calc(100%+2rem)] opacity-0",
        )}
      >
        <div ref={list} className="relative flex items-center gap-0.5">
          <span
            aria-hidden="true"
            className={cx(
              "absolute top-0 left-0 h-full rounded-full bg-accent shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_2px_6px_-2px_var(--accent)]",
              !pill && "opacity-0",
              ready &&
                "transition-[transform,opacity] duration-300 ease-out-soft",
            )}
            style={{
              width: pill?.w,
              transform: `translateX(${pill?.x ?? 0}px)`,
            }}
          />
          {links.map(({ to, label, end, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  "relative flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-[0.9375rem] font-medium whitespace-nowrap select-none",
                  "transition-[color,background-color,transform] duration-150 ease-out-soft active:scale-[.97]",
                  isActive
                    ? "text-on-accent"
                    : "text-ink-2 hover:bg-ink/7 hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon icon={icon} size="1.25rem" />
                  <span className={cx(!isActive && "max-[44rem]:sr-only")}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
