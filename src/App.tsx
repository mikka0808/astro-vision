import { useCallback, useEffect, useState } from "react";
import Layout from "./layouts/Layout";
import DashboardPage from "./pages/Dashboard";
import SkyPage from "./pages/Sky";
import FavoritesPage from "./pages/Favorites";
import SettingsPage from "./pages/Settings";
import { useViewportHeight } from "./utils/viewport";

type RouteKey = "dashboard" | "sky" | "favorites" | "settings";

type RouteConfig = {
  key: RouteKey;
  hash: string;
  label: string;
  render: () => JSX.Element;
};

const ROUTES: RouteConfig[] = [
  {
    key: "dashboard",
    hash: "#/dashboard",
    label: "Tableau de bord",
    render: () => <DashboardPage />,
  },
  {
    key: "sky",
    hash: "#/sky",
    label: "Carte du ciel",
    render: () => <SkyPage />,
  },
  {
    key: "favorites",
    hash: "#/favorites",
    label: "Favoris",
    render: () => <FavoritesPage />,
  },
  {
    key: "settings",
    hash: "#/settings",
    label: "Réglages",
    render: () => <SettingsPage />,
  },
];

const DEFAULT_ROUTE: RouteConfig = ROUTES[0];

function resolveRouteFromHash(hash: string | undefined): RouteConfig {
  if (!hash) return DEFAULT_ROUTE;
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  return ROUTES.find((route) => route.hash === normalized) ?? DEFAULT_ROUTE;
}

export default function App() {
  useViewportHeight();

  const [activeRoute, setActiveRoute] = useState<RouteConfig>(() =>
    resolveRouteFromHash(window.location.hash || undefined)
  );

  const navigate = useCallback((route: RouteConfig) => {
    window.location.hash = route.hash;
    setActiveRoute(route);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveRoute(resolveRouteFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) {
      window.location.hash = DEFAULT_ROUTE.hash;
    }

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const ActiveComponent = activeRoute.render;

  return (
    <Layout
      routes={ROUTES}
      activeRouteKey={activeRoute.key}
      onNavigate={navigate}
    >
      <ActiveComponent />
    </Layout>
  );
}
