import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ago, humanize } from "@/lib/format";
import { Badge, Button, ConfirmDelete, Dialog, EmptyState, ErrorNote, Field, Panel, Skeleton, TextField, Textarea, errorText, useToast } from "./ui";
import type { Prospect } from "@/api-types/Prospect";
import type { ProspectDetail } from "@/api-types/ProspectDetail";
import type { ProspectRequested } from "@/api-types/ProspectRequested";

const SEV_TONE: Record<string, "p1" | "p2" | "p3" | "p4" | "neutral"> = { critical: "p1", high: "p2", medium: "p3", low: "p4", info: "neutral" };
const STATUS_LABEL: Record<string, string> = { queued: "Waiting for the bot", running: "In progress", done: "Ready", failed: "Failed" };
const STATUS_TONE: Record<string, "neutral" | "denim" | "ok" | "p1"> = { queued: "neutral", running: "denim", done: "ok", failed: "p1" };

/** Header button + dialog to request a review. */
export function ProspectReviewButton() {
  const { canReview } = useSession();
  const [open, setOpen] = useState(false);
  if (!canReview) return null;
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Prospect review
      </Button>
      {open ? <RequestDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function RequestDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const send = useMutation({
    mutationFn: () => api.post<ProspectRequested>("/prospects", { domain, name: name || null, notes: notes || null }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast(r.bot_started ? `Review of ${r.prospect.domain} started` : `Review of ${r.prospect.domain} queued. ${r.note ?? ""}`.trim(), r.bot_started ? "ok" : "ok");
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Review a prospect's store"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="prospect-form" busy={send.isPending} disabled={!domain.trim()}>
            Start review
          </Button>
        </>
      }
    >
      <form id="prospect-form" onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-[13px] text-ink-2">
          The Technical Auditor checks public pages only: no logins, no credentials, and it never contacts the store. Results stay separate from client data.
        </p>
        <TextField label="Store domain" required placeholder="brand.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
        <TextField label="Brand name" hint="Optional" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Notes for the bot" htmlFor="prospect-notes" hint="Optional, e.g. what the sales call will focus on">
          <Textarea id="prospect-notes" className="min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}

/** List of reviews with their status; click one to read the report. */
export function ProspectReviewsPanel() {
  const q = useQuery({ queryKey: ["prospects"], queryFn: () => api.get<Prospect[]>("/prospects"), refetchInterval: 30_000 });
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Panel title="Prospect reviews">
      {q.isLoading ? (
        <Skeleton rows={2} />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.data?.length ? (
        <EmptyState title="No prospect reviews yet" body="Use Prospect review to have the Technical Auditor look at a store's public pages before a sales call." />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.map((p) => (
            <li key={p.id}>
              <button onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name || p.domain}</span>
                  <span className="block truncate text-[12.5px] text-ink-3">
                    {p.name ? `${p.domain}, ` : ""}
                    {p.status === "done" ? `${p.finding_count} findings, finished ${ago(p.finished_at)}` : `requested ${ago(p.created_at)}`}
                  </span>
                </span>
                <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {openId ? <ProspectDialog id={openId} onClose={() => setOpenId(null)} /> : null}
    </Panel>
  );
}

function ProspectDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { canReview } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ["prospect", id], queryFn: () => api.get<ProspectDetail>(`/prospects/${id}`) });
  const del = useMutation({
    mutationFn: () => api.del(`/prospects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast("Prospect review deleted");
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const p = q.data?.prospect;
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={p ? p.name || p.domain : "Prospect review"}
      footer={
        canReview ? (
          <Button variant="danger" className="mr-auto" onClick={() => setConfirm(true)}>
            Delete review
          </Button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <Skeleton rows={4} />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-2">
            <a href={`https://${p!.domain}`} target="_blank" rel="noreferrer noopener" className="text-denim underline underline-offset-2">
              {p!.domain}
            </a>
            , {STATUS_LABEL[p!.status].toLowerCase()}
            {p!.notes ? `. Notes: ${p!.notes}` : ""}
          </p>
          {p!.summary ? <p className="rounded-md border-l-[3px] border-denim bg-denim-soft px-3 py-2">{p!.summary}</p> : null}
          {p!.report_markdown ? (
            <div className="proof">
              <Markdown>{p!.report_markdown}</Markdown>
            </div>
          ) : p!.status !== "done" ? (
            <p className="text-ink-3">The report appears here when the Technical Auditor finishes.</p>
          ) : null}
          {q.data!.findings.length ? (
            <section>
              <h3 className="mb-1 font-semibold">Findings</h3>
              <ul className="divide-y divide-line rounded-md border border-line">
                {q.data!.findings.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 px-3 py-2">
                    <Badge tone={SEV_TONE[f.severity]}>{humanize(f.severity)}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{f.title}</span>
                      <span className="block truncate text-[12.5px] text-ink-3">
                        {humanize(f.finding_type)}
                        {f.url ? `, ${f.url}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
      <ConfirmDelete
        open={confirm}
        onClose={() => setConfirm(false)}
        thing="review"
        name={p?.domain ?? ""}
        consequence="Its report and findings are removed too."
        busy={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </Dialog>
  );
}
