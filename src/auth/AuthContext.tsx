import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import { ApiError, TOKEN_KEY, clearToken, getToken, saveToken, onAuthFailure, onStoredTokenChange } from "../api/client";
import type { User } from "../api/types";

// Everything about "who is logged in" lives here.
// Any component can call useAuth() to read the user or open the login window.

interface AuthContextValue {
  user: User | null;
  isLoggedIn: boolean;
  isUserLoading: boolean;
  userError: unknown;
  sessionError?: string;
  refetchUser: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  // Switch to a token the backend issued for this user, e.g. after a role change.
  adoptToken: (accessToken: string) => void;
  isLoginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(getToken());
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [sessionError, setSessionError] = useState("");

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
    // Drop private data when switching accounts, including pending requests.
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => onAuthFailure(message => {
    setSessionError(message);
    logout();
  }), [logout]);

  // Another tab signed out, or into another account: follow the saved token and drop this
  // tab's private data, including requests still in flight with the old token.
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const syncStoredToken = useCallback(() => {
    const stored = getToken();
    if (stored === tokenRef.current) return;
    tokenRef.current = stored;
    void queryClient.cancelQueries();
    queryClient.clear();
    setToken(stored);
  }, [queryClient]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // key is null when another tab cleared all of localStorage.
      if (event.key === null || event.key === TOKEN_KEY) syncStoredToken();
    };
    window.addEventListener("storage", onStorage);
    const stopListening = onStoredTokenChange(syncStoredToken);
    return () => {
      window.removeEventListener("storage", onStorage);
      stopListening();
    };
  }, [syncStoredToken]);

  // An old or expired token: forget it.
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) logout();
  }, [me.error, logout]);

  const adoptToken = useCallback((accessToken: string) => {
    // Cached data was loaded with the old role; reload everything with the new token.
    void queryClient.cancelQueries();
    queryClient.clear();
    saveToken(accessToken);
    setToken(accessToken);
  }, [queryClient]);

  const finishAuth = (res: { accessToken: string; user: User }) => {
    setSessionError("");
    queryClient.clear();
    saveToken(res.accessToken);
    queryClient.setQueryData(["me", res.accessToken], res.user);
    setToken(res.accessToken);
    setLoginOpen(false);
  };

  const value: AuthContextValue = {
    user: token ? me.data ?? null : null,
    isLoggedIn: !!token,
    isUserLoading: !!token && me.isLoading,
    userError: me.error,
    sessionError,
    refetchUser: () => { void me.refetch(); },
    login: async (email, password) => finishAuth(await authApi.login(email, password)),
    register: async (email, password) => finishAuth(await authApi.register(email, password)),
    logout,
    adoptToken,
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
