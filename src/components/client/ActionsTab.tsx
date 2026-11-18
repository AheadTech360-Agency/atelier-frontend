import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { agentName, humanize } from "@/lib/format";
import { Badge, ErrorNote, Panel, Skeleton, Tabs, cx } from "../ui";
import { num, pos } from "../seo";
import type { GscRow } from "@/api-types/GscRow";
import type { AuditSummary } from "@/api-types/AuditSummary";
import type { TargetKeyword } from "@/api-types/TargetKeyword";
import type { HumanRequired } from "@/api-types/HumanRequired";

type Level = "High" | "Medium" | "Low";
type Action = {
  key: string;
  kind: "quick" | "gap" | "issue" | "waiting";
  title: string;
  detail: string;
  impact: Level;
  effort: Level;
  score: number;
  link: { to: string; search?: Record<string, string>; params?: Record<string, string>; label: string };
};

const KIND_LABEL: Record<Action["kind"], string> = {
  quick: "Quick win",
  gap: "Keyword gap",
  issue: "Site issue",
  waiting: "Waiting on you",
};
const LEVEL_TONE: Record<Level, "p1" | "p2" | "p4"> = { High: "p1", Medium: "p2", Low: "p4" };
const SEV_WEIGHT: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

/** What to do next for this client, ranked by impact over effort, the way an SEO tool's to-do list works. */
export function ActionsTab({ clientId }: { clientId: string }) {
  const [view, setView] = useState("all");
  const gsc = useQuery({ queryKey: ["gsc", clientId, "queries", 28, ""], queryFn: () => api.get<GscRow[]>(`/clients/${clientId}/gsc`, { kind: "queries", days: 28 }) });
  const audit = useQuery({ queryKey: ["audit", clientId], queryFn: () => api.get<AuditSummary>(`/clients/${clientId}/audit-summary`) });
  const targets = useQuery({
    queryKey: ["target-keywords", clientId, "actions"],
    queryFn: () => api.get<TargetKeyword[]>(`/clients/${clientId}/target-keywords`, { status: "suggested,approved", limit: 200 }),
  });
  const waiting = useQuery({
    queryKey: ["hr", "actions", clientId],
    queryFn: () => api.get<HumanRequired[]>("/human-required", { client_id: clientId, status: "open", limit: 50 }),
  });

  const actions = useMemo<Action[]>(() => {
    const out: Action[] = [];
    // Quick wins: searches already on pages 1 to 3 that a better page could push up.
    for (const r of gsc.data ?? []) {
      if (r.position == null || r.position < 4 || r.position > 30 || !r.impressions) continue;
      const page1 = r.position <= 10;
      out.push({
        key: `q-${r.dimension}`,
        kind: "quick",
        title: page1 ? `Move "${r.dimension}" into the top 3` : `Get "${r.dimension}" onto page one`,
        detail: `Position ${pos(r.position)}, ${num(r.impressions)} impressions and ${num(r.clicks)} clicks in the last 28 days.`,
        impact: r.impressions >= 500 ? "High" : r.impressions >= 100 ? "Medium" : "Low",
        effort: page1 || r.position <= 15 ? "Low" : "Medium",
        score: r.impressions / Math.max(1, r.position - 3),
        link: { to: "/research/keywords", search: { k: r.dimension }, label: "Research it" },
      });
    }
    // Keyword gaps: target keywords the site gets no search clicks for yet.
    const have = new Set((gsc.data ?? []).map((r) => r.dimension.toLowerCase()));
    for (const k of targets.data ?? []) {
      if (have.has(k.keyword)) continue;
      const vol = k.search_volume ?? 0;
      out.push({
        key: `g-${k.id}`,
        kind: "gap",
        title: `Create or improve a page for "${k.keyword}"`,
        detail: `${num(k.search_volume)} searches a month${k.difficulty != null ? `, difficulty ${Math.round(k.difficulty)}` : ""}${
          k.competitors.length ? `. Ranking: ${k.competitors.slice(0, 3).join(", ")}` : ""
        }. ${k.status === "approved" ? "Approved" : "Suggested"} target keyword.`,
        impact: vol >= 1000 || k.priority === "p1" ? "High" : vol >= 200 ? "Medium" : "Low",
        effort: k.difficulty == null ? "Medium" : k.difficulty <= 35 ? "Low" : k.difficulty < 70 ? "Medium" : "High",
        score: (vol || 50) / Math.max(10, k.difficulty ?? 50),
        link: { to: "/research/keywords", search: { k: k.keyword }, label: "Research it" },
      });
    }
    // Site issues from the audit.
    for (const g of audit.data?.by_type ?? []) {
      const w = SEV_WEIGHT[g.severity] ?? 1;
      out.push({
        key: `i-${g.finding_type}`,
        kind: "issue",
        title: `Fix ${humanize(g.finding_type).toLowerCase()} on ${g.count} ${g.count === 1 ? "page" : "pages"}`,
        detail: `Worst severity: ${g.severity}. Found by the Technical Auditor.`,
        impact: w >= 4 ? "High" : w === 3 ? "Medium" : "Low",
        effort: g.count > 10 ? "High" : g.count > 3 ? "Medium" : "Low",
        score: w * 40 + g.count,
        link: { to: `/clients/${clientId}`, search: { tab: "findings" }, label: "See the audit" },
      });
    }
    // Decisions the bots are waiting for.
    for (const h of waiting.data ?? []) {
      out.push({
        key: `w-${h.id}`,
        kind: "waiting",
        title: h.issue,
        detail: `${agentName(h.agent_id, true)} needs a ${h.category === "approval" ? "decision" : "hand"}. Priority ${h.priority.toUpperCase()}.`,
        impact: h.priority === "p1" || h.priority === "p2" ? "High" : "Medium",
        effort: "Low",
        score: h.priority === "p1" ? 1000 : h.priority === "p2" ? 500 : 100,
        link: { to: "/inbox", search: { item: h.id }, label: "Open in inbox" },
      });
    }
    return out.sort((a, b) => b.score - a.score);
  }, [gsc.data, targets.data, audit.data, waiting.data, clientId]);

  const loading = gsc.isLoading || audit.isLoading || targets.isLoading || waiting.isLoading;
  const error = gsc.error || audit.error || targets.error || waiting.error;
  const count = (k: string) => actions.filter((a) => a.kind === k).length;
  const shown = view === "all" ? actions : actions.filter((a) => a.kind === view);

  return (
    <Panel title="Next actions">
      <p className="px-4 pt-3 text-[13px] text-ink-2">
        Ranked by how much each is worth against the effort it takes. The bots already work on most of these; use this to see what's open and to push
        the ones that matter.
      </p>
      <Tabs
        tabs={[
          { id: "all", label: "All", count: actions.length },
          { id: "quick", label: "Quick wins", count: count("quick") },
          { id: "gap", label: "Keyword gaps", count: count("gap") },
          { id: "issue", label: "Site issues", count: count("issue") },
          { id: "waiting", label: "Waiting on you", count: count("waiting") },
        ]}
        value={view}
        onChange={setView}
      />
      {loading ? (
        <Skeleton rows={6} />
      ) : error ? (
        <ErrorNote error={error} />
      ) : !shown.length ? (
        <p className="px-4 py-8 text-center text-[13px] text-ink-3">
          {view === "quick"
            ? "Quick wins appear once Search Console positions are saved for this client's searches."
            : "Nothing here right now."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px]">
            <thead className="text-[12.5px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Impact</th>
                <th className="px-3 py-2 font-medium">Effort</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((a) => (
                <tr key={a.key} className="align-top">
                  <td className="px-4 py-2.5">
                    <span className={cx("mr-2 text-[11.5px] font-medium tracking-wide uppercase", a.kind === "waiting" ? "text-p1" : "text-ink-3")}>
                      {KIND_LABEL[a.kind]}
                    </span>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-[12.5px] text-ink-3">{a.detail}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={LEVEL_TONE[a.impact]}>{a.impact}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={a.effort === "Low" ? "ok" : a.effort === "Medium" ? "p2" : "p1"}>{a.effort}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Link to={a.link.to} search={a.link.search} className="text-denim hover:underline">
                      {a.link.label}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
