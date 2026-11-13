import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useClients } from "@/components/Shell";
import { Button, Dialog, EmptyState, ErrorNote, PageHeader, Skeleton, StatusBadge, TextField, errorText, useToast } from "@/components/ui";
import type { Client } from "@/api-types/Client";
import type { ClientInput } from "@/api-types/ClientInput";

export function ClientsPage() {
  const { isAdmin } = useSession();
  const clients = useClients();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Each client keeps its own credentials, sites, images, brand rules and bot memory."
        actions={isAdmin ? <Button variant="primary" onClick={() => setAdding(true)}>Add client</Button> : null}
      />
      {clients.isLoading ? (
        <Skeleton />
      ) : clients.error ? (
        <ErrorNote error={clients.error} />
      ) : !clients.data?.length ? (
        <EmptyState
          title="No clients yet"
          body="Add your first client, then connect Shopify and Search Console so the bots have data to work with."
          action={isAdmin ? <Button variant="primary" onClick={() => setAdding(true)}>Add client</Button> : null}
        />
      ) : (
        <ul className="divide-y divide-line">
          {clients.data.map((c) => (
            <li key={c.id}>
              <Link
                to="/clients/$clientId"
                params={{ clientId: c.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-sunken md:px-6"
              >
                <span className="font-medium">{c.name}</span>
                <span className="truncate text-ink-3">{c.domain}</span>
                <span className="ml-auto">
                  <StatusBadge s={c.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ClientDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

export function ClientDialog({ open, onClose, client }: { open: boolean; onClose: () => void; client?: Client }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<ClientInput>({
    name: client?.name ?? "",
    domain: client?.domain ?? "",
    status: client?.status ?? "active",
    timezone: client?.timezone ?? "America/New_York",
    notes: client?.notes ?? "",
  });
  const save = useMutation({
    mutationFn: () => (client ? api.put<Client>(`/clients/${client.id}`, form) : api.post<Client>("/clients", form)),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", c.id] });
      toast(client ? "Client saved" : `${c.name} added`);
      onClose();
      if (!client) navigate({ to: "/clients/$clientId", params: { clientId: c.id }, search: { tab: "connections" } });
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const set = (k: keyof ClientInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={client ? "Edit client" : "Add client"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" form="client-form" type="submit" busy={save.isPending}>
            {client ? "Save client" : "Add client"}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="flex flex-col gap-3">
        <TextField label="Brand name" required value={form.name} onChange={set("name")} />
        <TextField label="Store domain" required placeholder="brand.com" value={form.domain} onChange={set("domain")} />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Status
            <select value={form.status ?? "active"} onChange={set("status")} className="h-9 rounded-md border border-line-strong bg-surface px-2 font-normal">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="prospect">Prospect</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <TextField label="Time zone" value={form.timezone ?? ""} onChange={set("timezone")} hint="IANA name, e.g. America/Los_Angeles" />
        </div>
        <TextField label="Notes" value={form.notes ?? ""} onChange={set("notes")} />
      </form>
    </Dialog>
  );
}
