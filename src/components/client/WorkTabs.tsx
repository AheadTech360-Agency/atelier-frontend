import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { usePagedList } from "@/lib/paged";
import { useSession } from "@/lib/session";
import { agentName, ago, dateLabel, humanize } from "@/lib/format";
import { Badge, EmptyState, ErrorNote, LoadMore, Panel, Select, Skeleton, StatusBadge, cx, errorText, useToast } from "../ui";
import type { Finding } from "@/api-types/Finding";
import type { ContentItem } from "@/api-types/ContentItem";
import type { Outreach } from "@/api-types/Outreach";
import type { StageCount } from "@/api-types/StageCount";

const SEV_TONE: Record<string, "p1" | "p2" | "p3" | "p4" | "neutral"> = { critical: "p1", high: "p2", medium: "p3", low: "p4", info: "neutral" };

export function FindingsTab({ clientId }: { clientId: string }) {
  const { canReview } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("");
  const q = usePagedList<Finding>(["findings", clientId], "/findings", { client_id: clientId, status, severity });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/findings/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["findings", clientId] }),
    onError: (e) => toast(errorText(e), "error"),
  });

  return (
    <Panel
      title="Technical findings"
      actions={
        <div className="flex gap-2">
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-auto">
            {["open", "in_progress", "handed_off", "fixed", "ignored"].map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
          <Select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-8 w-auto">
            <option value="">Any severity</option>
            {["critical", "high", "medium", "low", "info"].map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.items.length ? (
        <EmptyState title="No findings here" body="The Technical Auditor records broken links, indexing issues, Core Web Vitals and schema problems after each crawl." />
      ) : (
        <ul className="divide-y divide-line">
          {q.items.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <Badge tone={SEV_TONE[f.severity]}>{humanize(f.severity)}</Badge>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{f.title}</p>
                <p className="truncate text-[13px] text-ink-3">
                  {humanize(f.finding_type)}
                  {f.page_template ? `, ${f.page_template} template` : ""}
                  {f.url ? (
                    <>
                      {", "}
                      <a href={f.url} target="_blank" rel="noreferrer noopener" className="hover:underline">
                        {f.url}
                      </a>
                    </>
                  ) : null}
                </p>
                {f.detail ? <p className="mt-1 max-w-[80ch] text-[13px] text-ink-2">{f.detail}</p> : null}
                <p className="mt-1 text-[12.5px] text-ink-3">
                  Found by {agentName(f.agent_id, true)}
                  {f.assigned_agent ? `, assigned to ${agentName(f.assigned_agent, true)}` : ""}. Last seen {ago(f.last_seen_at)}.
                  {f.dev_ticket_url ? (
                    <a href={f.dev_ticket_url} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex items-center gap-0.5 text-denim">
                      Dev ticket <ExternalLink size={11} />
                    </a>
                  ) : null}
                </p>
              </div>
              {canReview ? (
                <Select
                  aria-label={`Status of ${f.title}`}
                  value={f.status}
                  onChange={(e) => update.mutate({ id: f.id, status: e.target.value })}
                  className="h-8 w-auto"
                >
                  {["open", "in_progress", "handed_off", "fixed", "ignored"].map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              ) : (
                <StatusBadge s={f.status} />
              )}
            </li>
          ))}
        </ul>
      )}
      <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
    </Panel>
  );
}

export function ContentTab({ clientId }: { clientId: string }) {
  const [kind, setKind] = useState("");
  const q = usePagedList<ContentItem>(["content", clientId], "/content", { client_id: clientId, kind });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Panel
      title="Content calendar"
      actions={
        <Select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 w-auto">
          <option value="">All types</option>
          {["topic", "brief", "post", "refresh", "faq", "video"].map((k) => (
            <option key={k} value={k}>
              {humanize(k)}
            </option>
          ))}
        </Select>
      }
    >
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.items.length ? (
        <EmptyState title="No content planned yet" body="The Content Writer adds its monthly topic calendar here. Topics go to Human Required for sign-off before writing starts." />
      ) : (
        <ul className="divide-y divide-line">
          {q.items.map((c) => (
            <li key={c.id}>
              <button onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken">
                <span className="tabular w-14 shrink-0 text-[13px] text-ink-3">{c.planned_for ? dateLabel(c.planned_for) : "No date"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {humanize(c.kind)}
                    {c.target_keyword ? `, keyword "${c.target_keyword}"` : ""}
                  </span>
                </span>
                <StatusBadge s={c.status} />
              </button>
              {open === c.id ? (
                <div className="border-t border-line bg-canvas/50 px-4 py-4">
                  {c.published_url ? (
                    <a href={c.published_url} target="_blank" rel="noreferrer noopener" className="mb-2 inline-flex items-center gap-1 text-denim underline">
                      View published post <ExternalLink size={12} />
                    </a>
                  ) : null}
                  <ContentBody id={c.id} hasBody={!!c.body} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
    </Panel>
  );
}

/** Lists carry a preview of the body; the full post loads when a row is opened. */
function ContentBody({ id, hasBody }: { id: string; hasBody: boolean }) {
  const q = useQuery({ queryKey: ["content", "item", id], queryFn: () => api.get<ContentItem>(`/content/${id}`), enabled: hasBody });
  if (!hasBody) return <p className="text-ink-3">No body yet.</p>;
  if (q.isLoading) return <Skeleton rows={3} />;
  if (q.error) return <ErrorNote error={q.error} />;
  return <div className="proof whitespace-pre-wrap">{q.data!.body}</div>;
}

const PIPELINE = ["prospect", "qualified", "pitch_drafted", "pitch_approved", "sent", "follow_up", "replied", "won", "lost"];

export function OutreachTab({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState("");
  const q = usePagedList<Outreach>(["outreach", clientId], "/outreach", { client_id: clientId, status });
  // Counted in the database, so no rows are downloaded just to count them.
  const countsQ = useQuery({
    queryKey: ["outreach", clientId, "counts"],
    queryFn: () => api.get<StageCount[]>("/outreach/counts", { client_id: clientId }),
  });
  const counts: Record<string, number> = Object.fromEntries((countsQ.data ?? []).map((c) => [c.status, c.count]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pipeline stage">
        <button onClick={() => setStatus("")} aria-pressed={!status} className={cx("h-8 rounded-md px-2.5 text-[13px]", !status ? "bg-ink text-surface" : "text-ink-2 hover:bg-sunken")}>
          All <span className="tabular opacity-70">{total}</span>
        </button>
        {PIPELINE.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cx("h-8 rounded-md px-2.5 text-[13px]", status === s ? "bg-ink text-surface" : "text-ink-2 hover:bg-sunken")}
          >
            {humanize(s)} <span className="tabular opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>
      <Panel title="Link building and outreach">
        {q.isLoading ? (
          <Skeleton />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : !q.items.length ? (
          <EmptyState title="No opportunities here" body="The Off-Page Optimizer adds backlink gaps, unlinked mentions and journalist requests. Replies to outreach are handled by the team." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="text-[12.5px] text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Site</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Score</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Follow up</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{o.domain}</span>
                      {o.contact_name ? <span className="block text-[12.5px] text-ink-3">{o.contact_name}</span> : null}
                    </td>
                    <td className="px-4 text-ink-2">{humanize(o.opportunity_type)}</td>
                    <td className="tabular px-4 text-right">{o.score}</td>
                    <td className="px-4">
                      <StatusBadge s={o.status} />
                    </td>
                    <td className={cx("px-4 text-[13px]", o.follow_up_on && new Date(o.follow_up_on) <= new Date() ? "font-medium text-p2" : "text-ink-2")}>
                      {o.follow_up_on ? dateLabel(o.follow_up_on) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
      </Panel>
    </div>
  );
}
