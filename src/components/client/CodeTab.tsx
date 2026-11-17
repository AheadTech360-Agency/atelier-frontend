import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { agentName, ago } from "@/lib/format";
import { ChangePanel } from "../ChangePanel";
import { Badge, Button, ConfirmDelete, Dialog, EmptyState, ErrorNote, Panel, Skeleton, TextField, errorText, useToast } from "../ui";
import type { Integration } from "@/api-types/Integration";
import type { IntegrationCheck } from "@/api-types/IntegrationCheck";
import type { IntegrationInput } from "@/api-types/IntegrationInput";
import type { Action } from "@/api-types/Action";

type Kind = "github" | "sanity";

const KINDS: Record<Kind, { name: string; what: string; fields: { key: string; label: string; hint: string; placeholder?: string; required?: boolean }[]; token: string }> = {
  sanity: {
    name: "Sanity",
    what: "Content: SEO titles and descriptions, page and blog copy, slugs, redirects. Approved changes go live right away, with Undo.",
    fields: [
      { key: "project_id", label: "Project ID", hint: "Sanity: manage > your project > Project ID", placeholder: "3do82whm", required: true },
      { key: "dataset", label: "Dataset", hint: "Usually production", placeholder: "production" },
      { key: "api_version", label: "API version", hint: "Leave empty for the default", placeholder: "2025-02-19" },
    ],
    token: "Sanity: manage > API > Tokens > Add API token, with Editor permissions.",
  },
  github: {
    name: "GitHub",
    what: "Code: robots.txt, schema markup, sitemap rules, components. Approved changes open a pull request you merge here or on GitHub.",
    fields: [
      { key: "repo", label: "Repository", hint: "owner/name, or paste the repo's URL", placeholder: "aheadtech360/website", required: true },
      { key: "default_branch", label: "Base branch", hint: "Leave empty to use the repo's default branch", placeholder: "main" },
    ],
    token:
      "GitHub: Settings > Developer settings > Fine-grained tokens. Only this repository, with Contents and Pull requests set to Read and write.",
  },
};

export function CodeTab({ clientId }: { clientId: string }) {
  const q = useQuery({
    queryKey: ["integrations", clientId],
    queryFn: () => api.get<Integration[]>(`/clients/${clientId}/integrations`),
  });
  const changes = useQuery({
    queryKey: ["actions", "client", clientId],
    queryFn: () => api.get<Action[]>("/actions", { client_id: clientId, limit: 30 }),
    refetchInterval: (qq) => (qq.state.data?.some((a) => ["approved", "applying", "pr_open"].includes(a.status)) ? 5000 : false),
  });
  const find = (k: Kind) => q.data?.find((i) => i.kind === k);

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[80ch] text-[13.5px] text-ink-2">
        Connect the site so bots can fix what they find. Bots plan each change and look things up through Atelier; they never see these tokens. Every
        change waits for your approval in the inbox.
      </p>
      {q.isLoading ? (
        <Skeleton rows={4} />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <IntegrationCard clientId={clientId} kind="sanity" current={find("sanity")} />
          <IntegrationCard clientId={clientId} kind="github" current={find("github")} />
        </div>
      )}
      <Panel title="Recent changes">
        {changes.isLoading ? (
          <Skeleton />
        ) : changes.error ? (
          <ErrorNote error={changes.error} />
        ) : !changes.data?.length ? (
          <EmptyState title="No changes yet" body="When a bot plans a change for this client, it shows up here and in the inbox." />
        ) : (
          <ul className="divide-y divide-line">
            {changes.data.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                  {a.human_required_id ? (
                    <Link to="/inbox" search={{ item: a.human_required_id, status: a.status === "proposed" ? "open" : a.status === "rejected" ? "rejected" : "approved" }} className="font-medium hover:underline">
                      {a.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{a.title}</span>
                  )}
                  <span className="text-[12.5px] text-ink-3">
                    {agentName(a.agent_id)}, planned {ago(a.created_at)}
                  </span>
                </div>
                <ChangePanel action={a} compact />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function IntegrationCard({ clientId, kind, current }: { clientId: string; kind: Kind; current?: Integration }) {
  const { isAdmin } = useSession();
  const meta = KINDS[kind];
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations", clientId] });
  const test = useMutation({
    mutationFn: () => api.post<IntegrationCheck>(`/clients/${clientId}/integrations/${kind}/test`),
    onSuccess: (r) => {
      refresh();
      toast(r.message, r.ok ? "ok" : "error");
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/clients/${clientId}/integrations/${kind}`),
    onSuccess: () => {
      refresh();
      setRemoving(false);
      toast(`${meta.name} disconnected`);
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const statusBadge = !current ? (
    <Badge>Not connected</Badge>
  ) : current.status === "ok" ? (
    <Badge tone="ok">Connected</Badge>
  ) : current.status === "error" ? (
    <Badge tone="p1">Needs attention</Badge>
  ) : (
    <Badge tone="p3">Not checked</Badge>
  );
  const cfg = (current?.config ?? {}) as Record<string, string>;

  return (
    <Panel
      title={meta.name}
      actions={
        isAdmin ? (
          <Button size="sm" variant={current ? "secondary" : "primary"} onClick={() => setEditing(true)}>
            {current ? "Edit" : `Connect ${meta.name}`}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-2.5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge}
          {current?.checked_at ? <span className="text-[12.5px] text-ink-3">checked {ago(current.checked_at)}</span> : null}
        </div>
        <p className="text-[13px] text-ink-2">{meta.what}</p>
        {current ? (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
            {meta.fields.map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-ink-3">{f.label}</dt>
                <dd className="truncate">{cfg[f.key] || <span className="text-ink-3">default</span>}</dd>
              </div>
            ))}
            <dt className="text-ink-3">Token</dt>
            <dd>{current.has_token ? "Saved" : <span className="text-p1">Missing</span>}</dd>
          </dl>
        ) : null}
        {current?.status_note ? (
          <p className={`rounded-md px-3 py-2 text-[13px] ${current.status === "error" ? "bg-p1-soft text-p1" : "bg-sunken text-ink-2"}`}>
            {current.status_note}
          </p>
        ) : null}
        {current && isAdmin ? (
          <div className="flex gap-2">
            <Button size="sm" busy={test.isPending} onClick={() => test.mutate()}>
              Test connection
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRemoving(true)}>
              Disconnect
            </Button>
          </div>
        ) : null}
      </div>
      {editing ? <IntegrationDialog clientId={clientId} kind={kind} current={current} onClose={() => setEditing(false)} /> : null}
      <ConfirmDelete
        open={removing}
        onClose={() => setRemoving(false)}
        thing={`${meta.name} connection`}
        name={meta.name}
        consequence="Its token is deleted. Bots can no longer plan or apply changes here; past changes stay in the list."
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </Panel>
  );
}

function IntegrationDialog({ clientId, kind, current, onClose }: { clientId: string; kind: Kind; current?: Integration; onClose: () => void }) {
  const meta = KINDS[kind];
  const qc = useQueryClient();
  const toast = useToast();
  const cfg = (current?.config ?? {}) as Record<string, string>;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(meta.fields.map((f) => [f.key, cfg[f.key] ?? ""])));
  const [token, setToken] = useState("");
  const [result, setResult] = useState<IntegrationCheck | null>(null);
  const save = useMutation({
    mutationFn: () =>
      api.put<IntegrationCheck>(`/clients/${clientId}/integrations/${kind}`, {
        config: values,
        token: token.trim() || null,
      } satisfies IntegrationInput),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["integrations", clientId] });
      setToken("");
      setResult(r);
      if (r.ok) {
        toast(r.message);
        onClose();
      }
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const missing = meta.fields.some((f) => f.required && !values[f.key]?.trim()) || (!current?.has_token && !token.trim());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!missing) save.mutate();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={current ? `Edit ${meta.name}` : `Connect ${meta.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`int-${kind}`} busy={save.isPending} disabled={missing}>
            Save and test
          </Button>
        </>
      }
    >
      <form id={`int-${kind}`} onSubmit={submit} className="flex flex-col gap-3">
        {meta.fields.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={values[f.key] ?? ""}
            placeholder={f.placeholder}
            hint={f.hint}
            autoComplete="off"
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
          />
        ))}
        <TextField
          label={current?.has_token ? "New token" : "Token"}
          type="password"
          value={token}
          autoComplete="new-password"
          onChange={(e) => setToken(e.target.value)}
          hint={current?.has_token ? `Leave empty to keep the saved token. ${meta.token}` : meta.token}
        />
        {result && !result.ok ? <p className="rounded-md bg-p1-soft px-3 py-2 text-[13px] text-p1">{result.message}</p> : null}
      </form>
    </Dialog>
  );
}
