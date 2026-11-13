import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { agentName, ago } from "@/lib/format";
import { AgentPicker } from "../AgentPicker";
import {
  Button,
  ConfirmDelete,
  Dialog,
  EmptyState,
  ErrorNote,
  Field,
  IconButton,
  Panel,
  Select,
  Skeleton,
  StatusBadge,
  TextField,
  Textarea,
  errorText,
  useToast,
} from "../ui";
import type { Connection } from "@/api-types/Connection";
import type { ConnectionInput } from "@/api-types/ConnectionInput";

export const PLATFORMS: { id: string; label: string; agents: string[] }[] = [
  { id: "shopify", label: "Shopify", agents: ["technical_auditor", "on_page", "content_writer", "ai_search", "local_seo"] },
  { id: "gsc", label: "Google Search Console", agents: ["seo_lead", "technical_auditor", "on_page", "content_writer"] },
  { id: "ga4", label: "Google Analytics 4", agents: ["seo_lead"] },
  { id: "merchant_center", label: "Google Merchant Center", agents: ["technical_auditor", "ai_search"] },
  { id: "gbp", label: "Google Business Profile", agents: ["local_seo"] },
  { id: "pinterest", label: "Pinterest", agents: ["off_page"] },
  { id: "medium", label: "Medium", agents: ["off_page"] },
  { id: "linkedin", label: "LinkedIn", agents: ["off_page"] },
  { id: "substack", label: "Substack", agents: ["off_page"] },
  { id: "email", label: "Outreach mailbox", agents: ["off_page"] },
  { id: "rank_tracker", label: "Rank tracker", agents: ["seo_lead", "ai_search", "local_seo"] },
  { id: "backlinks", label: "Backlink tool", agents: ["off_page", "seo_lead"] },
  { id: "directory", label: "Directory listing", agents: ["off_page", "local_seo"] },
  { id: "other", label: "Other", agents: [] },
];

const platformLabel = (id: string) => PLATFORMS.find((p) => p.id === id)?.label ?? id;

export function ConnectionsTab({ clientId }: { clientId: string }) {
  const { isAdmin } = useSession();
  const q = useQuery({ queryKey: ["connections", clientId], queryFn: () => api.get<Connection[]>(`/clients/${clientId}/connections`) });
  const [editing, setEditing] = useState<Connection | "new" | null>(null);
  const [deleting, setDeleting] = useState<Connection | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/connections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections", clientId] });
      toast("Connection deleted");
      setDeleting(null);
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  return (
    <Panel
      title="Logins and API connections"
      actions={isAdmin ? <Button size="sm" variant="primary" onClick={() => setEditing("new")}>Add connection</Button> : null}
    >
      <p className="border-b border-line px-4 py-2.5 text-[13px] text-ink-2">
        Passwords and API keys are encrypted in the vault. Nobody can read them back here; bots fetch them through MCP, and every read is logged.
      </p>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.data?.length ? (
        <EmptyState
          title="No connections yet"
          body="Start with Shopify and Google Search Console. Most bots need those two."
          action={isAdmin ? <Button variant="primary" onClick={() => setEditing("new")}>Add connection</Button> : null}
        />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{platformLabel(c.platform)}</span>
                  {c.label ? <span className="text-ink-2">{c.label}</span> : null}
                  <StatusBadge s={c.status} />
                  {c.has_secret ? (
                    <span className="inline-flex items-center gap-1 text-[12.5px] text-ok">
                      <KeyRound size={12} /> Credential stored
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-p2">No credential yet</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-ink-3">
                  {[c.username, c.url].filter(Boolean).join(" at ") || "No login details"}
                </p>
                {c.status_note ? <p className="mt-0.5 text-[13px] text-p2">{c.status_note}</p> : null}
                <p className="mt-1 text-[12.5px] text-ink-2">
                  Used by {c.allowed_agents.length ? c.allowed_agents.map((a) => agentName(a, true)).join(", ") : "no bots"}. Last used {ago(c.last_used_at)}.
                </p>
              </div>
              {isAdmin ? (
                <div className="flex gap-1">
                  <IconButton label={`Edit ${platformLabel(c.platform)}`} onClick={() => setEditing(c)}>
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton label={`Delete ${platformLabel(c.platform)}`} onClick={() => setDeleting(c)}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? <ConnectionDialog clientId={clientId} conn={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        thing="connection"
        name={deleting ? `${platformLabel(deleting.platform)} ${deleting.label}`.trim() : ""}
        consequence="Bots lose access to this login immediately."
        busy={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </Panel>
  );
}

function ConnectionDialog({ clientId, conn, onClose }: { clientId: string; conn?: Connection; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<ConnectionInput>({
    platform: conn?.platform ?? "shopify",
    label: conn?.label ?? "",
    url: conn?.url ?? "",
    username: conn?.username ?? "",
    allowed_agents: conn?.allowed_agents ?? PLATFORMS[0].agents,
    secret: "",
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, secret: form.secret ? form.secret : null };
      return conn ? api.put<Connection>(`/connections/${conn.id}`, body) : api.post<Connection>(`/clients/${clientId}/connections`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections", clientId] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      toast(conn ? "Connection saved" : "Connection added");
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={conn ? "Edit connection" : "Add connection"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="conn-form" busy={save.isPending}>
            {conn ? "Save connection" : "Add connection"}
          </Button>
        </>
      }
    >
      <form id="conn-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Platform" htmlFor="conn-platform">
          <Select
            id="conn-platform"
            value={form.platform}
            onChange={(e) => {
              const p = PLATFORMS.find((x) => x.id === e.target.value);
              setForm({ ...form, platform: e.target.value, allowed_agents: conn ? form.allowed_agents : (p?.agents ?? []) });
            }}
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <TextField label="Label" hint="Optional, e.g. 'Main store' or 'Soho location'" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <TextField label="Login or API URL" placeholder="https://admin.shopify.com/store/..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <TextField label="Username or account email" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <Field
          label={conn?.has_secret ? "Replace credential" : "Password, token or API key"}
          htmlFor="conn-secret"
          hint={
            conn?.has_secret
              ? "A credential is stored. Leave empty to keep it, or paste a new one to replace it."
              : "Stored encrypted. For several values, paste JSON like {\"api_key\": \"...\", \"password\": \"...\"}."
          }
        >
          <Textarea
            id="conn-secret"
            autoComplete="off"
            spellCheck={false}
            className="min-h-16 font-mono text-[13px] [-webkit-text-security:disc]"
            value={form.secret ?? ""}
            onChange={(e) => setForm({ ...form, secret: e.target.value })}
          />
        </Field>
        <AgentPicker label="Bots allowed to use this" value={form.allowed_agents} onChange={(v) => setForm({ ...form, allowed_agents: v })} />
      </form>
    </Dialog>
  );
}
