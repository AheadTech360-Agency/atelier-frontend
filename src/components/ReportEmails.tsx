import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useClients } from "@/components/Shell";
import {
  Button,
  Dialog,
  ErrorNote,
  Select,
  Skeleton,
  TextField,
  errorText,
  useToast,
} from "@/components/ui";
import type { ReportRecipient } from "@/api-types/ReportRecipient";
import type { ReportEmail } from "@/api-types/ReportEmail";
import type { RecipientInput } from "@/api-types/RecipientInput";

/** The list of people who get every new bot report by email. */
export function ReportEmailsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Mail size={14} /> Report emails
      </Button>
      {open ? <RecipientsDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function RecipientsDialog({ onClose }: { onClose: () => void }) {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const clients = useClients();
  const list = useQuery({
    queryKey: ["report-recipients"],
    queryFn: () => api.get<ReportRecipient[]>("/report-recipients"),
  });
  const [email, setEmail] = useState("");
  const [client, setClient] = useState("");
  const clientName = (id: string | null) =>
    id
      ? (clients.data?.find((c) => c.id === id)?.name ?? "One client")
      : "All clients";

  const add = useMutation({
    mutationFn: () => {
      const body: RecipientInput = {
        email: email.trim(),
        ...(client ? { client_id: client } : {}),
      };
      return api.post<ReportRecipient>("/report-recipients", body);
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["report-recipients"] });
      toast(`${r.email} added`);
      setEmail("");
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/report-recipients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-recipients"] }),
    onError: (e) => toast(errorText(e), "error"),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) add.mutate();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Report emails"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p className="text-[13px] text-ink-2">
        Every new report a bot submits is emailed to these addresses, with a
        link back to Atelier. Each person gets their own email.
      </p>
      {list.isLoading ? (
        <Skeleton rows={2} />
      ) : list.error ? (
        <ErrorNote error={list.error} />
      ) : !list.data?.length ? (
        <p className="rounded-md bg-sunken px-3 py-2 text-[13px] text-ink-3">
          No one gets report emails yet.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {list.data.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 px-3 py-2 text-[13.5px]"
            >
              <span className="min-w-0 flex-1 truncate">{r.email}</span>
              <span className="text-[12.5px] text-ink-3">
                {clientName(r.client_id)}
              </span>
              {isAdmin ? (
                <button
                  type="button"
                  aria-label={`Remove ${r.email}`}
                  className="rounded p-1 text-ink-3 hover:bg-sunken hover:text-ink"
                  onClick={() => remove.mutate(r.id)}
                >
                  <X size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {isAdmin ? (
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 border-t border-line pt-3"
        >
          <TextField
            label="Email"
            type="email"
            required
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Reports for
            <Select value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="">All clients</option>
              {(clients.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="primary"
            type="submit"
            busy={add.isPending}
            className="self-start"
          >
            Add email
          </Button>
        </form>
      ) : (
        <p className="text-[12.5px] text-ink-3">
          An admin can add or remove addresses.
        </p>
      )}
    </Dialog>
  );
}

/** Who a report was emailed to, and a button to send it again. */
export function ReportEmailStatus({ reportId }: { reportId: string }) {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const sent = useQuery({
    queryKey: ["report-emails", reportId],
    queryFn: () => api.get<ReportEmail[]>(`/reports/${reportId}/emails`),
  });
  const resend = useMutation({
    mutationFn: () => api.post<ReportEmail[]>(`/reports/${reportId}/emails`),
    onSuccess: (rows) => {
      qc.setQueryData(["report-emails", reportId], rows);
      const failed = rows.filter((r) => r.status === "failed").length;
      toast(
        rows.length
          ? failed
            ? `${failed} email${failed > 1 ? "s" : ""} failed`
            : "Report emailed"
          : "No one is on the report email list",
        failed ? "error" : undefined,
      );
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const rows = sent.data ?? [];
  // Latest attempt per address.
  const latest = [...new Map(rows.map((r) => [r.email, r])).values()];
  const failed = latest.filter((r) => r.status === "failed");

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3 print:hidden">
      {latest.length ? (
        <span>
          Emailed to{" "}
          {latest
            .filter((r) => r.status === "sent")
            .map((r) => r.email)
            .join(", ") || "no one"}
          {latest[0] ? `, ${ago(latest[0].sent_at)}` : ""}
          {failed.length ? (
            <span className="text-p1">
              {" "}
              · Failed:{" "}
              {failed
                .map((r) => `${r.email} (${r.error ?? "error"})`)
                .join(", ")}
            </span>
          ) : null}
        </span>
      ) : (
        <span>Not emailed yet</span>
      )}
      {isAdmin ? (
        <Button
          size="sm"
          variant="ghost"
          busy={resend.isPending}
          onClick={() => resend.mutate()}
        >
          <Send size={13} /> Email it now
        </Button>
      ) : null}
    </div>
  );
}
