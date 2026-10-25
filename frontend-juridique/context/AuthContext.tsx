"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { api, ApiError, setDelegationUser } from '@/lib/api/client';

export type User = {
  id: number;
  login: string;
  nom: string;
  role: string;
  service: string;
  serviceId?: number;
  permissions?: string[];
};

type AuthContextType = {
  /**
   * The account the UI is working as. Inside a replacement workspace this is the
   * REPLACED agent, not the person at the keyboard, so every permission check and
   * every listing follows that account.
   */
  user: User | null;
  /** The signed-in account, always — used to label the workspace banner. */
  realUser: User | null;
  token: string | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (key: string) => boolean;
  permissions: string[];
  /** Re-fetches the user + permissions from the DB (GET /api/auth/me). */
  refreshUser: () => Promise<void>;
  /** True while the UI is acting as a delegated agent. */
  isImpersonating: boolean;
  /**
   * Open (or leave) the replacement workspace. Entering resolves the replaced
   * agent's own account — including their permissions — through /api/auth/me
   * sent with the delegation header, so the workspace really is that account.
   */
  enterWorkspace: (absentUserId: number) => Promise<User | null>;
  exitWorkspace: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // The signed-in account. `impersonatedUser` is only ever set inside a
  // replacement workspace, and takes precedence while it is.
  const [realUser, setRealUser] = useState<User | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const user = impersonatedUser ?? realUser;

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setRealUser(JSON.parse(storedUser));
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, []);

  const exitWorkspace = useCallback(() => {
    setDelegationUser(null);
    setImpersonatedUser(null);
  }, []);

  // Read through a ref, not state: `refreshUser` must not change identity when
  // the workspace opens, or the effect that calls it would re-trigger on every
  // response and loop forever.
  const impersonatedRef = React.useRef<User | null>(null);
  useEffect(() => {
    impersonatedRef.current = impersonatedUser;
  }, [impersonatedUser]);

  /**
   * Work as the given agent. Setting the delegation BEFORE fetching means the
   * request is already sent on their behalf, so what comes back is their account,
   * their permissions and their data.
   */
  const enterWorkspace = useCallback(
    async (absentUserId: number): Promise<User | null> => {
      setDelegationUser(absentUserId);
      try {
        const data = await api.get<{ user: User }>("/api/auth/me", token);
        setImpersonatedUser(data.user);
        return data.user;
      } catch (err) {
        // No valid delegation (revoked, expired, refused): stay as ourselves.
        setDelegationUser(null);
        setImpersonatedUser(null);
        console.warn('Workspace unavailable:', err instanceof Error ? err.message : err);
        return null;
      }
    },
    [token]
  );

  const login = async (login: string, password: string) => {
    try {
      const data = await api.post<{ token: string; user: User }>(
        "/api/auth/login",
        { Login: login, Password: password }
      );
      setToken(data.token);
      setDelegationUser(null);
      setImpersonatedUser(null);
      setRealUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(err.message || 'Échec de la connexion');
      }
      throw new Error('Échec de la connexion');
    }
  };

  const logout = useCallback(() => {
    setToken(null);
    setDelegationUser(null);
    setImpersonatedUser(null);
    setRealUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const [adminOverrides, setAdminOverrides] = useState<Record<string, boolean>>({});

  const permissions = useMemo(() => user?.permissions || [], [user?.permissions]);

  // Enhanced permission validation with admin override check
  const hasPermission = useCallback((key: string): boolean => {
    if (!user) return false;
    
    // First check if user has the base permission
    if (!permissions.includes(key)) return false;
    
    // If user is admin, check if this permission is overridden
    if (user.role === "Admin") {
      // Check if this permission is in admin overrides (disabled)
      return !adminOverrides[key]; // If not in overrides, it's enabled
    }
    
    return true;
  }, [user, permissions, adminOverrides]);

  // Fetch admin overrides from API.
  // The endpoint serializes camelCase (`permissionKey`, `enabled`) — reading
  // `Key`/`Enabled` silently produced an empty override map, so disabling a
  // permission for the admin account never took effect in the UI.
  const fetchAdminOverrides = useCallback(async () => {
    try {
      const data = await api.get<{
        permissions?: { permissionKey?: string; key?: string; enabled?: boolean }[];
      }>("/api/rbac/permissions/admin", token);
      const overridesMap: Record<string, boolean> = {};
      for (const perm of data.permissions ?? []) {
        const key = perm.permissionKey ?? perm.key;
        if (key && perm.enabled === false) {
          overridesMap[key] = false;
        }
      }
      setAdminOverrides(overridesMap);
    } catch (error) {
      // Non-admins get a 403 here — expected, and only logged for diagnosis.
      console.warn('Admin overrides unavailable:', error instanceof Error ? error.message : error);
    }
  }, [token]);

  useEffect(() => {
    if (realUser?.role === "Admin" && token) {
      fetchAdminOverrides();
    }
  }, [realUser?.role, token, fetchAdminOverrides]);

  // Re-fetch the user + permissions from the DB so permission changes made in
  // the admin panel (by another admin) reflect in the UI without re-login.
  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<{ user: User }>("/api/auth/me", token);
      // Inside a workspace this response describes the REPLACED agent, so it must
      // not overwrite the signed-in account.
      if (impersonatedRef.current) {
        setImpersonatedUser(data.user);
        return;
      }
      setRealUser(data.user);
      // Keep the cached copy in sync so the next page load starts from fresh data.
      try {
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch {
        // Ignore storage failures (private mode, quota, ...)
      }
      if (data.user.role === "Admin") {
        await fetchAdminOverrides();
      }
    } catch {
      // Ignore transient failures — the next focus/refresh will retry.
    }
  }, [token, fetchAdminOverrides]);

  // Refresh permissions on every page load. The cached localStorage copy is only
  // a first paint: without this, a permission granted or revoked in the admin
  // panel kept showing the old state after a reload until the user re-logged in.
  useEffect(() => {
    if (token) refreshUser();
  }, [token, refreshUser]);

  // Leaving the session must never leave a delegation header behind.
  useEffect(() => {
    if (!token) exitWorkspace();
  }, [token, exitWorkspace]);

  // Refresh when the window regains focus, throttled to once a minute.
  const lastRefreshRef = React.useRef(0);
  useEffect(() => {
    if (!token) return;
    const onFocus = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current > 60_000) {
        lastRefreshRef.current = now;
        refreshUser();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [token, refreshUser]);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        realUser,
        token,
        login,
        logout,
        isAuthenticated,
        hasPermission,
        permissions,
        refreshUser,
        isImpersonating: impersonatedUser !== null,
        enterWorkspace,
        exitWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
