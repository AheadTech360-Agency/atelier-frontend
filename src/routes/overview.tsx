import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { AGENTS, ago, agentName, plain } from "@/lib/format";
import { usePageTitle } from "@/lib/title";
import { cx, ErrorNote, PageHeader, Panel, PriorityBadge, Skeleton } from "@/components/ui";
import { UsagePanel } from "@/components/UsagePanel";
import type { Overview } from "@/api-types/Overview";
import type { HumanRequired } from "@/api-types/HumanRequired";
import type { Run } from "@/api-types/Run";

// Screen question: what do the bots need from a person right now?
// Grid: 12 columns on one 24px gap. Row 1: queue 7 + today 5. Row 2: the bots' week 7 + clients 5.
export function OverviewPage() {
  usePageTitle("Overview");
  const { clientScope } = useSession();
  const clientId = clientScope === "all" ? undefined : clientScope;
  const ov = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/overview"), refetchInterval: 120_000 });
  const urgent = useQuery({
    queryKey: ["hr", { overview: true, clientId }],
    queryFn: () => api.get<HumanRequired[]>("/human-required", { status: "open", client_id: clientId, limit: 6 }),
  });
  // One week of runs for the week grid. Bounded: at most 200 short rows, cached for five minutes.
  const runs = useQuery({
    queryKey: ["runs", { week: true, clientId }],
    queryFn: () => api.get<Run[]>("/runs", { client_id: clientId, limit: 200 }),
    staleTime: 300_000,
  });

  if (ov.isLoading) return <Skeleton rows={8} />;
  if (ov.error) return <ErrorNote error={ov.error} />;
  const o = ov.data!;
  const clients = clientId ? o.clients.filter((c) => c.client_id === clientId) : o.clients;
  const openHere = clientId ? (clients[0]?.open_human_required ?? 0) : o.open_human_required;
  const failedWeek = (runs.data ?? []).filter((r) => r.status === "failed" && Date.now() - Date.parse(r.started_at) < 7 * 86400_000).length;

  const finding =
    openHere === 0
      ? "Nothing is waiting on the team. The bots aren't blocked."
      : [
          `${openHere} ${openHere === 1 ? "item waits" : "items wait"} on the team`,
          o.stale_human_required > 0 ? `${o.stale_human_required} of them for 3 days or more` : "",
          failedWeek > 0 ? `${failedWeek} bot ${failedWeek === 1 ? "run" : "runs"} failed this week` : "",
        ]
          .filter(Boolean)
          .join(", ") + ".";

  return (
    <div>
      <PageHeader
        title="Overview"
        description={finding}
        actions={
          openHere ? (
            <Link to="/inbox" className={primaryLink}>
              Open the inbox
            </Link>
          ) : null
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 px-5 pb-6 md:px-6 xl:grid-cols-12">
        <Panel
          title="Waiting on the team"
          className="min-w-0 xl:col-span-7"
          actions={
            o.stale_human_required > 0 ? (
              <Link to="/inbox" search={{ stale: "1" }} className="text-[13px] font-medium whitespace-nowrap text-p2 underline underline-offset-2">
                {o.stale_human_required} open 3+ days
              </Link>
            ) : null
          }
        >
          {urgent.isLoading ? (
            <Skeleton rows={4} />
          ) : urgent.data?.length ? (
            <ul className="pb-1">
              {urgent.data.map((i) => (
                <li key={i.id}>
                  <Link to="/inbox" search={{ item: i.id }} className="flex h-11 items-center gap-3 px-4 hover:bg-sunken">
                    <PriorityBadge p={i.priority} />
                    <span className="min-w-0 flex-1 truncate">{plain(i.issue)}</span>
                    <span className="shrink-0 text-[13px] text-ink-3">{agentName(i.agent_id, true)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pt-1 pb-4 text-ink-2">Nothing waiting. The bots aren't blocked.</p>
          )}
          {urgent.data?.length && openHere > urgent.data.length ? (
            <Link to="/inbox" className="block px-4 pt-1 pb-3.5 text-[13px] font-medium text-ink-2 hover:text-ink">
              {openHere - urgent.data.length} more in the inbox
            </Link>
          ) : null}
        </Panel>

        <Panel title="Today" className="min-w-0 xl:col-span-5">
          <dl className="grid grid-cols-2">
            <Stat label="Bot runs today" value={o.runs_today} />
            <Stat label="Failed runs today" value={o.failed_runs_today} bad={o.failed_runs_today > 0} />
            <Stat label="Tasks between bots" value={o.tasks_in_flight} />
            <Stat label="Critical findings" value={o.open_critical_findings} bad={o.open_critical_findings > 0} />
          </dl>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 pb-4 text-[13px] text-ink-3">
            <span>By priority</span>
            {(["p1", "p2", "p3", "p4"] as const).map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5">
                <PriorityBadge p={p} />
                <span className="tabular text-ink">{o.open_by_priority[p] ?? 0}</span>
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="The bots' week" className="min-w-0 xl:col-span-7" actions={<WeekLegend />}>
          {runs.isLoading ? <Skeleton rows={4} /> : runs.error ? <ErrorNote error={runs.error} /> : <BotsWeek runs={runs.data ?? []} />}
        </Panel>

        <Panel title={clientId ? "This client" : "Clients"} className="min-w-0 xl:col-span-5">
          {clients.length === 0 ? (
            <p className="px-4 pb-4 text-ink-2">
              No clients yet.{" "}
              <Link to="/clients" className="text-denim underline underline-offset-2">
                Add one
              </Link>{" "}
              and connect its accounts so the bots can start.
            </p>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[12px] text-ink-3">
                <tr>
                  <th className="px-4 py-2 font-normal">Client</th>
                  <th className="px-2 py-2 text-right font-normal">Waiting</th>
                  <th className="px-2 py-2 text-right font-normal">Findings</th>
                  <th className="px-4 py-2 text-right font-normal">Last run</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.client_id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <Link to="/clients/$clientId" params={{ clientId: c.client_id }} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.connections_with_problems > 0 ? (
                        <span className="block text-[12px] text-p1">
                          {c.connections_with_problems} login {c.connections_with_problems === 1 ? "problem" : "problems"}
                        </span>
                      ) : (
                        <span className="block text-[12px] text-ink-3">{c.domain}</span>
                      )}
                    </td>
                    <td className="px-2 text-right">{c.open_human_required}</td>
                    <td className="px-2 text-right">{c.open_findings}</td>
                    <td className="px-4 text-right whitespace-nowrap text-ink-2">{c.last_run_at ? ago(c.last_run_at) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="min-w-0 xl:col-span-12">
          <UsagePanel />
        </div>
      </div>
    </div>
  );
}

const primaryLink = "inline-flex h-8 items-center rounded-md bg-ink px-3 font-medium text-surface hover:bg-ink/85";

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="border-line px-4 py-3 odd:border-r [&:nth-child(-n+2)]:border-b">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className={cx("text-[28px] leading-tight", bad && "text-p1")}>{value}</dd>
    </div>
  );
}

type DayMark = "ok" | "partial" | "failed";
const MARK: Record<DayMark, { label: string; short: string; cls: string }> = {
  ok: { label: "every run finished", short: "Finished", cls: "bg-denim" },
  partial: { label: "a run finished partly", short: "Partly", cls: "bg-[#c98a1b]" },
  failed: { label: "a run failed", short: "Failed", cls: "bg-p1" },
};

function WeekLegend() {
  return (
    <span className="flex flex-wrap items-center gap-x-3 text-[12px] text-ink-3">
      {(Object.keys(MARK) as DayMark[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cx("size-2.5 rounded-[2px]", MARK[k].cls)} />
          {MARK[k].short}
        </span>
      ))}
    </span>
  );
}

/**
 * Seven bots by the last seven days: one mark per day a bot ran, coloured by its worst run that
 * day. A day without a run shows a faint dot, so a silent bot is as easy to spot as a failing one.
 */
function BotsWeek({ runs }: { runs: Run[] }) {
  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) out.push(new Date(today.getTime() - i * 86400_000));
    return out;
  }, []);
  const grid = useMemo(() => {
    const rank: Record<DayMark, number> = { ok: 0, partial: 1, failed: 2 };
    const m = new Map<string, { mark: DayMark; n: number }>();
    for (const r of runs) {
      const d = new Date(r.started_at);
      d.setHours(0, 0, 0, 0);
      const key = `${r.agent_id}|${d.getTime()}`;
      const mark: DayMark = r.status === "failed" ? "failed" : r.status === "partial" ? "partial" : "ok";
      const cur = m.get(key);
      m.set(key, { mark: !cur || rank[mark] > rank[cur.mark] ? mark : cur.mark, n: (cur?.n ?? 0) + 1 });
    }
    return m;
  }, [runs]);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <div className="overflow-x-auto px-4 pb-3">
      <table className="w-full min-w-[440px] text-left">
        <caption className="sr-only">Each bot's runs over the last seven days</caption>
        <thead className="text-[12px] text-ink-3">
          <tr>
            <th className="py-2 pr-3 font-normal">Bot</th>
            {days.map((d, i) => (
              <th key={d.getTime()} className={cx("w-11 py-2 text-center font-normal", i === 6 && "font-medium text-ink")}>
                {i === 6 ? "Today" : fmt(d)}
              </th>
            ))}
            <th className="py-2 pl-3 text-right font-normal">Runs</th>
          </tr>
        </thead>
        <tbody>
          {AGENTS.map((a) => {
            const cells = days.map((d) => grid.get(`${a.id}|${d.getTime()}`));
            const total = cells.reduce((s, c) => s + (c?.n ?? 0), 0);
            return (
              <tr key={a.id} className="border-t border-line">
                <th scope="row" className="py-2 pr-3 font-normal whitespace-nowrap">
                  {a.name}
                </th>
                {cells.map((c, i) => (
                  <td key={i} className="text-center">
                    {c ? (
                      <span
                        role="img"
                        aria-label={`${fmt(days[i])}: ${c.n} ${c.n === 1 ? "run" : "runs"}, ${MARK[c.mark].label}`}
                        title={`${c.n} ${c.n === 1 ? "run" : "runs"}, ${MARK[c.mark].label}`}
                        className={cx("inline-block size-3.5 rounded-[3px] align-middle", MARK[c.mark].cls)}
                      />
                    ) : (
                      <span role="img" aria-label={`${fmt(days[i])}: no run`} className="inline-block size-1 rounded-full bg-line-strong align-middle" />
                    )}
                  </td>
                ))}
                <td className={cx("py-2 pl-3 text-right", total === 0 ? "text-ink-3" : "text-ink")}>{total === 0 ? "None" : total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
