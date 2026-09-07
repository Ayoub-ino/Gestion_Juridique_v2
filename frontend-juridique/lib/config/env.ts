// lib/config/env.ts
// Single source of truth for the backend API base URL.
// Every fetch in the app should read from here (via lib/api/client.ts),
// never re-declare the fallback.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";
