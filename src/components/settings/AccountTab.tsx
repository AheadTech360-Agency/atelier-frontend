import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { humanize } from "@/lib/format";
import { Badge, Button, ErrorNote, Panel, Skeleton, TextField, errorText, useToast } from "../ui";
import type { NotificationStatus } from "@/api-types/NotificationStatus";
import type { DigestSent } from "@/api-types/DigestSent";

const MIN = 10;

export function AccountTab() {
  const { me, role } = useSession();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");

  const tooShort = next.length > 0 && next.length < MIN;
  const mismatch = again.length > 0 && again !== next;
  const same = next.length > 0 && next === current;
  const ready = current.length > 0 && next.length >= MIN && next === again && !same;

  const save = useMutation({
    mutationFn: () => api.put("/me/password", { current_password: current, new_password: next }),
    onSuccess: () => {
      toast("Password changed. Use the new one next time you sign in.");
      setCurrent("");
      setNext("");
      setAgain("");
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) save.mutate();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title="My account">
        <dl className="grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-ink-3">Email</dt>
            <dd className="font-medium">{me?.email}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-3">Role</dt>
            <dd>
              <Badge tone="denim">{humanize(role)}</Badge>
            </dd>
          </div>
        </dl>
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-2">Only an admin can change your email or role.</p>
      </Panel>

      <Panel title="Change password">
        <form onSubmit={submit} className="flex flex-col gap-3 p-4">
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            hint={`At least ${MIN} characters.`}
            error={tooShort ? `Use at least ${MIN} characters.` : same ? "Pick a password you haven't used here." : null}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <TextField
            label="Repeat new password"
            type="password"
            autoComplete="new-password"
            required
            error={mismatch ? "The two new passwords don't match." : null}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
          <Button type="submit" variant="primary" busy={save.isPending} disabled={!ready}>
            Change password
          </Button>
        </form>
      </Panel>
    </div>
  );
}

export function NotificationsTab() {
  const toast = useToast();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api.get<NotificationStatus>("/notifications") });
  const test = useMutation({
    mutationFn: () => api.post("/notifications/test"),
    onSuccess: () => toast("Test message sent to Slack"),
    onError: (e) => toast(errorText(e), "error"),
  });
  const digest = useMutation({
    mutationFn: () => api.post<DigestSent>("/notifications/digest"),
    onSuccess: (r) => toast(`Digest sent to Slack (${r.open_items} open items)`),
    onError: (e) => toast(errorText(e), "error"),
  });

  if (q.isLoading) return <Skeleton rows={3} />;
  if (q.error) return <ErrorNote error={q.error} />;
  const s = q.data!;

  return (
    <Panel title="Slack notifications">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          {s.slack_configured ? <Badge tone="ok">On</Badge> : <Badge>Off</Badge>}
          <span className="text-ink-2">
            {s.slack_configured
              ? "P1 items post to Slack as soon as a bot raises them."
              : "Off until an engineer connects Slack. See the setup note below."}
          </span>
        </div>
        <ul className="list-disc pl-5 text-[13px] text-ink-2">
          <li>P1 alert: client name, bot, issue title and a link. Never drafts or other client data.</li>
          <li>
            Daily digest at {String(s.digest_hour_utc).padStart(2, "0")}:00 UTC: open items by priority, and anything open 3 days or more.
          </li>
          {!s.dashboard_url_set ? <li>Links in Slack won't open the dashboard yet. See the setup note below.</li> : null}
        </ul>
        {!s.slack_configured || !s.dashboard_url_set ? (
          <details className="rounded-md border border-line text-[13px]">
            <summary className="cursor-pointer px-3 py-2 font-medium text-ink-2 hover:text-ink">Setup note for an engineer</summary>
            <ul className="list-disc border-t border-line py-2 pr-3 pl-8 text-ink-2">
              {!s.slack_configured ? <li>Set SLACK_WEBHOOK_URL on the backend and restart it.</li> : null}
              {!s.dashboard_url_set ? <li>Set DASHBOARD_URL to the live dashboard address.</li> : null}
              <li>DIGEST_HOUR_UTC changes the digest time.</li>
            </ul>
          </details>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!s.slack_configured} busy={test.isPending} onClick={() => test.mutate()}>
            Send test message
          </Button>
          <Button disabled={!s.slack_configured} busy={digest.isPending} onClick={() => digest.mutate()}>
            Send digest now
          </Button>
        </div>
      </div>
    </Panel>
  );
}
