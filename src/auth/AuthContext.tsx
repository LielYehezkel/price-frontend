import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { UserOut } from "../api/apiSaaS";
import { apiMe } from "../api/apiSaaS";

const STORAGE = "pr_access_token";

type AuthState = {
  token: string | null;
  user: UserOut | null;
  loading: boolean;
  setToken: (t: string | null) => void;
  /** אם מועבירים טוקן — משתמשים בו ל־apiMe (אחרי login לפני עדכון state). */
  refresh: (tokenOverride?: string | null) => Promise<UserOut | null>;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(STORAGE));
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem(STORAGE, t);
    else localStorage.removeItem(STORAGE);
  }, []);

  const refresh = useCallback(
    async (tokenOverride?: string | null) => {
      const t = tokenOverride !== undefined ? tokenOverride : token;
      if (!t) {
        setUser(null);
        setLoading(false);
        return null;
      }
      try {
        const u = await apiMe(t);
        setUser(u);
        return u;
      } catch {
        setToken(null);
        setUser(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [token, setToken],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setToken]);

  const v = useMemo(
    () => ({ token, user, loading, setToken, refresh, logout }),
    [token, user, loading, setToken, refresh, logout],
  );

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const x = useContext(Ctx);
  if (!x) throw new Error("useAuth outside provider");
  return x;
}
