// app/hooks/useServiceLabels.ts
// Dynamic service label resolution — fetches active services from RBAC API
// and falls back to hardcoded SERVICE_GROUPS for known tribunal services.

import { useState, useEffect, useCallback } from "react";
import { Langue } from "@/app/types";
import { SERVICE_GROUPS, getRoleLabel } from "@/lib/constants";
import { api } from "@/lib/api/client";

interface RbacService {
  id: number;
  nom: string;
  code: string;
  description?: string;
}

/**
 * Returns a function that maps a service code (enum name like "BureauOrdre"
 * or RBAC code like "bureauordre") to its display name in the current language.
 *
 * The RBAC API returns lowercase codes (e.g., "archive"), but the backend
 * Transaction model stores ServiceTribunal enum names as PascalCase
 * (e.g., "Archive"). This hook normalizes both for lookup.
 */
export function useServiceLabels(token: string | null | undefined, langue: Langue) {
  const [rbacMap, setRbacMap] = useState<Record<string, { fr: string; ar: string }>>({});

  useEffect(() => {
    if (!token) return;
    api.get<RbacService[]>("/api/rbac/services", token)
      .then((services) => {
        const map: Record<string, { fr: string; ar: string }> = {};
        for (const svc of services) {
          if (svc.code && svc.nom) {
            // Store with lowercase key for case-insensitive lookup
            map[svc.code.toLowerCase()] = { fr: svc.nom, ar: svc.nom };
          }
        }
        setRbacMap(map);
      })
      .catch(() => { /* ignore — will use fallback */ });
  }, [token]);

  const getServiceLabel = useCallback((value: string, _langueOverride?: Langue): string => {
    if (!value) return value;

    // Normalize to lowercase for lookup (RBAC codes are lowercase, enum names are PascalCase)
    const normalized = value.toLowerCase();

    // 1. Try dynamic RBAC services (case-insensitive)
    const rbacEntry = rbacMap[normalized];
    if (rbacEntry) return langue === "fr" ? rbacEntry.fr : rbacEntry.ar;

    // 2. Try hardcoded SERVICE_GROUPS (enum values like "BureauOrdre")
    for (const group of SERVICE_GROUPS) {
      for (const child of group.children) {
        if (child.value === value) return langue === "fr" ? child.fr : child.ar;
      }
    }

    // 3. Try role label fallback
    return getRoleLabel(value, langue);
  }, [rbacMap, langue]);

  return { getServiceLabel, rbacMap };
}
