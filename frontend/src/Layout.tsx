import { NavLink, Outlet } from "react-router";

const links = [
  { to: "/", label: "Início", end: true },
  { to: "/play", label: "Jogar", end: false },
  { to: "/alphabet", label: "Alfabeto", end: false },
];

export function Layout() {
  return (
    <div className="min-h-dvh md:flex">
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
              `flex min-h-14 flex-1 items-center justify-center font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:min-h-11 md:flex-none md:justify-start md:rounded-lg md:px-3 ${
                isActive ? "bg-surface text-accent" : "text-muted"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="mx-auto w-full min-w-0 max-w-3xl px-5 pt-8 pb-28 md:flex-1 md:px-10 md:pb-10">
        <Outlet />
      </main>
    </div>
  );
}
