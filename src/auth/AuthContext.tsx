import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import { ApiError, clearToken, getToken, saveToken } from "../api/client";
import type { User } from "../api/types";

// Everything about "who is logged in" lives here.
// Any component can call useAuth() to read the user or open the login window.

interface AuthContextValue {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(getToken());
  const [isLoginOpen, setLoginOpen] = useState(false);

  // Ask the backend who we are, but only if we have a token.
  const me = useQuery({
    queryKey: ["me", token],
    queryFn: authApi.getMe,
    enabled: !!token,
    retry: false,
  });

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: ["me"] });
  }, [queryClient]);

  // An old or expired token: forget it.
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) logout();
  }, [me.error, logout]);

  const finishAuth = (res: { accessToken: string; user: User }) => {
    saveToken(res.accessToken);
    queryClient.setQueryData(["me", res.accessToken], res.user);
    setToken(res.accessToken);
    setLoginOpen(false);
  };

  const value: AuthContextValue = {
    user: token ? me.data ?? null : null,
    isLoggedIn: !!token,
    login: async (email, password) => finishAuth(await authApi.login(email, password)),
    register: async (email, password) => finishAuth(await authApi.register(email, password)),
    logout,
    isLoginOpen,
    openLogin: () => setLoginOpen(true),
    closeLogin: () => setLoginOpen(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
