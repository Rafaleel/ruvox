import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { getStats } from "./api/client";
import { StampFrame } from "./components/art/StampFrame";
import { Dock } from "./components/Dock";
import { DockProvider } from "./components/DockProvider";
import { Icon } from "./components/Icon";

const titles: Record<string, string> = {
  "/play": "Jogar",
  "/songs": "Músicas",
  "/progress": "Progresso",
  "/settings": "Configurações",
  "/alphabet": "Alfabeto",
};

/** Screens designed as wide compositions; every other screen is a reading column. */
const wideRoutes = new Set([
  "/",
  "/progress",
  "/alphabet",
  "/settings",
  "/songs",
]);

/** Streak stamp at the right of the header; nothing if stats fail. */
function StreakStamp() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: ({ signal }) => getStats(signal),
    retry: false,
  });
  if (!stats.data) return null;
  const { streak } = stats.data;
  const days = `${streak} ${streak === 1 ? "dia" : "dias"}`;
  return (
    <Link
      to="/progress"
      aria-label={`Sequência de ${days}. Ver progresso`}
      className="stamp-in block rounded-[0.2em] text-sm transition-transform duration-150 ease-out-soft active:scale-[.97]"
    >
      <StampFrame
        tilt
        cut="paper"
        className="flex items-center gap-2 px-3.5 py-1.5"
      >
        <Icon icon={Flame} size="1.125rem" className="text-gold" />
        <span className="font-serif text-lg leading-none font-semibold">
          {streak}
        </span>
        <span className="font-medium">{streak === 1 ? "dia" : "dias"}</span>
      </StampFrame>
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

  const width = wideRoutes.has(pathname) ? "max-w-wide" : "max-w-4xl";
  return (
    <DockProvider>
      <div className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-70 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-on-accent"
        >
          Pular para o conteúdo
        </a>
        <header
          className={`mx-auto flex w-full items-center justify-between px-5 pt-5 min-[48rem]:px-10 min-[48rem]:pt-7 ${width}`}
        >
          <span className="border-l-2 border-accent pl-2.5 font-serif text-2xl leading-none font-semibold tracking-tight">
            Ruvox
          </span>
          <StreakStamp />
        </header>
        <main
          id="conteudo"
          tabIndex={-1}
          className={`@container mx-auto w-full min-w-0 px-5 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none min-[48rem]:px-10 min-[48rem]:pt-8 ${width}`}
        >
          {/* Keyed by route so every screen enters with the page animation. */}
          <div key={pathname} className="page-in">
            <Outlet />
          </div>
        </main>
        <Dock />
      </div>
    </DockProvider>
  );
}
