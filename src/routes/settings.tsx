import { useState, type FormEvent } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { api } from "@/lib/api";
import { usePagedList } from "@/lib/paged";
import { useSession } from "@/lib/session";
import { AGENTS, agentName, ago, humanize } from "@/lib/format";
import { useClients } from "@/components/Shell";
import {
  Badge,
  Button,
  ConfirmDelete,
  Dialog,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  LoadMore,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  Tabs,
  TextField,
  errorText,
  useToast,
} from "@/components/ui";
import { AccountTab, NotificationsTab } from "@/components/settings/AccountTab";
import type { TeamMember } from "@/api-types/TeamMember";
import type { AgentKey } from "@/api-types/AgentKey";
import type { CreatedAgentKey } from "@/api-types/CreatedAgentKey";
import type { AuditEntry } from "@/api-types/AuditEntry";

export function SettingsPage() {
  const { tab = "account" } = useSearch({ from: "/settings" });
  const navigate = useNavigate({ from: "/settings" });
  const { isAdmin } = useSession();
  const tabs = [
    { id: "account", label: "My account" },
    { id: "team", label: "Team" },
    ...(isAdmin
      ? [
          { id: "notifications", label: "Notifications" },
          { id: "keys", label: "Bot keys" },
          { id: "audit", label: "Audit log" },
        ]
      : []),
  ];
  return (
    <div>
      <PageHeader title="Settings" />
      <Tabs tabs={tabs} value={tab} onChange={(t) => navigate({ search: { tab: t } })} />
      <div className="p-4 md:p-6">
        {tab === "account" && <AccountTab />}
        {tab === "team" && <TeamTab />}
        {tab === "notifications" && isAdmin && <NotificationsTab />}
        {tab === "keys" && isAdmin && <KeysTab />}
        {tab === "audit" && isAdmin && <AuditTab />}
      </div>
    </div>
  );
}

const ROLE_HELP: Record<string, string> = {
  admin: "Manages clients, logins, bot keys and the team",
  reviewer: "Approves and rejects bot work, uploads images, assigns tasks",
  viewer: "Can look at everything, can't change anything",
};

/** A random starting password the admin can hand over. 16 chars, no look-alike characters. */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function TeamTab() {
  const { isAdmin, me } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["team"], queryFn: () => api.get<TeamMember[]>("/team", { limit: 200 }) });
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "reviewer" });
  const [resetting, setResetting] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const add = useMutation({
    mutationFn: () => api.post<TeamMember>("/team", { ...form, full_name: form.full_name || null }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast(`${m.email} can now sign in as ${m.role === "admin" ? "an admin" : `a ${m.role}`}. Share the password with them directly.`);
      setForm({ email: "", full_name: "", password: "", role: form.role });
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch<TeamMember>(`/team/${id}`, { role }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast(`${m.email} is now ${m.role === "admin" ? "an admin" : `a ${m.role}`}`);
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast(errorText(e), "error");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/team/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast(`${removing?.email ?? "Person"} removed. Their login no longer works.`);
      setRemoving(null);
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Panel title="Team">
        {q.isLoading ? (
          <Skeleton />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : (
          <ul className="divide-y divide-line">
            {q.data!.map((m) => {
              const self = m.user_id === me?.user_id;
              return (
                <li key={m.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.full_name || m.email}
                      {self ? <span className="ml-2 text-[12.5px] font-normal text-ink-3">You</span> : null}
                    </p>
                    {m.full_name ? <p className="truncate text-[13px] text-ink-3">{m.email}</p> : null}
                  </div>
                  {isAdmin && !self ? (
                    <>
                      <Select
                        aria-label={`Role for ${m.email}`}
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ id: m.user_id, role: e.target.value })}
                        className="h-8 w-auto"
                      >
                        <option value="admin">Admin</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="viewer">Viewer</option>
                      </Select>
                      <Button size="sm" onClick={() => setResetting(m)}>
                        Reset password
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Badge>{humanize(m.role)}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {isAdmin ? (
        <Panel title="Add a person">
          <form onSubmit={submit} className="flex flex-col gap-3 p-4">
            <p className="text-[13px] text-ink-2">
              They can sign in right away with this email and password. No email is sent, so share the password with them yourself.
            </p>
            <TextField label="Work email" type="email" required autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField label="Name" hint="Optional" autoComplete="off" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Field label="Password" htmlFor="new-password" hint="At least 10 characters. Only admins can change it later.">
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="font-mono text-[13px]"
                />
                <Button type="button" onClick={() => setForm({ ...form, password: generatePassword() })}>
                  Generate
                </Button>
              </div>
            </Field>
            <Field label="Role" htmlFor="new-role" hint={ROLE_HELP[form.role]}>
              <Select id="new-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="reviewer">Reviewer</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <Button type="submit" variant="primary" busy={add.isPending} disabled={form.password.length < 10}>
              Add person
            </Button>
          </form>
        </Panel>
      ) : null}

      {resetting ? <ResetPassword member={resetting} onClose={() => setResetting(null)} /> : null}
      <ConfirmDelete
        open={!!removing}
        onClose={() => setRemoving(null)}
        thing="person"
        name={removing?.email ?? ""}
        consequence="Their login is deleted and they lose access right away. Their past approvals stay in the audit log."
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.user_id)}
      />
    </div>
  );
}

function ResetPassword({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState(generatePassword);
  const save = useMutation({
    mutationFn: () => api.put(`/team/${member.user_id}/password`, { password }),
    onSuccess: () => {
      toast(`Password changed for ${member.email}. Share the new one with them directly.`);
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Reset password for ${member.full_name || member.email}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={save.isPending} disabled={password.length < 10} onClick={() => save.mutate()}>
            Set new password
          </Button>
        </>
      }
    >
      <Field label="New password" htmlFor="reset-pw" hint="At least 10 characters. Their old password stops working immediately.">
        <div className="flex gap-2">
          <Input id="reset-pw" autoComplete="new-password" spellCheck={false} value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-[13px]" />
          <Button type="button" onClick={() => setPassword(generatePassword())}>
            Generate
          </Button>
          <Button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(password).then(
                () => toast("Password copied"),
                () => toast("Copy failed. Select it and copy manually.", "error"),
              )
            }
          >
            <Copy size={14} /> Copy
          </Button>
        </div>
      </Field>
    </Dialog>
  );
}

function KeysTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const clients = useClients();
  const q = useQuery({ queryKey: ["keys"], queryFn: () => api.get<AgentKey[]>("/agent-keys", { limit: 200 }) });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedAgentKey | null>(null);
  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/agent-keys/${id}/revoke`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["keys"] });
      toast("Key revoked. The bot is disconnected.");
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const clientNames = (ids: string[] | null) => (ids ? ids.map((id) => clients.data?.find((c) => c.id === id)?.name ?? "Unknown").join(", ") : "All clients");

  return (
    <Panel title="Bot API keys" actions={<Button size="sm" variant="primary" onClick={() => setCreating(true)}>Create key</Button>}>
      <p className="border-b border-line px-4 py-2.5 text-[13px] text-ink-2">
        Give each bot its own key. In Rakazo, add this server under Integrations as an HTTPS MCP server and send the key as{" "}
        <code className="rounded bg-sunken px-1">Authorization: Bearer &lt;key&gt;</code>.
      </p>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.data?.length ? (
        <EmptyState title="No keys yet" body="Create one key per bot. You'll see each key once, right after creating it." />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {agentName(k.agent_id)} {k.label ? <span className="font-normal text-ink-2">{k.label}</span> : null}
                </p>
                <p className="text-[12.5px] text-ink-3">
                  <code>{k.key_prefix}…</code>, {clientNames(k.client_ids)}, last used {ago(k.last_used_at)}
                </p>
              </div>
              {k.revoked_at ? (
                <Badge tone="p1">Revoked {ago(k.revoked_at)}</Badge>
              ) : (
                <Button size="sm" variant="danger" busy={revoke.isPending && revoke.variables === k.id} onClick={() => revoke.mutate(k.id)}>
                  Revoke {k.key_prefix}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <CreateKey
          onClose={() => setCreating(false)}
          onCreated={(k) => {
            setCreating(false);
            setCreated(k);
            qc.invalidateQueries({ queryKey: ["keys"] });
          }}
        />
      ) : null}
      {created ? <ShowKey created={created} onClose={() => setCreated(null)} /> : null}
    </Panel>
  );
}

function CreateKey({ onClose, onCreated }: { onClose: () => void; onCreated: (k: CreatedAgentKey) => void }) {
  const clients = useClients();
  const toast = useToast();
  const [agent, setAgent] = useState("seo_lead");
  const [label, setLabel] = useState("Rakazo");
  const [scope, setScope] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: () => api.post<CreatedAgentKey>("/agent-keys", { agent_id: agent, label, client_ids: scope.length ? scope : null }),
    onSuccess: onCreated,
    onError: (e) => toast(errorText(e), "error"),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Create a bot key"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={create.isPending} onClick={() => create.mutate()}>
            Create key
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Bot" htmlFor="key-bot">
          <Select id="key-bot" value={agent} onChange={(e) => setAgent(e.target.value)}>
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <TextField label="Label" value={label} onChange={(e) => setLabel(e.target.value)} hint="Where this key is used, e.g. Rakazo production" />
        <fieldset>
          <legend className="text-[13px] font-medium">Clients</legend>
          <p className="mb-1.5 text-[12.5px] text-ink-3">Leave all unticked to allow every client.</p>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {clients.data?.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={scope.includes(c.id)}
                  onChange={(e) => setScope(e.target.checked ? [...scope, c.id] : scope.filter((x) => x !== c.id))}
                  className="size-4 accent-[var(--color-denim)]"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}

function ShowKey({ created, onClose }: { created: CreatedAgentKey; onClose: () => void }) {
  const toast = useToast();
  return (
    <Dialog open onClose={onClose} title={`Key for ${agentName(created.key.agent_id)}`} footer={<Button variant="primary" onClick={onClose}>I've stored the key</Button>}>
      <p className="mb-3 text-ink-2">Copy it into the bot's MCP integration in Rakazo now. It won't be shown again; if it's lost, revoke it and create a new one.</p>
      <div className="flex items-center gap-2 rounded-md border border-line bg-sunken p-2">
        <code className="min-w-0 flex-1 break-all text-[13px]">{created.secret}</code>
        <Button
          size="sm"
          onClick={() => navigator.clipboard.writeText(created.secret).then(() => toast("Key copied"), () => toast("Copy failed. Select the key and copy it manually.", "error"))}
        >
          <Copy size={14} /> Copy key
        </Button>
      </div>
    </Dialog>
  );
}

function AuditTab() {
  const clients = useClients();
  const q = usePagedList<AuditEntry>(["audit"], "/audit-log", {}, 50);
  const clientName = (id: string | null) => (id ? (clients.data?.find((c) => c.id === id)?.name ?? "") : "");
  return (
    <Panel title="Audit log">
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.items.length ? (
        <EmptyState title="Nothing logged yet" body="Credential reads, approvals, publish checks and key changes are recorded here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Who</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Client</th>
              </tr>
            </thead>
            <tbody>
              {q.items.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap text-ink-2" title={e.created_at}>
                    {ago(e.created_at)}
                  </td>
                  <td className="px-4 py-2">{e.actor_type === "agent" ? agentName(e.actor_id) : e.actor_type === "user" ? "Team member" : "System"}</td>
                  <td className="px-4 py-2">{humanize(e.action.replace(".", " "))}</td>
                  <td className="px-4 py-2 text-ink-2">{clientName(e.client_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
    </Panel>
  );
}
