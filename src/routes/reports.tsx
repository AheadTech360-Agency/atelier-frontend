import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { usePagedList } from "@/lib/paged";
import { useScopedClient } from "@/lib/session";
import { agentName, ago, dateLabel, humanize, phrase } from "@/lib/format";
import { useClients } from "@/components/Shell";
import { DeleteButton } from "@/components/DeleteButton";
import {
  Button,
  EmptyState,
  ErrorNote,
  LoadMore,
  PageHeader,
  Select,
  Skeleton,
  cx,
} from "@/components/ui";
import type { Report } from "@/api-types/Report";
import { usePageTitle } from "@/lib/title";
import {
  ReportEmailStatus,
  ReportEmailsButton,
} from "@/components/ReportEmails";

const TYPES = [
  "weekly_summary",
  "monthly_ai_visibility",
  "technical_audit",
  "prospect_audit",
  "other",
];

export function ReportsPage() {
  usePageTitle("Reports");
  const { id: picked, type } = useSearch({ from: "/reports" });
  const navigate = useNavigate({ from: "/reports" });
  const clientId = useScopedClient();
  const clients = useClients();
  const list = usePagedList<Report>(["reports", clientId], "/reports", {
    client_id: clientId,
    report_type: type,
  });
  // On wide screens, open the newest report instead of an empty pane.
  const wide =
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches;
  const id = picked ?? (wide ? list.items[0]?.id : undefined);
  const report = useQuery({
    queryKey: ["report", id],
    queryFn: () => api.get<Report>(`/reports/${id}`),
    enabled: !!id,
  });
  const clientName = (cid: string) =>
    clients.data?.find((c) => c.id === cid)?.name ?? "";

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Weekly client summaries from the SEO Lead, monthly AI visibility, audits."
          actions={
            <>
              <ReportEmailsButton />
              <Select
                aria-label="Report type"
                value={type ?? ""}
                onChange={(e) =>
                  navigate({ search: { type: e.target.value || undefined } })
                }
                className="w-auto"
              >
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </Select>
            </>
          }
        />
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className={cx(
            "w-full overflow-y-auto border-r border-line lg:w-[340px] lg:shrink-0 print:hidden",
            id && "max-lg:hidden",
          )}
        >
          {list.isLoading ? (
            <Skeleton />
          ) : list.error ? (
            <ErrorNote error={list.error} />
          ) : !list.items.length ? (
            <EmptyState
              title="No reports yet"
              body="Bots submit reports through MCP. The first weekly summary arrives after the SEO Lead's first weekly run."
            />
          ) : (
            <ul>
              {list.items.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() =>
                      navigate({ search: (s) => ({ ...s, id: r.id }) })
                    }
                    aria-current={r.id === id || undefined}
                    className={cx(
                      "block w-full border-b border-line px-5 py-3 text-left",
                      r.id === id ? "bg-active" : "hover:bg-sunken",
                    )}
                  >
                    <span className="block truncate font-medium">
                      {r.title}
                    </span>
                    <span className="text-[12.5px] text-ink-3">
                      {clientName(r.client_id)}, {phrase(r.report_type)},{" "}
                      {ago(r.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <LoadMore
            hasMore={list.hasMore}
            loading={list.loadingMore}
            onClick={list.loadMore}
          />
        </div>
        <div
          className={cx(
            "min-w-0 flex-1 overflow-y-auto bg-surface",
            !id && "max-lg:hidden",
          )}
        >
          {!id ? (
            <EmptyState title="Select a report" />
          ) : report.isLoading ? (
            <Skeleton rows={8} />
          ) : report.error ? (
            <ErrorNote error={report.error} />
          ) : (
            <article className="px-5 py-6 md:px-8 lg:px-10">
              <div className="mb-4 flex items-center gap-2 print:hidden">
                <Button
                  size="sm"
                  variant="ghost"
                  className="lg:hidden"
                  onClick={() =>
                    navigate({ search: (s) => ({ ...s, id: undefined }) })
                  }
                >
                  <ArrowLeft size={14} /> Back
                </Button>
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => window.print()}
                >
                  <Printer size={14} /> Save as PDF
                </Button>
                <DeleteButton
                  labelled
                  path={`/reports/${report.data!.id}`}
                  thing="report"
                  name={report.data!.title}
                  consequence="The SEO Lead can't use it in later summaries."
                  invalidate={["reports"]}
                  onDeleted={() =>
                    navigate({ search: (s) => ({ ...s, id: undefined }) })
                  }
                />
              </div>
              <p className="text-[13px] text-ink-3">
                {clientName(report.data!.client_id)},{" "}
                {phrase(report.data!.report_type)} from{" "}
                {agentName(report.data!.agent_id)}
                {report.data!.period_start
                  ? `, ${dateLabel(report.data!.period_start)} to ${dateLabel(report.data!.period_end)}`
                  : ""}
              </p>
              <h2 className="mt-1 mb-2 text-[22px] font-semibold tracking-[-0.01em]">
                {report.data!.title}
              </h2>
              <ReportEmailStatus reportId={report.data!.id} />
              <div className="proof">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {report.data!.body_markdown}
                </Markdown>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
