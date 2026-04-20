import { trpc } from "@/lib/trpc";
import { useEffect, useMemo } from "react";

// Key used to persist auth state for eager UI hydration (read-only by consumers).
const AUTH_STATE_KEY = "judge-ai.auth.isAuthenticated";

export function useAuth() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    // Desktop/single-user app: no reason to re-query /auth/me every time the
    // window regains focus. Call refresh() explicitly after login/logout.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Derive auth state as a pure memoised value — no side effects here.
  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      error: meQuery.error,
      isAuthenticated: !!meQuery.data,
    };
  }, [meQuery.data, meQuery.isLoading, meQuery.error]);

  // Persist the authenticated flag so that other parts of the app can do a
  // cheap synchronous read on startup without waiting for the query.
  // This MUST live in useEffect — writing to localStorage during render is a
  // side effect and would be executed multiple times in React 18 Strict Mode.
  useEffect(() => {
    if (state.loading) return; // don't stomp the value while the query is in flight
    try {
      localStorage.setItem(AUTH_STATE_KEY, state.isAuthenticated ? "1" : "0");
    } catch {
      // Ignore storage restrictions (private browsing, quota exceeded, etc.)
    }
  }, [state.isAuthenticated, state.loading]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
  };
}
