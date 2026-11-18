import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { ErrorNote, Panel, Skeleton } from "../ui";
import { ConnectDataForSeo, change, num, pct, pos, useResearchStatus } from "../seo";
import type { ClientKpis } from "@/api-types/ClientKpis";
import type { GscRow } from "@/api-types/GscRow";
import type { AiEngine } from "@/api-types/AiEngine";
import type { DomainTrends } from "@/api-types/DomainTrends";
import type { TrafficSeries } from "@/api-types/TrafficSeries";
import type { Competitor } from "@/api-types/Competitor";

const AXIS = { fontSize: 11, fill: "var(--color-ink-3)" };
const TIP = { background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 13 };
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
};
const LINE_COLORS = ["var(--color-denim)", "#d6a21e", "#c0567a", "#7a8c3c"];
const ENGINE: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", ai_overviews: "AI Overviews", ai_mode: "AI Mode", perplexity: "Perplexity" };

/** A few plain sentences about how the client is doing, written from the numbers (no AI). */
export function SummaryCard({ clientId, k }: { clientId: string; k: ClientKpis }) {
  const gsc = useQuery({ queryKey: ["gsc", clientId, "queries", 28, ""], queryFn: () => api.get<GscRow[]>(`/clients/${clientId}/gsc`, { kind: "queries", days: 28 }) });
  const lines: string[] = [];
  const c = change(k.clicks);
  if (k.clicks.current != null) {
    lines.push(
      c == null
        ? `${num(k.clicks.current, false)} organic clicks in the last ${k.days} days.`
        : `Organic clicks are ${c >= 0 ? "up" : "down"} ${Math.abs(c * 100).toFixed(0)}% to ${num(k.clicks.current, false)} over the last ${k.days} days.`,
    );
  } else {
    lines.push("No Search Console data yet: the SEO Lead saves it every morning once Search Console is connected.");
  }
  if (k.position.current != null && k.position.previous != null) {
    const better = k.position.current < k.position.previous;
    lines.push(`Average position ${better ? "improved" : "slipped"} from ${pos(k.position.previous)} to ${pos(k.position.current)}.`);
  }
  if (k.health.open + k.health.fixed > 0) {
    const urgent = k.health.critical + k.health.high;
    lines.push(`Site health is ${k.health.score}${urgent ? `, with ${urgent} high-priority ${urgent === 1 ? "issue" : "issues"} to fix` : ""}.`);
  }
  const win = (gsc.data ?? [])
    .filter((r) => r.position != null && r.position >= 4 && r.position <= 20 && (r.impressions ?? 0) > 0)
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))[0];
  if (win) lines.push(`Best quick win: "${win.dimension}" sits at position ${pos(win.position)} with ${num(win.impressions)} impressions.`);
  if (k.keywords_suggested) lines.push(`${k.keywords_suggested} suggested target ${k.keywords_suggested === 1 ? "keyword is" : "keywords are"} waiting for review.`);
  return (
    <Panel title="Summary">
      <p className="px-4 pt-3 pb-1 text-[14.5px] leading-relaxed">{lines.join(" ")}</p>
      <div className="flex flex-wrap gap-3 px-4 pb-3 text-[13px]">
        <Link to="/clients/$clientId" params={{ clientId }} search={{ tab: "actions" }} className="text-denim hover:underline">
          See next actions
        </Link>
        <Link to="/clients/$clientId" params={{ clientId }} search={{ tab: "rankings" }} className="text-denim hover:underline">
          Rank tracking
        </Link>
      </div>
    </Panel>
  );
}

/** How often AI answers cite the client, from the AI Search bot's weekly checks. */
export function AiVisibilityCard({ clientId }: { clientId: string }) {
  const q = useQuery({ queryKey: ["ai-visibility", clientId], queryFn: () => api.get<AiEngine[]>(`/clients/${clientId}/ai-visibility`) });
  const rows = q.data ?? [];
  const shares = rows.map((r) => r.citation_share).filter((v): v is number => v != null);
  const avg = shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null;
  return (
    <Panel title="AI search visibility">
      {q.isLoading ? (
        <Skeleton rows={2} />
      ) : !rows.length ? (
        <p className="px-4 py-4 text-[13px] text-ink-3">No AI checks yet. The AI Search Optimizer measures this every Wednesday.</p>
      ) : (
        <div className="p-4">
          <p className="text-[12.5px] text-ink-3">Cited in AI answers, on average</p>
          <p className="text-[26px] leading-tight font-semibold tabular-nums">{pct(avg, 0)}</p>
          <ul className="mt-2 space-y-1 text-[13px]">
            {rows.map((r) => (
              <li key={r.engine} className="flex justify-between gap-2">
                <span>{ENGINE[r.engine] ?? r.engine}</span>
                <span className="tabular-nums text-ink-2">
                  {pct(r.citation_share, 0)} cited{r.mentions != null ? `, ${num(r.mentions)} mentions` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** Like an SEO tool's "monitor progress": positions, traffic against competitors, backlinks and authority over a year. */
export function GrowthSection({ clientId, domain }: { clientId: string; domain: string }) {
  const status = useResearchStatus();
  const on = !!status.data?.configured;
  const comps = useQuery({
    queryKey: ["competitors", clientId, false],
    queryFn: () => api.get<Competitor[]>(`/clients/${clientId}/competitors`, { include_ignored: false }),
  });
  const rivals = (comps.data ?? []).slice(0, 3).map((c) => c.domain);
  const trends = useQuery({
    queryKey: ["research", "trends", domain],
    queryFn: () => api.get<DomainTrends>("/research/trends", { target: domain }),
    enabled: on,
    staleTime: 3_600_000,
    retry: false,
  });
  const targets = [domain, ...rivals].join(",");
  const compare = useQuery({
    queryKey: ["research", "compare", targets],
    queryFn: () => api.get<TrafficSeries[]>("/research/compare", { targets }),
    enabled: on && comps.isSuccess,
    staleTime: 3_600_000,
    retry: false,
  });

  if (status.isLoading) return null;
  if (!on)
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">Growth over time</h2>
        <ConnectDataForSeo />
      </div>
    );

  // One row per month, one column per domain, for the comparison chart.
  const months = [...new Set((compare.data ?? []).flatMap((s) => s.history.map((h) => h.month)))].sort();
  const traffic = months.map((m) => {
    const row: Record<string, string | number | null> = { month: m };
    for (const s of compare.data ?? []) row[s.domain] = s.history.find((h) => h.month === m)?.traffic ?? null;
    return row;
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold">Growth over time</h2>
      {trends.error ? <ErrorNote error={trends.error} /> : null}
      {trends.data?.errors.length ? (
        <p className="rounded-lg border border-p2/30 bg-p2-soft px-4 py-2 text-[13px] text-p2">Some data didn't load: {trends.data.errors.join(" · ")}</p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Organic keywords by position">
          {trends.isLoading ? (
            <Skeleton rows={4} />
          ) : trends.data?.organic.length ? (
            <div className="h-60 px-2 pb-3">
              <ResponsiveContainer>
                <AreaChart data={trends.data.organic} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => num(v)} />
                  <Tooltip labelFormatter={(m) => monthLabel(String(m))} contentStyle={TIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area dataKey="pos_1_3" name="1 to 3" stackId="p" stroke="#1b6c80" fill="#1b6c80" />
                  <Area dataKey="pos_4_10" name="4 to 10" stackId="p" stroke="#7bbccb" fill="#7bbccb" />
                  <Area dataKey="pos_11_50" name="11 to 50" stackId="p" stroke="#d6a21e" fill="#f0d79a" />
                  <Area dataKey="pos_51_100" name="51 to 100" stackId="p" stroke="#cdced1" fill="#e8eaec" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">No ranking history for {domain}.</p>
          )}
        </Panel>
        <Panel title="Estimated organic traffic, you and competitors">
          {compare.isLoading || comps.isLoading ? (
            <Skeleton rows={4} />
          ) : compare.error ? (
            <ErrorNote error={compare.error} />
          ) : traffic.length ? (
            <div className="h-60 px-2 pb-3">
              <ResponsiveContainer>
                <LineChart data={traffic} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => num(v)} />
                  <Tooltip labelFormatter={(m) => monthLabel(String(m))} formatter={(v) => num(Number(v), false)} contentStyle={TIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(compare.data ?? []).map((s, i) => (
                    <Line key={s.domain} dataKey={s.domain} name={i === 0 ? `${s.domain} (you)` : s.domain} stroke={LINE_COLORS[i]} strokeWidth={i === 0 ? 2.5 : 1.5} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">
              No traffic history yet. Add competitors under Competitors to compare.
            </p>
          )}
        </Panel>
        <Panel title="Backlinks and referring domains">
          {trends.isLoading ? (
            <Skeleton rows={4} />
          ) : trends.data?.links.length ? (
            <div className="h-60 px-2 pb-3">
              <ResponsiveContainer>
                <LineChart data={trends.data.links} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="b" tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => num(v)} />
                  <YAxis yAxisId="d" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => num(v)} />
                  <Tooltip labelFormatter={(m) => monthLabel(String(m))} formatter={(v) => num(Number(v), false)} contentStyle={TIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="b" dataKey="backlinks" name="Backlinks" stroke="var(--color-denim)" strokeWidth={2} dot={false} />
                  <Line yAxisId="d" dataKey="referring_domains" name="Referring domains" stroke="#d6a21e" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">No backlink history (the Backlinks API needs its own DataForSEO plan).</p>
          )}
        </Panel>
        <Panel title="Domain authority">
          {trends.isLoading ? (
            <Skeleton rows={4} />
          ) : trends.data?.links.some((l) => l.rank != null) ? (
            <div className="h-60 px-2 pb-3">
              <ResponsiveContainer>
                <LineChart data={trends.data.links} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
                  <Tooltip labelFormatter={(m) => monthLabel(String(m))} formatter={(v) => [num(Number(v), false), "Domain rank (0 to 1000)"]} contentStyle={TIP} />
                  <Line dataKey="rank" name="Domain rank" stroke="var(--color-denim)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">No authority history (comes with the DataForSEO Backlinks API).</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
