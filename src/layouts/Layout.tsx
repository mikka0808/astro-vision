import { type ReactNode } from "react";
import {
  GaugeCircle,
  Home,
  Map,
  Settings,
  Star,
  Telescope,
} from "lucide-react";

const NAV_ICONS = {
  dashboard: Home,
  sky: Map,
  favorites: Star,
  settings: Settings,
} as const;

type RouteConfig = {
  key: "dashboard" | "sky" | "favorites" | "settings";
  hash: string;
  label: string;
};

type LayoutProps = {
  routes: Array<RouteConfig & { render: () => JSX.Element }>;
  activeRouteKey: RouteConfig["key"];
  onNavigate: (route: RouteConfig & { render: () => JSX.Element }) => void;
  children: ReactNode;
};

export default function Layout({ routes, activeRouteKey, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0B0C10] text-text">
      <header className="blurred safe-pt safe-px sticky top-0 z-50 flex flex-col gap-4 border-b border-white/10 bg-[#0B0C10]/80 px-4 pb-4 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-secondary/70">Observatoire</p>
            <h1 className="text-2xl font-semibold text-text">Astro-Vision</h1>
          </div>
          <button
            type="button"
            className="hidden rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-soft-primary transition hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
          >
            Analyser maintenant
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs uppercase tracking-wide text-secondary/70">Profil</label>
            <select className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-text shadow-sm focus-visible:outline focus-visible:outline-primary">
              <option>Setup nomade (AZ-GTi)</option>
              <option>Télescope fixe</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-secondary">
              Transparence : 8/10
            </span>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary">
              Seeing : 7/10
            </span>
            <span className="rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-warn">
              Alerte ISS dans 35 min
            </span>
          </div>
          <button
            type="button"
            className="rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/25 focus-visible:outline focus-visible:outline-primary"
          >
            Analyse rapide
          </button>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="hidden w-20 flex-col justify-between border-r border-white/5 px-2 py-6 lg:flex">
          <nav className="flex flex-col gap-2">
            {routes.map((route) => {
              const Icon = NAV_ICONS[route.key];
              const isActive = route.key === activeRouteKey;
              return (
                <button
                  key={route.key}
                  type="button"
                  onClick={() => onNavigate(route)}
                  className={`flex flex-col items-center gap-2 rounded-2xl px-3 py-3 text-xs font-medium transition focus-visible:outline focus-visible:outline-primary ${
                    isActive ? "bg-primary/20 text-primary" : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] uppercase tracking-wide">{route.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="flex flex-col items-center gap-2 text-center text-[10px] text-white/50">
            <GaugeCircle className="h-6 w-6" />
            <span>Optimisez vos nuits</span>
          </div>
        </aside>
        <main className="flex-1 safe-px px-4 pb-32 pt-6 sm:px-6 lg:pb-12">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
        </main>
      </div>
      <nav className="blurred safe-pb safe-px fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2 border-t border-white/10 bg-[#0B0C10]/80 px-4 py-3 lg:hidden">
        {routes.map((route) => {
          const Icon = NAV_ICONS[route.key];
          const isActive = route.key === activeRouteKey;
          return (
            <button
              key={route.key}
              type="button"
              onClick={() => onNavigate(route)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition focus-visible:outline focus-visible:outline-primary ${
                isActive ? "bg-primary/25 text-primary" : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{route.label}</span>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        className="safe-pb fixed right-4 bottom-20 z-40 flex items-center gap-2 rounded-full bg-[#4B5FEA] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#3f52d1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3AE8B8] active:scale-95 sm:bottom-6"
      >
        <Telescope className="h-5 w-5" />
        Analyser
      </button>
    </div>
  );
}
