// app/hooks/useWorkflowSteps.ts
// The dashboard's workflow pipeline, read from the live service catalog.
//
// There is no hardcoded stage list: the stages ARE the services registered in
// « Gestion des services ». Creating a service adds a stage, archiving one
// removes it, and renaming one relabels it — all without touching code.
//
// Call this once per view and pass the result down; the pipeline is a single
// source of truth, so the tables and the dashboard cannot disagree about it.

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import {
  buildWorkflowSteps,
  type CatalogService,
  type WorkflowStep,
} from "@/lib/constants";

export function useWorkflowSteps(token: string | null | undefined) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setSteps([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    api
      .get<CatalogService[]>("/api/rbac/services", token)
      .then((services) => {
        if (!cancelled) setSteps(buildWorkflowSteps(Array.isArray(services) ? services : []));
      })
      .catch(() => {
        // An unreachable catalog yields an empty pipeline rather than a stale
        // hardcoded one — the dashboard still renders, it just has no stages.
        if (!cancelled) setSteps([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { steps, loading };
}
