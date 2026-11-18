import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { ErrorNote, Panel, Select, Skeleton } from "../ui";
import { Gauge, StatCard, StatGrid, change, num, pct, pos, usd } from "../seo";
import { TargetKeywordsPanel } from "./TargetKeywordsPanel";
import { ClientOverviewTab } from "./OverviewTab";
import { GscTable } from "./TrafficTab";
import { AiVisibilityCard, GrowthSection, SummaryCard } from "./GrowthPanels";
import { PageSpeedPanel } from "./PageSpeedPanel";
import type { ClientKpis } from "@/api-types/ClientKpis";

export const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 28, label: "Last 28 days" },
  { days: 90, label: "Last 3 months" },
];

/** The client's SEO at a glance, the way an SEO tool's project dashboard shows it. */
export function DashboardTab({ clientId, domain }: { clientId: string; domain: string }) {
  const [days, setDays] = useState(28);
  const k = useQuery({ queryKey: ["kpis", clientId, days], queryFn: () => api.get<ClientKpis>(`/clients/${clientId}/kpis`, { days }) });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-2">
          Google Search Console and Analytics for <span className="font-medium text-ink">{domain}</span>, compared with the {days} days before.
        </p>
        <Select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-auto">
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      {k.isLoading ? (
        <Skeleton rows={4} />
      ) : k.error ? (
        <ErrorNote error={k.error} />
      ) : k.data ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SummaryCard clientId={clientId} k={k.data} />
            <AiVisibilityCard clientId={clientId} />
          </div>
          <StatGrid cols={6}>
            <StatCard label="Organic clicks" value={num(k.data.clicks.current)} delta={change(k.data.clicks)} tone="accent" />
            <StatCard label="Impressions" value={num(k.data.impressions.current)} delta={change(k.data.impressions)} />
            <StatCard label="Avg. position" value={pos(k.data.position.current)} delta={change(k.data.position)} invert hint="Lower is better" />
            <StatCard label="Click-through rate" value={pct(k.data.ctr.current)} delta={change(k.data.ctr)} />
            <StatCard label="Organic sessions" value={num(k.data.organic_sessions.current)} delta={change(k.data.organic_sessions)} hint="Google Analytics" />
            <StatCard
              label="Conversions"
              value={num(k.data.conversions.current)}
              delta={change(k.data.conversions)}
              hint={k.data.revenue.current ? `${usd(k.data.revenue.current)} revenue` : "Google Analytics"}
            />
          </StatGrid>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Clicks and impressions">
              {k.data.daily.length ? (
                <div className="h-64 px-2 pb-3">
                  <ResponsiveContainer>
                    <ComposedChart data={k.data.daily} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--color-line)" vertical={false} />
                      <XAxis dataKey="day" tickFormatter={dateLabel} tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis yAxisId="c" tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} width={40} />
                      <YAxis yAxisId="i" orientation="right" tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => num(v)} />
                      <Tooltip
                        labelFormatter={(d) => dateLabel(String(d))}
                        formatter={(v, n) => [num(Number(v), false), n === "clicks" ? "Clicks" : "Impressions"]}
                        contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 13 }}
                      />
                      <Area yAxisId="i" type="monotone" dataKey="impressions" stroke="#b7c6cb" fill="var(--color-sunken)" strokeWidth={1.5} />
                      <Line yAxisId="c" type="monotone" dataKey="clicks" stroke="var(--color-denim)" strokeWidth={2.2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-ink-3">
                  No Search Console data yet. The SEO Lead saves it every morning once Search Console is connected in Rakazo.
                </p>
              )}
            </Panel>

            <div className="grid gap-4">
              <Panel title="Site health">
                <div className="flex items-center gap-4 p-4">
                  <Gauge value={k.data.health.open + k.data.health.fixed > 0 ? k.data.health.score : null} size={120} />
                  <ul className="flex-1 space-y-1 text-[13px]">
                    <li className="flex justify-between"><span className="text-p1">Critical</span><span className="tabular-nums">{k.data.health.critical}</span></li>
                    <li className="flex justify-between"><span className="text-p2">High</span><span className="tabular-nums">{k.data.health.high}</span></li>
                    <li className="flex justify-between"><span className="text-ink-2">Medium</span><span className="tabular-nums">{k.data.health.medium}</span></li>
                    <li className="flex justify-between"><span className="text-ink-3">Low</span><span className="tabular-nums">{k.data.health.low}</span></li>
                    <li>
                      <Link to="/clients/$clientId" params={{ clientId }} search={{ tab: "findings" }} className="text-denim hover:underline">
                        See the site audit
                      </Link>
                    </li>
                  </ul>
                </div>
              </Panel>
              <Panel title="Keywords and competitors">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
                  <div>
                    <dt className="text-ink-3">Target keywords</dt>
                    <dd className="text-[20px] font-semibold tabular-nums">{k.data.keywords_approved + k.data.keywords_suggested}</dd>
                    <dd className="text-[12px] text-ink-3">{k.data.keywords_suggested} to review</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Competitors</dt>
                    <dd className="text-[20px] font-semibold tabular-nums">{k.data.competitors}</dd>
                    <dd className="text-[12px] text-ink-3">{num(k.data.competitor_keywords)} of their keywords</dd>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-3">
                    <Link to="/clients/$clientId" params={{ clientId }} search={{ tab: "keywords" }} className="text-denim hover:underline">Keywords</Link>
                    <Link to="/clients/$clientId" params={{ clientId }} search={{ tab: "competitors" }} className="text-denim hover:underline">Competitors</Link>
                    <Link to="/research/domain" search={{ d: domain }} className="text-denim hover:underline">Research {domain}</Link>
                  </div>
                </dl>
              </Panel>
            </div>
          </div>
        </>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <GscTable clientId={clientId} kind="queries" days={days} limit={10} title="Top searches" />
        <GscTable clientId={clientId} kind="pages" days={days} limit={10} title="Top pages" />
      </div>

      <PageSpeedPanel clientId={clientId} />
      <GrowthSection clientId={clientId} domain={domain} />
      <TargetKeywordsPanel clientId={clientId} />
      <ClientOverviewTab clientId={clientId} />
    </div>
  );
}
