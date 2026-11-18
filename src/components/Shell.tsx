import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  ClipboardList,
  FileText,
  Gauge,
  Globe,
  Inbox,
  KeyRound,
  LayoutGrid,
  LineChart,
  ListChecks,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  Monitor,
  Moon,
  PenLine,
  Settings,
  SlidersHorizontal,
  Stethoscope,
  Store,
  Sun,
  Swords,
  X,
} from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { cx, IconButton, Select } from "./ui";
import type { Client } from "@/api-types/Client";
import type { Overview } from "@/api-types/Overview";

type NavItem = { to: string; label: string; icon: typeof Bot; badge?: boolean };
const TOOLS: NavItem[] = [
  { to: "/research/domain", label: "Domain overview", icon: Globe },
  { to: "/research/keywords", label: "Keyword research", icon: KeyRound },
  { to: "/research/backlinks", label: "Backlinks", icon: Link2 },
];
const AGENCY: NavItem[] = [
  { to: "/", label: "All clients", icon: LayoutGrid },
  { to: "/inbox", label: "Human Required", icon: Inbox, badge: true },
  { to: "/clients", label: "Manage clients", icon: Store },
  { to: "/bots", label: "Bots", icon: Bot },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];
/** A client workspace's sections: each is a tab of the client page. */
export const WORKSPACE: { tab: string; label: string; icon: typeof Bot }[] = [
  { tab: "overview", label: "Dashboard", icon: Gauge },
  { tab: "actions", label: "Next actions", icon: ListChecks },
  { tab: "traffic", label: "Traffic", icon: LineChart },
  { tab: "keywords", label: "Keywords", icon: KeyRound },
  { tab: "competitors", label: "Competitors", icon: Swords },
  { tab: "findings", label: "Site audit", icon: Stethoscope },
  { tab: "content", label: "Content", icon: PenLine },
  { tab: "outreach", label: "Outreach", icon: Megaphone },
  { tab: "setup", label: "Setup", icon: SlidersHorizontal },
];
const SETUP_TABS = [
  "setup",
  "bots",
  "connections",
  "code",
  "targets",
  "assets",
  "brand",
];

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Client[]>("/clients", { limit: 200 }),
  });
}

/**
 * Atelier's mark: a needle with a thread running through its eye, the workshop the name comes
 * from. Drawn in the accent, never a letter in a box.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0 text-denim"
    >
      <path
        d="M12 2.5c1.6 0 2.6 1.3 2.6 3v13.2L12 21.5l-2.6-2.8V5.5c0-1.7 1-3 2.6-3Z"
        fill="currentColor"
      />
      <ellipse cx="12" cy="6.2" rx="1" ry="2" fill="var(--color-canvas)" />
      <path
        d="M3 15.5c3.5-4.5 7-4.5 9-9.3M12 6.2c2 4.8 5.5 4.8 9 9.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { me, role, clientScope, setClientScope } = useSession();
  const clients = useClients();
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get<Overview>("/overview"),
    refetchInterval: 120_000,
  });
  const openCount = overview.data?.open_human_required ?? 0;

  const navigate = useNavigate();
  const search = useRouterState({
    select: (st) => st.location.search as { tab?: string },
  });
  const live = clients.data?.filter((c) => c.status !== "archived") ?? [];
  const current = live.find((c) => c.id === clientScope);

  const item = (
    { to, label, icon: Icon, badge }: NavItem,
    active: boolean,
    tab?: string,
  ) => (
    <Link
      key={to + (tab ?? "")}
      to={to}
      search={tab ? { tab } : undefined}
      onClick={() => {
        setNavOpen(false);
        if (to === "/") setClientScope("all");
      }}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[14px]",
        active
          ? "bg-active font-medium text-ink"
          : "text-ink-2 hover:bg-active/60 hover:text-ink",
      )}
    >
      <Icon size={16} strokeWidth={1.5} aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {badge && openCount > 0 ? (
        <span
          className="tabular text-[12px] font-medium text-ink-2"
          aria-label={`${openCount} waiting`}
        >
          {openCount}
        </span>
      ) : null}
    </Link>
  );
  const heading = (t: string) => (
    <p className="mt-4 mb-1 truncate px-2.5 text-[11.5px] font-medium tracking-wide text-ink-3 uppercase">
      {t}
    </p>
  );
  const onClientPage = !!current && path === `/clients/${current.id}`;

  const nav = (
    <nav
      aria-label="Main"
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2"
    >
      <label
        htmlFor="workspace"
        className="px-2.5 text-[11.5px] font-medium tracking-wide text-ink-3 uppercase"
      >
        Workspace
      </label>
      <Select
        id="workspace"
        value={current ? current.id : "all"}
        onChange={(e) => {
          const v = e.target.value;
          setClientScope(v);
          setNavOpen(false);
          if (v === "all") navigate({ to: "/" });
          else
            navigate({
              to: "/clients/$clientId",
              params: { clientId: v },
              search: { tab: "overview" },
            });
        }}
        className="mt-1 h-9 w-full bg-surface font-medium"
      >
        <option value="all">All clients (agency)</option>
        {live.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      {current ? (
        <>
          {heading(current.name)}
          {WORKSPACE.map((w) => {
            const tab = search.tab ?? "overview";
            const active =
              onClientPage &&
              (w.tab === "setup" ? SETUP_TABS.includes(tab) : tab === w.tab);
            return item(
              { to: `/clients/${current.id}`, label: w.label, icon: w.icon },
              active,
              w.tab,
            );
          })}
        </>
      ) : null}
      {heading("SEO tools")}
      {TOOLS.map((t) => item(t, path.startsWith(t.to)))}
      {heading("Agency")}
      {AGENCY.map((t) =>
        item(
          t,
          t.to === "/"
            ? path === "/"
            : path.startsWith(t.to) && !(t.to === "/clients" && onClientPage),
        ),
      )}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-5 pt-3.5 pb-4">
      <Mark />
      <div className="min-w-0 leading-tight">
        <p className="text-[15px] font-semibold">Atelier</p>
        <p className="text-[12px] text-ink-3">AheadTech360 bots</p>
      </div>
    </div>
  );

  const account = (
    <div className="mt-auto px-5 py-4">
      <ThemeSwitch />
      <p className="truncate text-[13px]" title={me?.email ?? ""}>
        {me?.email}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-3 capitalize">{role}</span>
        <IconButton label="Sign out" onClick={() => supabase.auth.signOut()}>
          <LogOut size={15} />
        </IconButton>
      </div>
    </div>
  );

  return (
    // One tinted frame holds the sidebar and the top bar; the page is a white sheet inset 8px from
    // the window's right and bottom edges. No rules between frame parts, no shadows.
    <div className="flex min-h-dvh bg-canvas">
      <aside className="sticky top-0 hidden h-dvh w-[228px] shrink-0 flex-col md:flex">
        {brand}
        {nav}
        {account}
      </aside>

      {navOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-canvas">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <IconButton label="Close menu" onClick={() => setNavOpen(false)}>
                <X size={16} />
              </IconButton>
            </div>
            {nav}
            {account}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col md:pr-2 md:pb-2">
        <div className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-canvas px-4 md:px-0">
          <IconButton
            label="Open menu"
            className="md:hidden"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={18} />
          </IconButton>
          <span className="md:hidden">
            <Mark size={20} />
          </span>
          <p className="truncate text-[13px] text-ink-3">
            {current ? (
              <>
                <span className="font-medium text-ink">{current.name}</span>
                <a
                  href={`https://${current.domain}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ml-2 hover:underline"
                >
                  {current.domain}
                </a>
              </>
            ) : (
              "All clients"
            )}
          </p>
        </div>
        <main className="min-w-0 flex-1 bg-surface md:rounded-[var(--radius-sheet)] md:border md:border-line">
          {children}
        </main>
      </div>
    </div>
  );
}

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

/** System, Light or Dark. Remembered in this browser. */
function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="mb-3 flex rounded-md bg-active p-0.5"
    >
      {THEMES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="radio"
          aria-checked={theme === id}
          title={label}
          onClick={() => setTheme(id)}
          className={cx(
            "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[5px] text-[12px]",
            theme === id
              ? "bg-surface font-medium text-ink"
              : "text-ink-3 hover:text-ink",
          )}
        >
          <Icon size={13} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
