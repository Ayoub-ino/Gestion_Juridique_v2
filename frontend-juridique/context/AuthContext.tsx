"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { api, ApiError } from '@/lib/api/client';

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
  user: User | null;
  token: string | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (key: string) => boolean;
  permissions: string[];
  /** Re-fetches the user + permissions from the DB (GET /api/auth/me). */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, []);

  const login = async (login: string, password: string) => {
    try {
      const data = await api.post<{ token: string; user: User }>(
        "/api/auth/login",
        { Login: login, Password: password }
      );
      setToken(data.token);
      setUser(data.user);
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
    setUser(null);
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
    if (user?.role === "Admin" && token) {
      fetchAdminOverrides();
    }
  }, [user?.role, token, fetchAdminOverrides]);

  // Re-fetch the user + permissions from the DB so permission changes made in
  // the admin panel (by another admin) reflect in the UI without re-login.
  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<{ user: User }>("/api/auth/me", token);
      setUser(data.user);
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
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, hasPermission, permissions, refreshUser }}>
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
