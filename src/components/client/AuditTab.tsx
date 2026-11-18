import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { humanize } from "@/lib/format";
import { Badge, ErrorNote, Panel, Skeleton, cx } from "../ui";
import { Gauge, StatCard, StatGrid } from "../seo";
import { FindingsTab } from "./WorkTabs";
import { PageSpeedPanel } from "./PageSpeedPanel";
import type { AuditSummary } from "@/api-types/AuditSummary";

const SEV_TONE: Record<string, "p1" | "p2" | "p3" | "p4" | "neutral"> = { critical: "p1", high: "p2", medium: "p3", low: "p4", info: "neutral" };

/** Like an SEO tool's site audit: a health score, issues grouped by type, then every finding. */
export function AuditTab({ clientId }: { clientId: string }) {
  const [type, setType] = useState("");
  const a = useQuery({ queryKey: ["audit", clientId], queryFn: () => api.get<AuditSummary>(`/clients/${clientId}/audit-summary`) });
  return (
    <div className="flex flex-col gap-6">
      {a.isLoading ? (
        <Skeleton rows={4} />
      ) : a.error ? (
        <ErrorNote error={a.error} />
      ) : a.data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-surface p-4">
              <Gauge value={a.data.open + a.data.fixed > 0 ? a.data.score : null} label="Site health" />
            </div>
            <StatGrid cols={5}>
              <StatCard label="Critical" value={a.data.critical} hint="Fix first" />
              <StatCard label="High" value={a.data.high} />
              <StatCard label="Medium" value={a.data.medium} />
              <StatCard label="Low" value={a.data.low} />
              <StatCard label="Fixed" value={a.data.fixed} hint="Since tracking began" />
            </StatGrid>
          </div>
          <Panel title="Issues by type">
            {a.data.by_type.length ? (
              <ul className="divide-y divide-line">
                {a.data.by_type.map((g) => (
                  <li key={g.finding_type}>
                    <button
                      type="button"
                      onClick={() => setType(type === g.finding_type ? "" : g.finding_type)}
                      className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken", type === g.finding_type && "bg-active")}
                    >
                      <Badge tone={SEV_TONE[g.severity]}>{humanize(g.severity)}</Badge>
                      <span className="flex-1 font-medium">{humanize(g.finding_type)}</span>
                      <span className="tabular-nums text-ink-2">
                        {g.count} {g.count === 1 ? "page" : "pages"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">
                No open issues. The Technical Auditor crawls the site every Monday.
              </p>
            )}
          </Panel>
        </>
      ) : null}
      <PageSpeedPanel clientId={clientId} />
      <FindingsTab clientId={clientId} findingType={type} />
    </div>
  );
}
