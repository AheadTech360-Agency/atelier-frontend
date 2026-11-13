import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { agentName, ago, dateLabel, humanize } from "@/lib/format";
import { EmptyState, Panel, Select, Skeleton, StatusBadge } from "../ui";
import type { MetricName } from "@/api-types/MetricName";
import type { MetricPoint } from "@/api-types/MetricPoint";
import type { Report } from "@/api-types/Report";
import type { Run } from "@/api-types/Run";

// Lower is better for these, so the axis is flipped.
const INVERTED = new Set(["position", "map_pack_rank", "lcp", "cls", "inp"]);

export function ClientOverviewTab({ clientId }: { clientId: string }) {
  const names = useQuery({ queryKey: ["metric-names", clientId], queryFn: () => api.get<MetricName[]>(`/clients/${clientId}/metric-names`) });
  const [pick, setPick] = useState<string>("");
  const selected = pick || (names.data?.[0] ? `${names.data[0].source}|${names.data[0].metric}` : "");
  const [source, metric] = selected.split("|");

  const points = useQuery({
    queryKey: ["metrics", clientId, selected],
    queryFn: () => api.get<MetricPoint[]>("/metrics", { client_id: clientId, source, metric }),
    enabled: !!selected,
  });
  const reports = useQuery({ queryKey: ["reports", clientId, "recent"], queryFn: () => api.get<Report[]>("/reports", { client_id: clientId, limit: 5 }) });
  const runs = useQuery({ queryKey: ["runs", clientId], queryFn: () => api.get<Run[]>("/runs", { client_id: clientId, limit: 8 }) });

  // Sum across dimensions per day for the headline trend.
  const series = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of points.data ?? []) byDay.set(p.observed_on, (byDay.get(p.observed_on) ?? 0) + p.value);
    const avg = metric === "position" || metric === "ctr" || INVERTED.has(metric ?? "");
    const counts = new Map<string, number>();
    if (avg) for (const p of points.data ?? []) counts.set(p.observed_on, (counts.get(p.observed_on) ?? 0) + 1);
    return [...byDay.entries()].map(([d, v]) => ({ day: d, value: avg ? v / (counts.get(d) ?? 1) : v }));
  }, [points.data, metric]);

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Panel
        title="Trend"
        actions={
          names.data?.length ? (
            <Select aria-label="Metric" value={selected} onChange={(e) => setPick(e.target.value)} className="h-8 w-auto">
              {names.data.map((n) => (
                <option key={`${n.source}|${n.metric}`} value={`${n.source}|${n.metric}`}>
                  {n.source.toUpperCase()} {humanize(n.metric).toLowerCase()}
                </option>
              ))}
            </Select>
          ) : null
        }
      >
        {names.isLoading || points.isLoading ? (
          <Skeleton rows={5} />
        ) : !names.data?.length ? (
          <EmptyState title="No metrics yet" body="Rankings, Search Console traffic, Core Web Vitals and AI citation share appear here once the bots record them." />
        ) : (
          <div className="h-72 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: 4, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="day" tickFormatter={dateLabel} tick={{ fill: "var(--color-ink-3)", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis reversed={INVERTED.has(metric ?? "")} tick={{ fill: "var(--color-ink-3)", fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  labelFormatter={(d) => dateLabel(String(d))}
                  formatter={(v) => [Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }), humanize(metric)]}
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 13 }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--color-denim)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title="Latest reports">
          {reports.data?.length ? (
            <ul className="divide-y divide-line">
              {reports.data.map((r) => (
                <li key={r.id}>
                  <Link to="/reports" search={{ id: r.id }} className="block px-4 py-2.5 hover:bg-sunken">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="text-[12.5px] text-ink-3">
                      {humanize(r.report_type)} from {agentName(r.agent_id, true)}, {ago(r.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-ink-3">No reports yet. The SEO Lead sends a weekly summary.</p>
          )}
        </Panel>
        <Panel title="Recent bot runs">
          {runs.data?.length ? (
            <ul className="py-1">
              {runs.data.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-4 py-1.5 text-[13px]">
                  <StatusBadge s={r.status} />
                  <span className="min-w-0 flex-1 truncate" title={r.summary}>
                    {agentName(r.agent_id, true)}
                    {r.summary ? `: ${r.summary}` : ""}
                  </span>
                  <span className="shrink-0 text-ink-3">{ago(r.started_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-ink-3">No runs for this client yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
