import React, { useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useWeddingHubAuth } from "./context/WeddingHubAuthContext";
import { WeddingHubProvider } from "./context/WeddingHubContext";
import { useWeddingHubTheme } from "./context/WeddingHubThemeContext";
import { useWeddingData } from "./hooks/useWeddingData";
import "./weddingHubTheme.css";

const NAV_ITEMS = [
  { path: "/wedding-hub/dashboard", label: "Tablou de bord" },
  { path: "/wedding-hub/timeline", label: "Timeline" },
  { path: "/wedding-hub/guests", label: "Invitați" },
  { path: "/wedding-hub/seating", label: "Plan de mese" },
  { path: "/wedding-hub/checklist", label: "Checklist" },
  { path: "/wedding-hub/messages", label: "Mesaje" },
  ...(import.meta.env.VITE_WEDDING_HUB_MOCKS === "1" ? [{ path: "/wedding-hub/mock", label: "Mock" }] : []),
  { path: "/wedding-hub/settings", label: "Setări" },
];

function WeddingHubShell() {
  useWeddingData();
  const { coupleAuth, signOutAsCouple } = useWeddingHubAuth();
  const { theme, toggleThemeOverride } = useWeddingHubTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOutAsCouple();
    navigate("/wedding-hub/login");
  };

  const activeLabel = NAV_ITEMS.find((item) => item.path === location.pathname)?.label ?? "Wedding Hub";

  return (
    <div className="wedding-hub-shell min-h-screen bg-neutral-950 text-white lg:flex" data-theme={theme}>
      <aside className="wedding-hub-sidebar hidden lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-neutral-800 lg:bg-neutral-900/70 lg:backdrop-blur">
        <div className="border-b border-neutral-800 px-6 py-6">
          <p className="text-rose-400 font-semibold tracking-wide text-sm">Wedding Hub</p>
          <p className="mt-2 text-2xl font-light text-white">Wedding Planner</p>
          {coupleAuth.coupleUser && (
            <p className="mt-2 text-xs text-neutral-500 break-all">{coupleAuth.coupleUser.email}</p>
          )}
          <button
            type="button"
            onClick={toggleThemeOverride}
            className="wedding-hub-ghost-button mt-4 inline-flex rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-5">
          {NAV_ITEMS.map((navItem) => (
            <NavLink
              key={navItem.path}
              to={navItem.path}
              className={({ isActive }) =>
                `wedding-hub-navlink block rounded-xl px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/60 hover:text-white"
                }`
              }
            >
              {navItem.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-neutral-800 p-4">
          <button
            onClick={handleSignOut}
            className="wedding-hub-ghost-button w-full rounded-xl border border-neutral-700 px-4 py-3 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
          >
            Ieși
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="wedding-hub-mobile-header sticky top-0 z-40 border-b border-neutral-800 bg-neutral-900 lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="wedding-hub-ghost-button rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              Meniu
            </button>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Wedding Hub</p>
              <p className="text-sm text-white">{activeLabel}</p>
            </div>
            <button
              type="button"
              onClick={toggleThemeOverride}
              className="wedding-hub-ghost-button rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setMobileMenuOpen(false);
            }
          }}
        >
          <div className="wedding-hub-mobile-drawer h-full w-[82%] max-w-xs border-r border-neutral-800 bg-neutral-900 p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <p className="text-rose-400 font-semibold tracking-wide text-sm">Wedding Hub</p>
                <p className="mt-1 text-lg font-light text-white">Wedding Planner</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Închide meniul"
                className="wedding-hub-ghost-button rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300"
              >
                ×
              </button>
            </div>

            {coupleAuth.coupleUser && (
              <p className="mt-4 break-all text-xs text-neutral-500">{coupleAuth.coupleUser.email}</p>
            )}

            <button
              type="button"
              onClick={toggleThemeOverride}
              className="wedding-hub-ghost-button mt-4 w-full rounded-xl border border-neutral-700 px-4 py-3 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
            >
              {theme === "dark" ? "Comută pe light mode" : "Comută pe dark mode"}
            </button>

            <nav className="mt-5 space-y-2">
              {NAV_ITEMS.map((navItem) => (
                <NavLink
                  key={navItem.path}
                  to={navItem.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `wedding-hub-navlink block rounded-xl px-4 py-3 text-sm transition-colors ${
                      isActive
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                    }`
                  }
                >
                  {navItem.label}
                </NavLink>
              ))}
            </nav>

            <button
              onClick={handleSignOut}
              className="wedding-hub-ghost-button mt-6 w-full rounded-xl border border-neutral-700 px-4 py-3 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
            >
              Ieși
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const WeddingHubLayout: React.FC = () => {
  return (
    <WeddingHubProvider>
      <WeddingHubShell />
    </WeddingHubProvider>
  );
};

export default WeddingHubLayout;
