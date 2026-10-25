// app/hooks/useCourrierFields.ts
//
// Field configuration of a « Gérer les courriers » form, read from the database.
//
// The three forms render from this hook, so a field the administrator renames,
// reorders, hides, adds or requires in « Gestion des champs » applies on the next
// paint — nothing about the field set is compiled in.

"use client";

import { useState, useEffect, useMemo } from "react";
import type { CourrierFieldConfig } from "@/app/types";
import { api } from "@/lib/api/client";

export type CourrierFieldType = "administratif" | "juridique" | "sortant";

/**
 * Required fields of the seeded configuration, per form.
 *
 * Used ONLY when the configuration cannot be fetched, so the form still marks the
 * same fields as before instead of silently presenting everything as optional
 * (the backend enforces the real ones either way).
 */
const FALLBACK_REQUIRED: Record<CourrierFieldType, string[]> = {
  administratif: ["source", "dateArrivee", "numeroInterne", "objet", "modeTraitement"],
  juridique: [
    "sourceDocLie",
    "objet",
    "tribunalSource",
    "date",
    "numeroDossierJuridique",
    "numeroDossierAppel",
    "serviceDestination",
  ],
  sortant: ["objet", "dateEnvoi"],
};

export interface CourrierFieldLookup {
  /** Every active field, in display order. */
  fields: CourrierFieldConfig[];
  /** Fields the administrator added — rendered as generic inputs. */
  customFields: CourrierFieldConfig[];
  /** Is this field shown? Unknown keys are shown (nothing silently disappears). */
  show: (key: string) => boolean;
  /** Does this field carry the red « * », and is it enforced by the API? */
  required: (key: string) => boolean;
  /** Configured label, falling back to the translation when unset. */
  label: (key: string, fallback: string) => string;
  /** False while the configuration is still loading. */
  ready: boolean;
}

export function useCourrierFields(
  token: string | null | undefined,
  type: CourrierFieldType,
  langue: "fr" | "ar",
  /** The form's own translation block, for the label fallbacks. */
  fallbackLabels: Record<string, string> = {}
): CourrierFieldLookup {
  const [fields, setFields] = useState<CourrierFieldConfig[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<CourrierFieldConfig[]>(`/api/CourrierFields/${type}`, token)
      .then((rows) => {
        if (!cancelled) setFields(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        // Left empty on purpose: `show` then reveals every field and `required`
        // falls back to the seeded set below.
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, type]);

  return useMemo<CourrierFieldLookup>(() => {
    const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
    const configured = fields.length > 0;

    return {
      fields,
      customFields: fields.filter((f) => f.isCustom && f.isActive),
      show: (key) => {
        const field = byKey.get(key);
        return configured && field ? field.isActive : true;
      },
      required: (key) => {
        const field = byKey.get(key);
        if (configured && field) return field.isRequired;
        return FALLBACK_REQUIRED[type].includes(key);
      },
      label: (key, fallback) => {
        const field = byKey.get(key);
        if (!field) return fallback;
        const configuredLabel = langue === "fr" ? field.labelFr : field.labelAr;
        return configuredLabel?.trim() || fallback || fallbackLabels[key] || key;
      },
      ready,
    };
  }, [fields, type, langue, ready, fallbackLabels]);
}
