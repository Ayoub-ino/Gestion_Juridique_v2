// app/hooks/useDocuments.ts

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { CourrierSimule, VueActive, Langue } from "@/app/types";
import { getServiceLabel, getStatusLabel } from "@/lib/constants";
import { translations } from "@/lib/translations";
import { api, ApiError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/utils";

/** Raw shape of the backend courrier payloads before formatting. */
interface RawDoc {
  id: number;
  numeroOrdre?: string;
  numeroReference?: string;
  reference?: string;
  numeroEnvoi?: string;
  objet?: string;
  sujet?: string;
  dernierTransfert?: string;
  dateCreation?: string;
  dateEnvoi?: string;
  expediteur?: string;
  demandeur?: string;
  source?: string;
  serviceActuel?: string;
  statutActuel?: string;
  filePath?: string | null;
  transmissible?: boolean | string;
  typeSortant?: string;
  destinataireExterne?: string;
  tribunalOrigine?: string;
  tribunalDestination?: string;
}

export function useDocuments(token: string | null, langue: Langue, vueActive: VueActive) {
  const cur = translations[langue];
  const [listeCourriers, setListeCourriers] = useState<CourrierSimule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();

  const fetchDocuments = useCallback(async () => {
    if (!token) {
      console.warn("Aucun token disponible");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Fetch each endpoint individually so a failing endpoint (e.g. 403) does not
      // break the others — the original behavior when one response was non-ok.
      const fetchOne = async (path: string): Promise<{ ok: boolean; data?: unknown; status?: number }> => {
        try {
          return { ok: true, data: await api.get(path, token) };
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            logout();
            return { ok: false, status: 401 };
          }
          const status = err instanceof ApiError ? err.status : 0;
          console.warn(`GET ${path}: ${status || getErrorMessage(err)}`);
          return { ok: false, status };
        }
      };

      const [adminRes, juridiqueRes, sortantRes] = await Promise.all([
        fetchOne("/api/CourrierAdmin"),
        fetchOne("/api/CourrierJuridique"),
        fetchOne("/api/CourrierSortant"),
      ]);

      // Tableau pour rassembler tous les documents
      let allDocs: CourrierSimule[] = [];

      // ---- ADMIN ----
      if (adminRes.ok) {
        const data = (adminRes.data ?? []) as RawDoc[];
        const formatted = data.map((c) => ({
          id: c.id,
          reference: c.numeroOrdre || c.reference || cur.na,
          objet: c.objet || c.sujet || cur.sansObjet,
          type: "entrant-admin" as VueActive,
          date: new Date(c.dernierTransfert || c.dateCreation || "").toLocaleDateString(),
          dateRaw: c.dernierTransfert || c.dateCreation || "",
          source: c.expediteur || c.source || cur.inconnu,
          serviceActuel: getServiceLabel(c.serviceActuel || "BureauOrdre", langue),
          serviceActuelKey: c.serviceActuel || "BureauOrdre",
          statut: getStatusLabel(c.statutActuel || "Nouveau", langue),
          filePath: c.filePath || undefined,
          description: c.objet || "Aucune description",
          transmissible: c.transmissible === false || c.transmissible === "Non" ? "Non" : "Oui"
        }));
        allDocs = [...allDocs, ...formatted];
      } else if (adminRes.status === 401) {
        logout();
        return;
      } else {
        console.warn(`Admin: ${adminRes.status}`);
      }

      // ---- JURIDIQUE (route corrigée) ----
      if (juridiqueRes.ok) {
        const data = (juridiqueRes.data ?? []) as RawDoc[];
        const formatted = data.map((c) => ({
          id: c.id,
          reference: c.numeroReference || c.reference || cur.na,
          objet: c.objet || c.sujet || cur.sansObjet,
          type: "entrant-juridique" as VueActive,
          date: new Date(c.dernierTransfert || c.dateCreation || "").toLocaleDateString(),
          dateRaw: c.dernierTransfert || c.dateCreation || "",
          source: c.demandeur || c.source || cur.inconnu,
          serviceActuel: getServiceLabel(c.serviceActuel || "BureauOrdre", langue),
          serviceActuelKey: c.serviceActuel || "BureauOrdre",
          statut: getStatusLabel(c.statutActuel || "Nouveau", langue),
          filePath: c.filePath || undefined,
          description: c.objet || "Aucune description",
          transmissible: c.transmissible === false || c.transmissible === "Non" ? "Non" : "Oui"
        }));
        allDocs = [...allDocs, ...formatted];
      } else if (juridiqueRes.status === 401) {
        logout();
        return;
      } else {
        console.warn(`Juridique: ${juridiqueRes.status}`);
      }

      // ---- SORTANT ----
      if (sortantRes.ok) {
        const data = (sortantRes.data ?? []) as RawDoc[];
        const formatted = data.map((c) => {
          let statutBrut = c.statutActuel || "Nouveau";
          if (statutBrut === "Nouveau") statutBrut = "Brouillon";
          return {
            id: c.id,
            reference: c.numeroEnvoi || c.reference || cur.na,
            objet: c.objet || c.sujet || cur.sansObjet,
            type: (c.typeSortant === "demande" ? "sortant-demande" : "sortant-normal") as VueActive,
            date: new Date(c.dernierTransfert || c.dateCreation || "").toLocaleDateString(),
            dateRaw: c.dernierTransfert || c.dateCreation || "",
            source: cur.serviceEmetteur,
            serviceActuel: getServiceLabel(c.serviceActuel || "BureauOrdre", langue),
            serviceActuelKey: c.serviceActuel || "BureauOrdre",
            statut: getStatusLabel(statutBrut, langue),
            destinataireExterne: c.destinataireExterne || cur.inconnu,
            dateEnvoi: c.dateEnvoi ? new Date(c.dateEnvoi).toLocaleDateString() : "-",
            typeSortant: c.typeSortant || "normal",
            tribunalOrigine: c.tribunalOrigine || "",
            tribunalDestination: c.tribunalDestination || "",
            filePath: c.filePath || undefined,
            description: c.objet || "Aucune description"
          };
        });
        allDocs = [...allDocs, ...formatted];
      } else if (sortantRes.status === 401) {
        logout();
        return;
      } else {
        console.warn(`Sortant: ${sortantRes.status}`);
      }

      // Si aucune donnée n'a été récupérée, on garde un tableau vide
      // mais on ne lance pas d'erreur pour que l'UI reste fonctionnelle
      if (allDocs.length === 0) {
        console.warn("Aucun document trouvé (base vide ou endpoints inaccessibles)");
        setError("Aucun document disponible");
      } else {
        setError(null);
      }

      setListeCourriers(allDocs);
    } catch (err) {
      console.error("❌ Erreur fetch:", err);
      // On ne lance pas d'erreur, on laisse un tableau vide
      setError(getErrorMessage(err) || "Erreur de chargement");
      setListeCourriers([]);
    } finally {
      setLoading(false);
    }
  // vueActive is intentionally kept as a dependency: navigating views re-fetches
  // the document list (legacy behavior), even though the fetch itself doesn't read it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, langue, vueActive, logout, cur]);

  useEffect(() => {
    if (token) {
      fetchDocuments();
    }
  }, [fetchDocuments, token]);

  return { listeCourriers, setListeCourriers, loading, error, refetch: fetchDocuments };
}