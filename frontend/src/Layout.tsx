import { useQuery } from "@tanstack/react-query";
import {
  ChartNoAxesColumn,
  Flame,
  Gamepad2,
  House,
  Music2,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { getStats } from "./api/client";
import { Icon } from "./components/Icon";

const links: { to: string; label: string; end: boolean; icon: LucideIcon }[] = [
  { to: "/", label: "Início", end: true, icon: House },
  { to: "/play", label: "Jogar", end: false, icon: Gamepad2 },
  { to: "/songs", label: "Músicas", end: false, icon: Music2 },
  { to: "/progress", label: "Progresso", end: false, icon: ChartNoAxesColumn },
  { to: "/settings", label: "Configurações", end: false, icon: Settings },
];

const titles: Record<string, string> = {
  "/play": "Jogar",
  "/songs": "Músicas",
  "/progress": "Progresso",
  "/settings": "Configurações",
  "/alphabet": "Alfabeto",
};

/** Streak stamp at the bottom of the desktop rail; nothing if stats fail. */
function StreakStamp() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: ({ signal }) => getStats(signal),
    retry: false,
  });
  if (!stats.data) return null;
  const { streak } = stats.data;
  return (
    <Link
      to="/progress"
      className="mx-4 mb-4 hidden items-center gap-3 rounded-card bg-gold-soft p-3 text-gold-ink outline-2 -outline-offset-4 outline-gold/50 outline-dashed md:flex"
    >
      <Icon icon={Flame} size={28} className="shrink-0 text-gold" />
      <span className="leading-tight">
        <span className="block font-serif text-2xl font-semibold">
          {streak}
        </span>
        <span className="block text-sm font-medium">
          {streak === 1 ? "dia de sequência" : "dias de sequência"}
        </span>
      </span>
    </Link>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  // Screen readers announce the page title on navigation in a single-page app.
  useEffect(() => {
    const title = titles[pathname];
    document.title = title ? `${title} · Ruvox` : "Ruvox";
  }, [pathname]);

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-20 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-on-accent"
      >
        Pular para o conteúdo
      </a>
      {/* Wrapper is the desktop rail; on phones it vanishes and the nav becomes the tab bar. */}
      <div className="contents md:sticky md:top-0 md:flex md:h-dvh md:w-62 md:shrink-0 md:flex-col md:justify-between md:bg-sheet md:shadow-[1px_0_0_var(--hairline)]">
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-10 flex bg-sheet pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--hairline)] md:static md:flex-col md:gap-1 md:bg-transparent md:p-4 md:pt-8 md:shadow-none"
        >
          <span className="hidden px-3 pb-6 font-serif text-3xl font-semibold tracking-tight md:block">
            Ruvox
          </span>
          {links.map(({ to, label, end, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-control text-[0.6875rem] font-medium tracking-tight transition-colors before:absolute before:top-0 before:left-1/2 before:h-0.5 before:w-8 before:-translate-x-1/2 before:rounded-full before:content-[''] md:min-h-11 md:flex-none md:flex-row md:justify-start md:gap-3 md:px-3 md:text-base md:tracking-normal md:before:top-1/2 md:before:left-0 md:before:h-5 md:before:w-0.5 md:before:translate-x-0 md:before:-translate-y-1/2 ${
                  isActive
                    ? "text-ink before:bg-accent md:bg-sheet-2"
                    : "text-ink-3 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    icon={icon}
                    size={22}
                    className={isActive ? "text-accent" : undefined}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <StreakStamp />
      </div>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-4xl px-5 pt-8 pb-28 outline-none md:flex-1 md:px-10 md:pt-12 md:pb-12"
      >
        <Outlet />
      </main>
    </div>
  );
}
