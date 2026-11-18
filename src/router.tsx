import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { Shell } from "./components/Shell";
import { useSession } from "./lib/session";
import { LoginPage, NotOnTeam, ServerUnreachable } from "./routes/login";
import { OverviewPage } from "./routes/overview";
import { InboxPage } from "./routes/inbox";
import { ClientsPage } from "./routes/clients";
import { ClientPage } from "./routes/client";
import { BotsPage } from "./routes/bots";
import { TasksPage } from "./routes/tasks";
import { ReportsPage } from "./routes/reports";
import { SettingsPage } from "./routes/settings";
import {
  BacklinksPage,
  BulkAnalysisPage,
  DomainResearchPage,
  KeywordResearchPage,
} from "./routes/research";

function Root() {
  const { session, loading, role, meError } = useSession();
  if (loading)
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <p className="text-ink-3">Loading Atelier…</p>
      </div>
    );
  if (!session) return <LoginPage />;
  if (meError) return <ServerUnreachable />;
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
  /** decide, unblock, answer or history */
  view?: string;
  status?: string;
  agent?: string;
  priority?: string;
  category?: string;
  item?: string;
  stale?: string;
};

const routes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: OverviewPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/inbox",
    component: InboxPage,
    validateSearch: (s: Record<string, unknown>): InboxSearch => ({
      view: str(s.view),
      status: str(s.status),
      agent: str(s.agent),
      priority: str(s.priority),
      category: str(s.category),
      item: str(s.item),
      stale: str(s.stale),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/clients",
    component: ClientsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/clients/$clientId",
    component: ClientPage,
    validateSearch: (s: Record<string, unknown>): { tab?: string } => ({
      tab: str(s.tab),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/research/domain",
    component: DomainResearchPage,
    validateSearch: (
      s: Record<string, unknown>,
    ): { d?: string; c?: string } => ({ d: str(s.d), c: str(s.c) }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/research/keywords",
    component: KeywordResearchPage,
    validateSearch: (
      s: Record<string, unknown>,
    ): { k?: string; c?: string } => ({ k: str(s.k), c: str(s.c) }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/research/backlinks",
    component: BacklinksPage,
    validateSearch: (s: Record<string, unknown>): { d?: string } => ({
      d: str(s.d),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/research/bulk",
    component: BulkAnalysisPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/bots",
    component: BotsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/tasks",
    component: TasksPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/reports",
    component: ReportsPage,
    validateSearch: (
      s: Record<string, unknown>,
    ): { id?: string; type?: string } => ({ id: str(s.id), type: str(s.type) }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: SettingsPage,
    validateSearch: (s: Record<string, unknown>): { tab?: string } => ({
      tab: str(s.tab),
    }),
  }),
];

export const router = createRouter({
  routeTree: rootRoute.addChildren(routes),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
