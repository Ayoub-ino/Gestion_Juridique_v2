// app/lib/utils.ts

import { STATUS_MAP } from "./constants";

export function normalizeStatus(status: string): string {
  const clean = (status || "").trim();
  const found = Object.keys(STATUS_MAP).find((key) =>
    key === clean ||
    STATUS_MAP[key].fr === clean ||
    STATUS_MAP[key].ar === clean
  );
  if (found) return found;
  if (clean.includes("انتظار")) return "EnAttente";
  if (clean.includes("مرسل")) return "Envoye";
  if (clean.includes("مسودة")) return "Brouillon";
  if (clean.includes("ملغ")) return "Annule";
  return clean || "Nouveau";
}

export function getDocKey(doc: { id: number; type: string }): string {
  return `${doc.type}:${doc.id}`;
}

/** Extract a readable message from an unknown error (e.g. a catch clause). */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  return "";
}