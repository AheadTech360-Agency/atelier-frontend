import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, GitPullRequest, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ago } from "@/lib/format";
import { Badge, Button, ConfirmAction, cx, errorText, useToast } from "./ui";
import type { Action } from "@/api-types/Action";

type Tone = "neutral" | "denim" | "ok" | "p1" | "p2" | "p3" | "p4";

/** Plain words for each status, and how it should look. */
export const CHANGE_STATUS: Record<string, { label: string; tone: Tone; note: string }> = {
  proposed: { label: "Waiting for approval", tone: "p3", note: "Approve it in the inbox and Atelier applies it." },
  approved: { label: "Approved, applying soon", tone: "denim", note: "Atelier applies it within a minute." },
  applying: { label: "Applying now", tone: "denim", note: "Atelier is making the change." },
  applied: { label: "Live", tone: "ok", note: "The change is on the site." },
  pr_open: { label: "Pull request open", tone: "denim", note: "Merge it here once the checks pass, or on GitHub." },
  merged: { label: "Merged", tone: "ok", note: "The code change is merged. Vercel deploys it." },
  closed: { label: "Closed", tone: "neutral", note: "The pull request was closed without merging." },
  failed: { label: "Failed", tone: "p1", note: "Nothing was changed. See why below." },
  rejected: { label: "Not approved", tone: "neutral", note: "This change was turned down." },
  undoing: { label: "Undoing", tone: "denim", note: "" },
  undone: { label: "Undone", tone: "neutral", note: "The original values are back." },
};

const IN_FLIGHT = new Set(["approved", "applying", "pr_open"]);

/** One sentence on what approving does to the live site, for the confirm step. */
export function liveChangeSummary(action: Action, domain?: string): string {
  const p = action.payload as { mutations?: unknown[]; files?: unknown[] };
  const site = domain ? ` on ${domain}` : "";
  if (action.kind === "github") {
    const n = p.files?.length ?? 0;
    return `Merging puts ${n === 1 ? "1 file change" : `${n} file changes`} into the live branch${site}. Vercel deploys it right away.`;
  }
  const ids = new Set(
    (p.mutations ?? []).map((m) => {
      const o = m as { id?: string; doc?: { _id?: string } };
      return o.id ?? o.doc?._id ?? "";
    }),
  );
  const n = ids.size || 1;
  return `Atelier makes the change shown above to ${n === 1 ? "1 item" : `${n} items`}${site}, exactly as written.`;
}

/** The change linked to an inbox item, or null. Refreshes while it's being applied. */
export function useChangeForItem(hrId: string) {
  return useQuery({
    queryKey: ["actions", "hr", hrId],
    queryFn: async () => (await api.get<Action[]>("/actions", { human_required_id: hrId, limit: 1 }))[0] ?? null,
    refetchInterval: (q) => (q.state.data && IN_FLIGHT.has(q.state.data.status) ? 5000 : false),
  });
}

function checksLabel(checks: unknown): { text: string; tone: Tone } | null {
  switch (checks) {
    case "success":
      return { text: "Checks passed", tone: "ok" };
    case "pending":
      return { text: "Checks running", tone: "p3" };
    case "failure":
      return { text: "Checks failed", tone: "p1" };
    case "none":
      return { text: "No checks", tone: "neutral" };
    default:
      return null;
  }
}

/** Status, outcome and the actions a person can take on a planned change. */
export function ChangePanel({ action, compact = false }: { action: Action; compact?: boolean }) {
  const { isAdmin } = useSession();
  const [confirm, setConfirm] = useState<"merge" | "undo" | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const s = CHANGE_STATUS[action.status] ?? { label: action.status, tone: "neutral" as Tone, note: "" };
  const checks = checksLabel(action.result?.checks);
  const run = useMutation({
    mutationFn: (what: "merge" | "undo" | "retry" | "refresh") => api.post<Action>(`/actions/${action.id}/${what}`),
    onSuccess: (a, what) => {
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["actions"] });
      const done: Record<string, string> = {
        merge: "Merged. Vercel deploys it.",
        undo: a.id !== action.id ? "Revert pull request is being opened." : a.status === "closed" ? "Pull request closed." : "Undone.",
        retry: "Trying again.",
        refresh: "Updated from GitHub.",
      };
      toast(done[what]);
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const busy = (w: string) => run.isPending && run.variables === w;
  // Merge only once the build status is known and not failing or running.
  const checksPassed = action.result?.checks === "success" || action.result?.checks === "none";
  const undoLabel =
    action.status === "pr_open" ? "Close pull request" : action.status === "merged" ? "Revert" : "Undo";
  const canUndo = action.status === "applied" || action.status === "pr_open" || (action.status === "merged" && !action.result?.reverted_by);

  return (
    <section className={cx("rounded-md border border-line bg-surface", compact ? "px-3 py-2.5" : "px-4 py-3")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={s.tone}>{s.label}</Badge>
        {action.status === "pr_open" ? (
          checks ? <Badge tone={checks.tone}>{checks.text}</Badge> : <Badge tone="p3">Checking the build</Badge>
        ) : null}
        <span className="text-[12.5px] text-ink-3">
          {action.kind === "github" ? "Code change" : "Content change"}
          {action.applied_at ? `, ${action.status === "merged" ? "merged" : "applied"} ${ago(action.applied_at)}` : ""}
        </span>
        {action.external_url ? (
          <a href={action.external_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[13px] text-denim underline underline-offset-2">
            <GitPullRequest size={13} /> Pull request #{action.pr_number} <ExternalLink size={11} />
          </a>
        ) : null}
      </div>
      {!compact && s.note ? <p className="mt-1.5 text-[13px] text-ink-2">{s.note}</p> : null}
      {!compact ? <FullChange action={action} /> : null}
      {action.error ? (
        <p className={cx("mt-2 rounded-md px-3 py-2 text-[13px]", action.status === "failed" ? "bg-p1-soft text-p1" : "bg-sunken text-ink-2")}>
          {action.error}
        </p>
      ) : null}
      {isAdmin && (canUndo || action.status === "failed" || action.status === "pr_open") ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {action.status === "pr_open" ? (
            <Button
              size="sm"
              variant="approve"
              busy={busy("merge")}
              disabled={!checksPassed}
              title={checksPassed ? undefined : action.result?.checks === "failure" ? "The build failed: open the pull request" : "Wait for the checks to finish"}
              onClick={() => setConfirm("merge")}
            >
              Merge
            </Button>
          ) : null}
          {action.status === "failed" ? (
            <Button size="sm" busy={busy("retry")} onClick={() => run.mutate("retry")}>
              Retry
            </Button>
          ) : null}
          {canUndo ? (
            <Button
              size="sm"
              variant="danger"
              busy={busy("undo")}
              onClick={() => setConfirm("undo")}
            >
              {undoLabel}
            </Button>
          ) : null}
          {action.status === "pr_open" ? (
            <Button size="sm" variant="ghost" busy={busy("refresh")} onClick={() => run.mutate("refresh")}>
              <RefreshCw size={13} /> Refresh
            </Button>
          ) : null}
        </div>
      ) : null}
      {confirm === "merge" ? (
        <ConfirmAction open onClose={() => setConfirm(null)} title="Merge this pull request?" confirmLabel="Merge and deploy" busy={busy("merge")} onConfirm={() => run.mutate("merge")}>
          <p>
            <span className="font-medium text-ink">{action.title}</span>
          </p>
          <p>{liveChangeSummary(action)}</p>
          <p>If something looks wrong afterwards, Revert opens a pull request that takes it back out.</p>
        </ConfirmAction>
      ) : null}
      {confirm === "undo" ? (
        <ConfirmAction
          open
          onClose={() => setConfirm(null)}
          title={`${undoLabel}?`}
          confirmLabel={undoLabel}
          variant="danger"
          busy={busy("undo")}
          onConfirm={() => run.mutate("undo")}
        >
          <p>
            <span className="font-medium text-ink">{action.title}</span>
          </p>
          <p>
            {action.status === "pr_open"
              ? "The pull request closes without merging. Nothing on the site changes."
              : action.status === "merged"
                ? "Atelier opens a new pull request that takes this change back out. Merge it to finish."
                : "Atelier puts the original values back on the live site."}
          </p>
        </ConfirmAction>
      ) : null}
    </section>
  );
}

/** Everything the change will do, unshortened, so a reviewer never approves what they can't see. */
function FullChange({ action }: { action: Action }) {
  const payload = action.payload as {
    files?: { path: string; content?: string; delete?: boolean }[];
    mutations?: unknown[];
  };
  return (
    <details className="mt-2.5 rounded-md border border-line">
      <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-ink-2 hover:text-ink">Technical details</summary>
      <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
        {payload.files
          ? payload.files.map((f) => (
              <div key={f.path}>
                <p className="mb-1 font-mono text-[12.5px] text-ink">
                  {f.path} {f.delete ? <span className="text-p1">(deleted)</span> : null}
                </p>
                {f.delete ? null : (
                  <pre className="max-h-[480px] overflow-auto rounded-md bg-sunken px-3 py-2 text-[12px] leading-relaxed whitespace-pre">{f.content}</pre>
                )}
              </div>
            ))
          : (
              <pre className="max-h-[480px] overflow-auto rounded-md bg-sunken px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(payload.mutations ?? payload, null, 2)}
              </pre>
            )}
      </div>
    </details>
  );
}
