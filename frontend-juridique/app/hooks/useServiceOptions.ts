// app/hooks/useServiceOptions.ts
// Selectable services for recipient pickers.
//
// Reads the live RBAC catalog so services created from the admin panel are
// immediately selectable as destinations, and removes the dependency on the
// static SERVICE_GROUPS list. The static list is only used as a fallback when
// the API is unreachable, and the fallback values are legacy enum names which
// the backend still accepts.

"use client";

import { useState, useEffect, useMemo } from "react";
import { Langue } from "@/app/types";
import { SERVICE_GROUPS } from "@/lib/constants";
import { api } from "@/lib/api/client";

interface RbacService {
  id: number;
  nom: string;
  code: string;
  parentId?: number | null;
  parentNom?: string | null;
  isActive: boolean;
  userCount: number;
}

export interface ServiceOption {
  /** Value submitted to the API — the RBAC service code (or a legacy enum name). */
  value: string;
  label: string;
}

export interface ServiceOptionGroup {
  key: string;
  label: string;
  children: ServiceOption[];
}

const FALLBACK_GROUP_LABEL = { fr: "Services", ar: "المصالح" };

export function useServiceOptions(token: string | null | undefined, langue: Langue) {
  const [services, setServices] = useState<RbacService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get<RbacService[]>("/api/rbac/services", token)
      .then((rows) => {
        if (!cancelled) setServices(rows.filter((s) => s.isActive));
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Flat list — used by simple pickers
  const options = useMemo<ServiceOption[]>(() => {
    if (services.length === 0) {
      const fallback: ServiceOption[] = [];
      for (const group of SERVICE_GROUPS) {
        for (const child of group.children) {
          fallback.push({ value: child.value, label: langue === "fr" ? child.fr : child.ar });
        }
      }
      return fallback;
    }
    return services.map((s) => ({ value: s.code, label: s.nom }));
  }, [services, langue]);

  // Grouped list — mirrors the catalog's parent/child hierarchy
  const groups = useMemo<ServiceOptionGroup[]>(() => {
    if (services.length === 0) {
      return SERVICE_GROUPS.map((g) => ({
        key: g.label,
        label: langue === "fr" ? g.fr : g.ar,
        children: g.children.map((c) => ({
          value: c.value,
          label: langue === "fr" ? c.fr : c.ar,
        })),
      }));
    }

    const ids = new Set(services.map((s) => s.id));
    const grouped: ServiceOptionGroup[] = [];
    const orphans: ServiceOption[] = [];

    for (const parent of services) {
      if (parent.parentId != null && ids.has(parent.parentId)) continue; // rendered under its parent
      const children = services
        .filter((s) => s.parentId === parent.id)
        .map((s) => ({ value: s.code, label: s.nom }));

      if (children.length > 0) {
        grouped.push({ key: parent.code, label: parent.nom, children });
      } else {
        orphans.push({ value: parent.code, label: parent.nom });
      }
    }

    if (orphans.length > 0) {
      grouped.unshift({
        key: "standalone",
        label: langue === "fr" ? FALLBACK_GROUP_LABEL.fr : FALLBACK_GROUP_LABEL.ar,
        children: orphans,
      });
    }

    return grouped;
  }, [services, langue]);

  return { options, groups, loading, isDynamic: services.length > 0 };
}
