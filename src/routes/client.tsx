import { useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, ErrorNote, PageHeader, Skeleton, StatusBadge, Tabs } from "@/components/ui";
import { ClientDialog } from "./clients";
import { ClientOverviewTab } from "@/components/client/OverviewTab";
import { ConnectionsTab } from "@/components/client/ConnectionsTab";
import { TargetsTab } from "@/components/client/TargetsTab";
import { AssetsTab } from "@/components/client/AssetsTab";
import { BrandTab } from "@/components/client/BrandTab";
import { BotsTab } from "@/components/client/BotsTab";
import { ContentTab, FindingsTab, OutreachTab } from "@/components/client/WorkTabs";
import type { Client } from "@/api-types/Client";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "connections", label: "Logins & APIs" },
  { id: "targets", label: "Sites" },
  { id: "assets", label: "Images" },
  { id: "brand", label: "Brand & claims" },
  { id: "bots", label: "Bots" },
  { id: "findings", label: "Findings" },
  { id: "content", label: "Content" },
  { id: "outreach", label: "Outreach" },
];

export function ClientPage() {
  const { clientId } = useParams({ from: "/clients/$clientId" });
  const { tab = "overview" } = useSearch({ from: "/clients/$clientId" });
  const navigate = useNavigate({ from: "/clients/$clientId" });
  const { isAdmin } = useSession();
  const [editing, setEditing] = useState(false);
  const client = useQuery({ queryKey: ["client", clientId], queryFn: () => api.get<Client>(`/clients/${clientId}`) });

  if (client.isLoading) return <Skeleton rows={6} />;
  if (client.error) return <ErrorNote error={client.error} />;
  const c = client.data!;

  return (
    <div>
      <PageHeader
        title={c.name}
        description={
          <span className="inline-flex items-center gap-2">
            <a href={`https://${c.domain}`} target="_blank" rel="noreferrer noopener" className="hover:underline">
              {c.domain}
            </a>
            <StatusBadge s={c.status} />
          </span>
        }
        actions={isAdmin ? <Button onClick={() => setEditing(true)}>Edit client</Button> : null}
      />
      <Tabs tabs={TABS} value={tab} onChange={(t) => navigate({ search: { tab: t } })} />
      <div className="p-4 md:p-6">
        {tab === "overview" && <ClientOverviewTab clientId={clientId} />}
        {tab === "connections" && <ConnectionsTab clientId={clientId} />}
        {tab === "targets" && <TargetsTab clientId={clientId} />}
        {tab === "assets" && <AssetsTab clientId={clientId} />}
        {tab === "brand" && <BrandTab clientId={clientId} />}
        {tab === "bots" && <BotsTab clientId={clientId} />}
        {tab === "findings" && <FindingsTab clientId={clientId} />}
        {tab === "content" && <ContentTab clientId={clientId} />}
        {tab === "outreach" && <OutreachTab clientId={clientId} />}
      </div>
      {editing ? <ClientDialog open onClose={() => setEditing(false)} client={c} /> : null}
    </div>
  );
}
