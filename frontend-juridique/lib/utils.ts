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

/**
 * Canonical service identifier of a document.
 *
 * `doc.serviceActuel` is the *display label* used by the tables ("Bureau d'ordre",
 * "مكتب الضبط"), so it must never be compared against a service code. The dynamic
 * RBAC code wins, then the legacy enum key.
 */
export function getDocServiceCode(doc: {
  serviceActuelCode?: string;
  serviceActuelKey?: string;
} | null | undefined): string {
  return (doc?.serviceActuelCode || doc?.serviceActuelKey || "").trim();
}

/**
 * Normalize a service reference so codes, enum names and labels that only differ
 * by case/separators ("BureauOrdre" vs "bureauordre") compare equal.
 */
export function normalizeServiceRef(value: string | number | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * True when the document currently sits in the given service.
 * Accepts a service code, an enum name, or a service display name.
 */
export function isDocInService(
  doc: {
    serviceActuelCode?: string;
    serviceActuelKey?: string;
    serviceActuel?: string;
  } | null | undefined,
  service: string | null | undefined
): boolean {
  const target = normalizeServiceRef(service);
  if (!target) return false;
  return [doc?.serviceActuelCode, doc?.serviceActuelKey, doc?.serviceActuel].some(
    (candidate) => normalizeServiceRef(candidate) === target
  );
}

/** Extract a readable message from an unknown error (e.g. a catch clause). */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  return "";
}