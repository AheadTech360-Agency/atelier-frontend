import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ago, agentName } from "@/lib/format";
import { cx, EmptyState, ErrorNote, PageHeader, Panel, PriorityBadge, Skeleton, StatusBadge } from "@/components/ui";
import type { Overview } from "@/api-types/Overview";
import type { HumanRequired } from "@/api-types/HumanRequired";
import type { Run } from "@/api-types/Run";

export function OverviewPage() {
  const { clientScope } = useSession();
  const clientId = clientScope === "all" ? undefined : clientScope;
  const ov = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/overview"), refetchInterval: 60_000 });
  const urgent = useQuery({
    queryKey: ["hr", { overview: true, clientId }],
    queryFn: () => api.get<HumanRequired[]>("/human-required", { status: "open", client_id: clientId, limit: 6 }),
  });
  const runs = useQuery({
    queryKey: ["runs", { overview: true, clientId }],
    queryFn: () => api.get<Run[]>("/runs", { client_id: clientId, limit: 8 }),
    refetchInterval: 60_000,
  });

  if (ov.isLoading) return <Skeleton rows={8} />;
  if (ov.error) return <ErrorNote error={ov.error} />;
  const o = ov.data!;
  const clients = clientId ? o.clients.filter((c) => c.client_id === clientId) : o.clients;

  return (
    <div>
      <PageHeader title="Overview" description="What needs a person today, and how the bots are running." />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[1.3fr_1fr]">
        {/* The queue is the headline: it's the only thing that blocks the bots. */}
        <Panel
          title="Waiting on the team"
          actions={
            <Link to="/inbox" className="text-[13px] text-denim underline underline-offset-2">
              Open inbox
            </Link>
          }
        >
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-line px-4 py-4">
            <p>
              <span className="tabular text-[34px] leading-none font-semibold tracking-[-0.02em]">{o.open_human_required}</span>
              <span className="ml-2 text-ink-2">open items</span>
            </p>
            <div className="flex flex-wrap gap-3 text-[13px] text-ink-2">
              {(["p1", "p2", "p3", "p4"] as const).map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5">
                  <PriorityBadge p={p} />
                  <span className="tabular">{o.open_by_priority[p] ?? 0}</span>
                </span>
              ))}
            </div>
            {o.stale_human_required > 0 ? (
              <Link to="/inbox" search={{ stale: "1" }} className="text-[13px] font-medium text-p2 underline underline-offset-2">
                {o.stale_human_required} open 3+ days
              </Link>
            ) : null}
          </div>
          {urgent.data?.length ? (
            <ul>
              {urgent.data.map((i) => (
                <li key={i.id} className="border-b border-line last:border-0">
                  <Link to="/inbox" search={{ item: i.id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sunken">
                    <PriorityBadge p={i.priority} />
                    <span className="min-w-0 flex-1 truncate">{i.issue}</span>
                    <span className="shrink-0 text-[12.5px] text-ink-3">{agentName(i.agent_id, true)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-ink-2">Nothing waiting. The bots aren't blocked.</p>
          )}
        </Panel>

        <Panel title="Today">
          <dl className="grid grid-cols-2">
            <Stat label="Bot runs" value={o.runs_today} />
            <Stat label="Failed runs" value={o.failed_runs_today} warn={o.failed_runs_today > 0} />
            <Stat label="Tasks in flight" value={o.tasks_in_flight} />
            <Stat label="Critical findings" value={o.open_critical_findings} warn={o.open_critical_findings > 0} />
          </dl>
          <div className="border-t border-line">
            <h3 className="px-4 pt-3 pb-1 text-[13px] font-medium text-ink-2">Latest runs</h3>
            {runs.data?.length ? (
              <ul className="pb-2">
                {runs.data.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-4 py-1.5 text-[13px]">
                    <StatusBadge s={r.status} />
                    <span className="flex-1 truncate">{agentName(r.agent_id)}</span>
                    <span className="text-ink-3">{ago(r.started_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-ink-3">No runs yet. Runs appear once a bot connects over MCP.</p>
            )}
          </div>
        </Panel>

        <Panel title="Clients" className="xl:col-span-2">
          {clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              body="Add a client, connect its accounts, and the bots can start."
              action={
                <Link to="/clients" className="text-denim underline underline-offset-2">
                  Add a client
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="text-[12.5px] text-ink-3">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-medium">Client</th>
                    <th className="px-4 py-2 text-right font-medium">Waiting on team</th>
                    <th className="px-4 py-2 text-right font-medium">Open findings</th>
                    <th className="px-4 py-2 text-right font-medium">Login problems</th>
                    <th className="px-4 py-2 font-medium">Last bot run</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.client_id} className="border-b border-line last:border-0 hover:bg-sunken">
                      <td className="px-4 py-2.5">
                        <Link to="/clients/$clientId" params={{ clientId: c.client_id }} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        <span className="ml-2 text-[12.5px] text-ink-3">{c.domain}</span>
                      </td>
                      <td className="tabular px-4 text-right">{c.open_human_required}</td>
                      <td className="tabular px-4 text-right">{c.open_findings}</td>
                      <td className={cx("tabular px-4 text-right", c.connections_with_problems > 0 && "font-semibold text-p1")}>
                        {c.connections_with_problems}
                      </td>
                      <td className="px-4 text-ink-2">{ago(c.last_run_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="border-line px-4 py-3 odd:border-r [&:nth-child(-n+2)]:border-b">
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className={cx("tabular text-[22px] font-semibold", warn && "text-p1")}>{value}</dd>
    </div>
  );
}
