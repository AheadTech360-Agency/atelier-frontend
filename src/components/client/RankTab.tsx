import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { ErrorNote, Panel, PriorityBadge, Skeleton } from "../ui";
import { SortTh, StatCard, StatGrid, num, pos, sortRows } from "../seo";
import type { Rankings } from "@/api-types/Rankings";
import type { RankedTarget } from "@/api-types/RankedTarget";

const bucket = (p: number | null | undefined) => (p == null ? "none" : p <= 3 ? "top3" : p <= 10 ? "top10" : p <= 100 ? "top100" : "none");

function Move({ now, before }: { now: number | null; before: number | null }) {
  if (now == null || before == null) return <span className="text-ink-3">–</span>;
  const d = before - now; // positive = moved up
  if (Math.abs(d) < 0.5) return <span className="text-ink-3">0</span>;
  const up = d > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={up ? "inline-flex items-center gap-0.5 text-ok" : "inline-flex items-center gap-0.5 text-p1"}>
      <Icon size={13} aria-hidden />
      {Math.abs(d).toFixed(1)}
    </span>
  );
}

/** Where each target keyword ranks on Google, from Search Console. No extra cost. */
export function RankTab({ clientId }: { clientId: string }) {
  const [sort, setSort] = useState({ key: "position", desc: false });
  const q = useQuery({ queryKey: ["rankings", clientId], queryFn: () => api.get<Rankings>(`/clients/${clientId}/rankings`) });
  if (q.isLoading) return <Skeleton rows={6} />;
  if (q.error) return <ErrorNote error={q.error} />;
  const r = q.data!;
  const count = (key: keyof RankedTarget, b: string) => r.keywords.filter((k) => bucket(k[key] as number | null) === b).length;
  const tile = (label: string, b: string, hint: string) => {
    const now = count("position", b);
    const before = count("previous", b);
    return <StatCard label={label} value={now} hint={`${now - before >= 0 ? "+" : ""}${now - before} vs the week before. ${hint}`} />;
  };

  return (
    <div className="flex flex-col gap-6">
      <StatGrid cols={4}>
        {tile("Top 3", "top3", "")}
        {tile("Top 10", "top10", "Page one.")}
        {tile("Top 100", "top100", "")}
        <StatCard label="Not ranked yet" value={count("position", "none")} hint={`Of ${r.keywords.length} target keywords`} />
      </StatGrid>

      <Panel title="Ranking keywords by week">
        {r.weeks.length ? (
          <div className="h-56 px-2 pb-3">
            <ResponsiveContainer>
              <BarChart data={r.weeks} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="week" tickFormatter={dateLabel} tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  labelFormatter={(d) => `Week of ${dateLabel(String(d))}`}
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 13 }}
                />
                <Bar dataKey="top3" name="Top 3" stackId="a" fill="#1b6c80" />
                <Bar dataKey="top10" name="4 to 10" stackId="a" fill="#7bbccb" />
                <Bar dataKey="top100" name="11 to 100" stackId="a" fill="#d6a21e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-[13px] text-ink-3">
            Positions appear once the SEO Lead has saved Search Console data for the target keywords (it does so every morning).
          </p>
        )}
      </Panel>

      <Panel title="Target keywords on Google">
        {r.keywords.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead className="text-[12.5px] text-ink-3">
                <tr className="border-b border-line">
                  <SortTh label="Keyword" k="keyword" sort={sort} setSort={setSort} />
                  <SortTh label="Position" k="position" sort={sort} setSort={setSort} right />
                  <th className="px-3 py-2 text-right font-medium">Change</th>
                  <SortTh label="Best" k="best" sort={sort} setSort={setSort} right />
                  <SortTh label="Clicks (28d)" k="clicks" sort={sort} setSort={setSort} right />
                  <SortTh label="Impressions" k="impressions" sort={sort} setSort={setSort} right />
                  <SortTh label="Volume" k="search_volume" sort={sort} setSort={setSort} right />
                  <th className="px-3 py-2 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sortRows(r.keywords, sort).map((k) => (
                  <tr key={k.id}>
                    <td className="px-3 py-2 font-medium">
                      <Link to="/research/keywords" search={{ k: k.keyword }} className="hover:underline">{k.keyword}</Link>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{k.position == null ? <span className="font-normal text-ink-3">Not ranked</span> : pos(k.position)}</td>
                    <td className="px-3 py-2 text-right tabular-nums"><Move now={k.position} before={k.previous} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{pos(k.best)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(k.clicks)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(k.impressions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(k.search_volume)}</td>
                    <td className="px-3 py-2"><PriorityBadge p={k.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-[13px] text-ink-3">No target keywords yet. Add some under Keywords, or let the SEO Lead suggest them.</p>
        )}
        <p className="px-4 py-3 text-[12px] text-ink-3">
          From Google Search Console: the average position over the last week of data, compared with the week before. Search Console runs two or three
          days behind.
        </p>
      </Panel>
    </div>
  );
}
