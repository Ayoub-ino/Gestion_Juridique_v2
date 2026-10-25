// lib/api/client.ts
// Central typed fetch wrapper. All API calls should go through `api` so the
// base URL, auth header, and error handling live in exactly one place.

import { API_BASE_URL } from "@/lib/config/env";

/**
 * Replacement workspace: while a substitute is working as the agent they replace,
 * every request names that agent so the backend resolves permissions, folders and
 * notifications exactly as if that agent had signed in (see
 * DelegationImpersonationMiddleware).
 *
 * Module-level on purpose: every call goes through `request`, so the workspace
 * cannot be half-applied to some screens and not others.
 */
let delegationUserId: number | null = null;

export function setDelegationUser(userId: number | null): void {
  delegationUserId = userId;
}

export function getDelegationUser(): number | null {
  return delegationUserId;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  /** Pass raw text/FormData/Blob bodies instead of JSON. */
  rawBody?: BodyInit;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", token, body, headers, rawBody } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Only meaningful alongside a session: without a token the middleware would
      // have no caller to validate the delegation against.
      ...(delegationUserId && token
        ? { "X-Delegation-User-Id": String(delegationUserId) }
        : {}),
      ...headers,
    },
    body: rawBody ?? (body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      message = data?.error || data?.message || message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: "POST", body, token }),
  put: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: "PUT", body, token }),
  delete: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: "DELETE", token }),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: "PATCH", body, token }),
  send: <T>(path: string, method: string, rawBody: BodyInit, token?: string | null) =>
    request<T>(path, { method, rawBody, token }),
};
