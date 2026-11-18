import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  Button,
  cx,
  ErrorNote,
  PageHeader,
  Skeleton,
  StatusBadge,
  Tabs,
} from "@/components/ui";
import { usePageTitle } from "@/lib/title";
import { ClientDialog } from "./clients";
import { DeleteButton } from "@/components/DeleteButton";
import { ConnectionsTab } from "@/components/client/ConnectionsTab";
import { TargetsTab } from "@/components/client/TargetsTab";
import { AssetsTab } from "@/components/client/AssetsTab";
import { BrandTab } from "@/components/client/BrandTab";
import { BotsTab } from "@/components/client/BotsTab";
import { ContentTab, OutreachTab } from "@/components/client/WorkTabs";
import { CodeTab } from "@/components/client/CodeTab";
import { CompetitorsTab, KeywordsTab } from "@/components/client/KeywordsTab";
import { DashboardTab } from "@/components/client/DashboardTab";
import { TrafficTab } from "@/components/client/TrafficTab";
import { AuditTab } from "@/components/client/AuditTab";
import { ActionsTab } from "@/components/client/ActionsTab";
import type { Client } from "@/api-types/Client";

// Daily work up front. Setup is done once per client, so it sits under one tab.
// The same sections as the workspace sidebar; shown as tabs on phones, where the sidebar is a menu.
const TABS = [
  { id: "overview", label: "Dashboard" },
  { id: "actions", label: "Next actions" },
  { id: "traffic", label: "Traffic" },
  { id: "keywords", label: "Keywords" },
  { id: "competitors", label: "Competitors" },
  { id: "findings", label: "Site audit" },
  { id: "content", label: "Content" },
  { id: "outreach", label: "Outreach" },
  { id: "setup", label: "Setup" },
];

const SETUP = [
  {
    id: "bots",
    label: "Bots",
    hint: "Which bots work for this client, and how much they can do alone",
  },
  {
    id: "connections",
    label: "Logins & APIs",
    hint: "Accounts the bots sign in to",
  },
  {
    id: "code",
    label: "Code & CMS",
    hint: "Sanity and GitHub, so bots can change the site after approval",
  },
  {
    id: "targets",
    label: "Sites",
    hint: "Sites to post on, watch or compare against",
  },
  {
    id: "assets",
    label: "Images",
    hint: "Photos and graphics the bots may use",
  },
  {
    id: "brand",
    label: "Brand & claims",
    hint: "Voice, approved claims and what can go live without asking",
  },
];

export function ClientPage() {
  const { clientId } = useParams({ from: "/clients/$clientId" });
  const { tab = "overview" } = useSearch({ from: "/clients/$clientId" });
  const navigate = useNavigate({ from: "/clients/$clientId" });
  const { isAdmin, clientScope, setClientScope } = useSession();
  const [editing, setEditing] = useState(false);
  const client = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => api.get<Client>(`/clients/${clientId}`),
  });
  // Opening a client makes it the current workspace, so the sidebar and other pages follow it.
  useEffect(() => {
    if (clientScope !== clientId) setClientScope(clientId);
  }, [clientId, clientScope, setClientScope]);
  usePageTitle(client.data?.name);
  const section = SETUP.find((x) => x.id === tab);
  const top = tab === "setup" || section ? "setup" : tab;
  const setup = section?.id ?? "bots";

  if (client.isLoading) return <Skeleton rows={6} />;
  if (client.error) return <ErrorNote error={client.error} />;
  const c = client.data!;

  return (
    <div>
      <PageHeader
        title={c.name}
        description={
          <span className="inline-flex items-center gap-2">
            <a
              href={`https://${c.domain}`}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:underline"
            >
              {c.domain}
            </a>
            <StatusBadge s={c.status} />
          </span>
        }
        actions={
          isAdmin ? (
            <>
              <Button onClick={() => setEditing(true)}>Edit client</Button>
              <DeleteButton
                labelled
                path={`/clients/${c.id}`}
                thing="client"
                name={c.name}
                typeToConfirm={c.name}
                consequence="Everything for this client goes with it: logins and their saved passwords, sites, images, rules, bot settings, inbox items, tasks, findings, metrics, content, outreach and reports. This can't be undone."
                invalidate={[
                  "clients",
                  "overview",
                  "hr",
                  "tasks",
                  "reports",
                  "agents",
                ]}
                onDeleted={() => {
                  if (clientScope === c.id) setClientScope("all");
                  navigate({ to: "/clients" });
                }}
              />
            </>
          ) : null
        }
      />
      <div className="md:hidden">
        <Tabs
          tabs={TABS}
          value={top}
          onChange={(t) => navigate({ search: { tab: t } })}
        />
      </div>
      <div className="p-4 md:p-6">
        {top === "overview" && (
          <DashboardTab clientId={clientId} domain={c.domain} />
        )}
        {top === "actions" && <ActionsTab clientId={clientId} />}
        {top === "traffic" && <TrafficTab clientId={clientId} />}
        {top === "competitors" && <CompetitorsTab clientId={clientId} />}
        {top === "findings" && <AuditTab clientId={clientId} />}
        {top === "keywords" && <KeywordsTab clientId={clientId} />}
        {top === "content" && <ContentTab clientId={clientId} />}
        {top === "outreach" && <OutreachTab clientId={clientId} />}
        {top === "setup" ? (
          <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
            <nav
              aria-label="Setup"
              className="flex gap-1 overflow-x-auto lg:flex-col"
            >
              {SETUP.map((x) => (
                <Link
                  key={x.id}
                  to="/clients/$clientId"
                  params={{ clientId }}
                  search={{ tab: x.id }}
                  aria-current={setup === x.id ? "page" : undefined}
                  className={cx(
                    "flex h-9 shrink-0 items-center rounded-md px-2.5 whitespace-nowrap",
                    setup === x.id
                      ? "bg-active font-medium text-ink"
                      : "text-ink-2 hover:bg-sunken hover:text-ink",
                  )}
                >
                  {x.label}
                </Link>
              ))}
            </nav>
            <div className="min-w-0">
              <p className="mb-4 text-ink-2">
                {SETUP.find((x) => x.id === setup)?.hint}.
              </p>
              {setup === "bots" && <BotsTab clientId={clientId} />}
              {setup === "connections" && (
                <ConnectionsTab clientId={clientId} />
              )}
              {setup === "code" && <CodeTab clientId={clientId} />}
              {setup === "targets" && <TargetsTab clientId={clientId} />}
              {setup === "assets" && <AssetsTab clientId={clientId} />}
              {setup === "brand" && <BrandTab clientId={clientId} />}
            </div>
          </div>
        ) : null}
      </div>
      {editing ? (
        <ClientDialog open onClose={() => setEditing(false)} client={c} />
      ) : null}
    </div>
  );
}
