import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { Shell } from "./components/Shell";
import { useSession } from "./lib/session";
import { LoginPage, NotOnTeam } from "./routes/login";
import { OverviewPage } from "./routes/overview";
import { InboxPage } from "./routes/inbox";
import { ClientsPage } from "./routes/clients";
import { ClientPage } from "./routes/client";
import { BotsPage } from "./routes/bots";
import { TasksPage } from "./routes/tasks";
import { ReportsPage } from "./routes/reports";
import { SettingsPage } from "./routes/settings";
import { Skeleton } from "./components/ui";

function Root() {
  const { session, loading, role } = useSession();
  if (loading) return <Skeleton rows={6} />;
  if (!session) return <LoginPage />;
  if (!role) return <NotOnTeam />;
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

const rootRoute = createRootRoute({ component: Root });

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export type InboxSearch = {
  status?: string;
  agent?: string;
  priority?: string;
  category?: string;
  item?: string;
  stale?: string;
};

const routes = [
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: OverviewPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/inbox",
    component: InboxPage,
    validateSearch: (s: Record<string, unknown>): InboxSearch => ({
      status: str(s.status),
      agent: str(s.agent),
      priority: str(s.priority),
      category: str(s.category),
      item: str(s.item),
      stale: str(s.stale),
    }),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: "/clients", component: ClientsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/clients/$clientId",
    component: ClientPage,
    validateSearch: (s: Record<string, unknown>): { tab?: string } => ({ tab: str(s.tab) }),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: "/bots", component: BotsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/tasks", component: TasksPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/reports",
    component: ReportsPage,
    validateSearch: (s: Record<string, unknown>): { id?: string; type?: string } => ({ id: str(s.id), type: str(s.type) }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: SettingsPage,
    validateSearch: (s: Record<string, unknown>): { tab?: string } => ({ tab: str(s.tab) }),
  }),
];

export const router = createRouter({ routeTree: rootRoute.addChildren(routes) });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
