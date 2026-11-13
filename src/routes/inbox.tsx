import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useScopedClient, useSession } from "@/lib/session";
import { AGENTS, agentName, ago, daysOpen, humanize } from "@/lib/format";
import { useClients } from "@/components/Shell";
import {
  Button,
  cx,
  EmptyState,
  ErrorNote,
  PageHeader,
  PriorityBadge,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  errorText,
  useToast,
} from "@/components/ui";
import type { HumanRequired } from "@/api-types/HumanRequired";
import type { DecisionInput } from "@/api-types/DecisionInput";
import type { InboxSearch } from "@/router";

const STATUSES = [
  { id: "open", label: "Waiting on you" },
  { id: "needs_changes", label: "Sent back" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "resolved", label: "Resolved" },
];

/** Live updates: any change to Human Required refreshes the lists. */
function useHumanRequiredRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("hr-changes")
      .on("postgres_changes", { event: "*", schema: "app", table: "human_required" }, () => {
        qc.invalidateQueries({ queryKey: ["hr"] });
        qc.invalidateQueries({ queryKey: ["overview"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}

export function InboxPage() {
  useHumanRequiredRealtime();
  const search = useSearch({ from: "/inbox" });
  const navigate = useNavigate({ from: "/inbox" });
  const clientId = useScopedClient();
  const status = search.status ?? "open";
  const setSearch = (patch: Partial<InboxSearch>) => navigate({ search: (s) => ({ ...s, ...patch }) });

  const list = useQuery({
    queryKey: ["hr", { clientId, status, agent: search.agent, priority: search.priority, stale: search.stale }],
    queryFn: () =>
      api.get<HumanRequired[]>("/human-required", {
        client_id: clientId,
        status,
        agent_id: search.agent,
        priority: search.priority,
        older_than_days: search.stale ? 3 : undefined,
        limit: 200,
      }),
  });

  const items = list.data ?? [];
  const selected = items.find((i) => i.id === search.item) ?? null;

  // j / k to move through the queue.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "j" && e.key !== "k") return;
      const idx = items.findIndex((i) => i.id === search.item);
      const next = e.key === "j" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (items[next]) setSearch({ item: items[next].id });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <PageHeader
        title="Human Required"
        description="Approvals, blocks and questions from the bots. Bots act on your decision at the start of their next run."
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 md:px-6">
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={status === s.id}
              onClick={() => setSearch({ status: s.id, item: undefined })}
              className={cx(
                "h-8 rounded-md px-2.5 text-[13px]",
                status === s.id ? "bg-ink text-surface" : "text-ink-2 hover:bg-sunken",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            aria-label="Bot"
            value={search.agent ?? ""}
            onChange={(e) => setSearch({ agent: e.target.value || undefined, item: undefined })}
            className="h-8 w-auto"
          >
            <option value="">All bots</option>
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Priority"
            value={search.priority ?? ""}
            onChange={(e) => setSearch({ priority: e.target.value || undefined, item: undefined })}
            className="h-8 w-auto"
          >
            <option value="">Any priority</option>
            <option value="p1">P1 urgent</option>
            <option value="p2">P2 high</option>
            <option value="p3">P3 normal</option>
            <option value="p4">P4 low</option>
          </Select>
          {status === "open" ? (
            <Button
              size="sm"
              variant={search.stale ? "primary" : "secondary"}
              onClick={() => setSearch({ stale: search.stale ? undefined : "1", item: undefined })}
              aria-pressed={!!search.stale}
            >
              Open 3+ days
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Queue */}
        <div className={cx("min-h-0 w-full overflow-y-auto border-r border-line md:w-[380px] md:shrink-0", selected && "max-md:hidden")}>
          {list.isLoading ? (
            <Skeleton rows={8} />
          ) : list.error ? (
            <ErrorNote error={list.error} />
          ) : items.length === 0 ? (
            <EmptyState
              title={status === "open" ? "Nothing waiting on you" : `No ${humanize(status).toLowerCase()} items`}
              body={status === "open" ? "When a bot needs an approval or gets stuck, it shows up here." : "Try another status or clear the filters."}
            />
          ) : (
            <ul>
              {items.map((i) => (
                <QueueRow key={i.id} item={i} active={i.id === search.item} onSelect={() => setSearch({ item: i.id })} />
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className={cx("min-h-0 flex-1 overflow-y-auto bg-surface", !selected && "max-md:hidden")}>
          {selected ? (
            <Detail
              key={selected.id}
              item={selected}
              onBack={() => setSearch({ item: undefined })}
              onDecided={() => {
                // Move straight to the next item so a queue can be cleared without extra clicks.
                const idx = items.findIndex((i) => i.id === selected.id);
                const next = items[idx + 1] ?? items[idx - 1];
                setSearch({ item: next && next.id !== selected.id ? next.id : undefined });
              }}
            />
          ) : (
            <EmptyState title="Select an item" body="Pick an item from the queue to read the ask and the draft. Use j and k to move through the list." />
          )}
        </div>
      </div>
    </div>
  );
}

function QueueRow({ item, active, onSelect }: { item: HumanRequired; active: boolean; onSelect: () => void }) {
  const clients = useClients();
  const client = clients.data?.find((c) => c.id === item.client_id);
  const days = daysOpen(item.created_at);
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={active || undefined}
        className={cx(
          "flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left md:px-5",
          active ? "bg-denim-soft" : "hover:bg-sunken",
        )}
      >
        <div className="flex items-center gap-2">
          <PriorityBadge p={item.priority} />
          <span className="truncate text-[13px] text-ink-2">{client?.name ?? "Client"}</span>
          <span className="shrink-0 text-[13px] text-ink-3">{agentName(item.agent_id, true)}</span>
          <span className={cx("tabular ml-auto shrink-0 text-[12.5px]", item.status === "open" && days >= 3 ? "font-medium text-p2" : "text-ink-3")}>
            {item.status === "open" ? (days === 0 ? "today" : `${days}d`) : ago(item.decided_at)}
          </span>
        </div>
        <p className="line-clamp-2 font-medium">{item.issue}</p>
      </button>
    </li>
  );
}

function Detail({ item, onBack, onDecided }: { item: HumanRequired; onBack: () => void; onDecided: () => void }) {
  const { canReview } = useSession();
  const clients = useClients();
  const client = clients.data?.find((c) => c.id === item.client_id);
  const qc = useQueryClient();
  const toast = useToast();
  const original = item.edited_draft ?? item.draft ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(original);
  const [note, setNote] = useState(item.reviewer_note ?? "");
  const edited = draft.trim() !== (item.draft ?? "").trim() && draft.trim() !== "";
  const decidable = canReview && (item.status === "open" || item.status === "needs_changes" || !item.acted_on_at);

  const decide = useMutation({
    mutationFn: (d: DecisionInput) => api.post<HumanRequired>(`/human-required/${item.id}/decision`, d),
    onSuccess: (_r, d) => {
      const verb: Record<string, string> = {
        approved: edited ? "Approved with your edits" : "Approved",
        rejected: "Rejected",
        needs_changes: "Sent back for changes",
        resolved: "Marked resolved",
      };
      toast(`${verb[d.decision]}. The bot picks it up on its next run.`);
      onDecided();
      qc.invalidateQueries({ queryKey: ["hr"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  const send = (decision: string) =>
    decide.mutate({ decision, note: note.trim() || null, edited_draft: decision === "approved" && edited ? draft : null });

  const needsNote = !note.trim();
  const isApproval = !!item.draft;

  const meta = useMemo(
    () => [
      ["Client", client?.name ?? ""],
      ["Bot", agentName(item.agent_id)],
      ["Category", humanize(item.category)],
      ["Action", item.action_type ? humanize(item.action_type) : "None"],
      ["Raised", ago(item.created_at)],
    ],
    [client, item],
  );

  return (
    <article className="flex min-h-full flex-col">
      <div className="flex-1 px-4 py-5 md:px-8">
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-2 md:hidden">
          <ArrowLeft size={14} /> Back to queue
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge p={item.priority} />
          <StatusBadge s={item.status} />
          {item.acted_on_at ? <span className="text-[12.5px] text-ink-3">Bot acted {ago(item.acted_on_at)}</span> : null}
        </div>
        <h2 className="mt-2 max-w-[70ch] text-[19px] leading-snug font-semibold">{item.issue}</h2>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          {meta.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-5 max-w-[70ch] rounded-md border-l-[3px] border-denim bg-denim-soft px-4 py-3">
          <h3 className="text-[13px] font-medium text-denim">What the bot needs from you</h3>
          <p className="mt-1 text-[15px] whitespace-pre-wrap">{item.ask}</p>
        </section>

        {item.link ? (
          <a href={item.link} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1 text-denim underline underline-offset-2">
            Open link <ExternalLink size={13} />
          </a>
        ) : null}

        {isApproval ? (
          <section className="mt-6">
            <div className="mb-2 flex max-w-[68ch] items-center justify-between">
              <h3 className="font-semibold">{item.edited_draft ? "Draft (with reviewer edits)" : "Draft"}</h3>
              {decidable ? (
                <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                  {editing ? "Preview" : "Edit draft"}
                </Button>
              ) : null}
            </div>
            {editing ? (
              <Textarea
                aria-label="Draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="proof min-h-[420px] !text-[16px]"
              />
            ) : (
              <div className="proof rounded-md border border-line bg-canvas/40 px-5 py-4">
                <Markdown>{draft || "_Empty draft_"}</Markdown>
              </div>
            )}
            {edited ? <p className="mt-1.5 text-[12.5px] text-p2">You changed the draft. Approving sends your version to the bot.</p> : null}
          </section>
        ) : null}

        {item.reviewer_note && !decidable ? (
          <section className="mt-5 max-w-[70ch]">
            <h3 className="text-[13px] font-medium text-ink-2">Reviewer note</h3>
            <p className="mt-1 whitespace-pre-wrap">{item.reviewer_note}</p>
          </section>
        ) : null}
      </div>

      {decidable ? (
        <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3 md:px-8">
          <label htmlFor="hr-note" className="sr-only">
            Note to the bot
          </label>
          <Textarea
            id="hr-note"
            rows={1}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="!min-h-0 resize-y"
            placeholder="Note to the bot. Required to send back or reject, e.g. use the Spring collection link instead"
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button variant="approve" busy={decide.isPending && decide.variables?.decision === "approved"} onClick={() => send("approved")}>
              {edited ? "Approve with my edits" : "Approve"}
            </Button>
            <Button disabled={needsNote} title={needsNote ? "Add a note first" : undefined} onClick={() => send("needs_changes")}>
              Send back for changes
            </Button>
            <Button variant="danger" disabled={needsNote} title={needsNote ? "Add a note first" : undefined} onClick={() => send("rejected")}>
              Reject
            </Button>
            <Button variant="ghost" className="ml-auto" onClick={() => send("resolved")}>
              Mark resolved
            </Button>
          </div>
        </div>
      ) : !canReview ? (
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-3 md:px-8">You have view access. Reviewers and admins can decide on items.</p>
      ) : null}
    </article>
  );
}
