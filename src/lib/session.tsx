import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { api } from "./api";
import type { Me } from "@/api-types/Me";

type Ctx = {
  session: Session | null;
  loading: boolean;
  /** Signed in, but the backend couldn't be reached or failed. Not the same as "no role". */
  meError: unknown;
  retryMe: () => void;
  me: Me | undefined;
  role: string | null;
  isAdmin: boolean;
  canReview: boolean;
  clientScope: string; // "all" or a client id
  setClientScope: (id: string) => void;
};

const SessionCtx = createContext<Ctx | null>(null);

function readScope(): string {
  try {
    return localStorage.getItem("clientScope") ?? "all";
  } catch {
    return "all";
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientScope, setScope] = useState(readScope);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const me = useQuery({
    queryKey: ["me", session?.user.id],
    queryFn: () => api.get<Me>("/me"),
    enabled: !!session,
  });

  const role = me.data?.role ?? null;
  const setClientScope = (id: string) => {
    setScope(id);
    try {
      localStorage.setItem("clientScope", id);
    } catch {
      /* private mode: scope just isn't remembered */
    }
  };

  return (
    <SessionCtx.Provider
      value={{
        session,
        loading: loading || (!!session && me.isLoading),
        meError: me.error,
        retryMe: () => void me.refetch(),
        me: me.data,
        role,
        isAdmin: role === "admin",
        canReview: role === "admin" || role === "reviewer",
        clientScope,
        setClientScope,
      }}
    >
      {children}
    </SessionCtx.Provider>
  );
}

export function useSession(): Ctx {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession outside SessionProvider");
  return c;
}

/** Client filter value for API queries: undefined when "all". */
export function useScopedClient(): string | undefined {
  const { clientScope } = useSession();
  return clientScope === "all" ? undefined : clientScope;
}
