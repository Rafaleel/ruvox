import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

const links = [
  { to: "/", label: "Início", end: true },
  { to: "/play", label: "Jogar", end: false },
  { to: "/songs", label: "Músicas", end: false },
  { to: "/progress", label: "Progresso", end: false },
  { to: "/settings", label: "Configurações", end: false },
];

const titles: Record<string, string> = {
  "/play": "Jogar",
  "/songs": "Músicas",
  "/progress": "Progresso",
  "/settings": "Configurações",
  "/alphabet": "Alfabeto",
};

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
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-20 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-on-accent"
      >
        Pular para o conteúdo
      </a>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-paper md:sticky md:inset-x-auto md:top-0 md:bottom-auto md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-t-0 md:border-r md:p-4"
      >
        <span className="hidden px-3 pb-4 text-2xl font-extrabold tracking-tight md:block">
          Ruvox
        </span>
        {links.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-14 flex-1 items-center justify-center px-0.5 text-xs font-semibold min-[400px]:text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:min-h-11 md:flex-none md:text-base md:justify-start md:rounded-lg md:px-3 ${
                isActive ? "bg-surface text-accent" : "text-muted"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-3xl px-5 pt-8 pb-28 outline-none md:flex-1 md:px-10 md:pb-10"
      >
        <Outlet />
      </main>
    </div>
  );
}
