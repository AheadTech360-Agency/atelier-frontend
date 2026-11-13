import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, ClipboardList, FileText, Inbox, LayoutGrid, LogOut, Menu, Settings, Store, X } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { cx, IconButton, Select } from "./ui";
import type { Client } from "@/api-types/Client";
import type { Overview } from "@/api-types/Overview";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/inbox", label: "Human Required", icon: Inbox, badge: true },
  { to: "/clients", label: "Clients", icon: Store },
  { to: "/bots", label: "Bots", icon: Bot },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function useClients() {
  return useQuery({ queryKey: ["clients"], queryFn: () => api.get<Client[]>("/clients", { limit: 200 }) });
}

export function Shell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { me, role, clientScope, setClientScope } = useSession();
  const clients = useClients();
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get<Overview>("/overview"),
    refetchInterval: 60_000,
  });
  const openCount = overview.data?.open_human_required ?? 0;

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5 p-2">
      {NAV.map(({ to, label, icon: Icon, ...rest }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setNavOpen(false)}
            className={cx(
              "flex h-9 items-center gap-2.5 rounded-md px-2.5",
              active ? "bg-denim-soft font-medium text-denim" : "text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden />
            <span className="flex-1">{label}</span>
            {"badge" in rest && openCount > 0 ? (
              <span className="tabular rounded-sm bg-denim px-1.5 text-[12px] font-semibold text-white">{openCount}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="px-4 pt-4 pb-2">
          <p className="font-semibold tracking-[-0.01em]">Atelier</p>
          <p className="text-[12.5px] text-ink-3">AheadTech360</p>
        </div>
        {nav}
        <div className="mt-auto border-t border-line p-3">
          <p className="truncate text-[13px]" title={me?.email ?? ""}>
            {me?.email}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-ink-3 capitalize">{role}</span>
            <IconButton label="Sign out" onClick={() => supabase.auth.signOut()}>
              <LogOut size={15} />
            </IconButton>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface">
            <div className="flex items-center justify-between px-4 pt-3">
              <p className="font-semibold">Atelier</p>
              <IconButton label="Close menu" onClick={() => setNavOpen(false)}>
                <X size={16} />
              </IconButton>
            </div>
            {nav}
            <div className="mt-auto border-t border-line p-3">
              <button className="flex items-center gap-2 text-ink-2" onClick={() => supabase.auth.signOut()}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6">
          <IconButton label="Open menu" className="md:hidden" onClick={() => setNavOpen(true)}>
            <Menu size={18} />
          </IconButton>
          <label htmlFor="client-scope" className="text-[13px] text-ink-3 max-sm:sr-only">
            Client
          </label>
          <Select
            id="client-scope"
            value={clientScope}
            onChange={(e) => setClientScope(e.target.value)}
            className="h-8 w-72 max-w-[60vw]"
          >
            <option value="all">All clients</option>
            {clients.data
              ?.filter((c) => c.status !== "archived")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
