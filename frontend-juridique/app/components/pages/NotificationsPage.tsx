"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback } from "react";
import { Langue } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { SERVICE_GROUPS, getRoleLabel } from "@/lib/constants";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { ExportFormat } from "@/lib/exportImport";
import { api } from "@/lib/api/client";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
  onExport?: (format: ExportFormat) => void;
  refreshTrigger?: number;
}

interface NotificationData {
  id: number;
  documentId: number;
  documentType: string;
  documentSujet: string;
  sourceServiceId: string;
  destinationServiceId: string;
  message: string;
  statut: string;
  dateEnvoi: string;
  doitRevenir: boolean;
  sourceUserName?: string;
}

export function NotificationsPage({ langue, cur, token, onExport, refreshTrigger }: Props) {
  const { hasPermission } = useAuth();
  const canAccept = hasPermission("accepter");
  const canRefuse = hasPermission("refuser");
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [commentaires, setCommentaires] = useState<Record<number, string>>({});
  const [retours, setRetours] = useState<Record<number, boolean>>({});

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setNotifications(await api.get<NotificationData[]>("/api/Transactions/pending", token));
    } catch (err) {
      console.error("Erreur fetch notifications:", err);
    }
  }, [token]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  // Re-fetch when parent signals a refresh (e.g. after accepting from Transactions tab)
  useEffect(() => { if (refreshTrigger && refreshTrigger > 0) fetchNotifications(); }, [refreshTrigger, fetchNotifications]);
  useEffect(() => { const interval = setInterval(fetchNotifications, 30000); return () => clearInterval(interval); }, [fetchNotifications]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map(n => n.id));
    }
  };

  const handleAccept = async (id: number) => {
    if (!canAccept) { alert(cur.permissionRefusee); return; }
    try {
      await api.put(`/api/Transactions/${id}/accepter`, { commentaire: commentaires[id] || "" }, token);
      alert(langue === "fr" ? "Transaction acceptée avec succès" : "تم قبول المعاملة بنجاح");
      fetchNotifications();
    } catch (err) {
      console.error("Accept error:", err);
      const msg = err instanceof Error ? err.message : "";
      alert(
        (langue === "fr" ? "Erreur lors de l'acceptation: " : "خطأ أثناء القبول: ") + (msg || (langue === "fr" ? "Veuillez réessayer." : "يرجى المحاولة مرة أخرى."))
      );
    }
  };

  const handleRefuse = async (id: number) => {
    if (!canRefuse) { alert(cur.permissionRefusee); return; }
    const motif = commentaires[id] || "";
    if (!motif) {
      alert(langue === "fr" ? "Veuillez saisir un motif" : "يرجى إدخال سبب الرفض");
      return;
    }
    try {
      await api.put(`/api/Transactions/${id}/refuser`, { commentaire: motif, doitRevenir: !!retours[id] }, token);
      alert(langue === "fr" ? "Transaction refusée" : "تم رفض المعاملة");
      fetchNotifications();
    } catch (err) {
      console.error("Refuse error:", err);
      const msg = err instanceof Error ? err.message : "";
      alert(
        (langue === "fr" ? "Erreur lors du refus: " : "خطأ أثناء الرفض: ") + (msg || (langue === "fr" ? "Veuillez réessayer." : "يرجى المحاولة مرة أخرى."))
      );
    }
  };

  const handleAcceptSelected = async () => {
    for (const id of selectedIds) {
      await handleAccept(id);
    }
    setSelectedIds([]);
  };

  const handleRefuseSelected = async () => {
    for (const id of selectedIds) {
      const motif = commentaires[id] || "";
      if (!motif) {
        alert(langue === "fr" ? `Veuillez saisir un motif pour la notification ${id}` : `يرجى إدخال سبب الرفض للإشعار ${id}`);
        return;
      }
    }
    for (const id of selectedIds) {
      await handleRefuse(id);
    }
    setSelectedIds([]);
  };

  const getServiceLabel = (value: string) => {
    for (const group of SERVICE_GROUPS) {
      for (const child of group.children) {
        if (child.value === value) return langue === "fr" ? child.fr : child.ar;
      }
    }
    return getRoleLabel(value, langue);
  };

  const pendingCount = notifications.filter(n => n.statut === "EnAttente").length;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex justify-between items-center">
        <h3 className="font-bold text-sm text-slate-800">
          {langue === "fr" ? `Mes notifications (${notifications.length})` : `إشعاراتي (${notifications.length})`}
        </h3>
        <div className="flex items-center gap-2">
          {onExport && (
            <ExportButtons onExcel={() => onExport("export excel")} onWord={() => onExport("export word")} />
          )}
          <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <span className="text-[11px] text-slate-500 font-bold self-center">
                {selectedIds.length} {langue === "fr" ? "sélectionnée(s)" : "محددة"}
              </span>
              {canAccept && (
              <button type="button" onClick={handleAcceptSelected}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition">
                {langue === "fr" ? "Accepter" : "قبول"} ({selectedIds.length})
              </button>
              )}
              {canRefuse && (
              <button type="button" onClick={handleRefuseSelected}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition">
                {langue === "fr" ? "Refuser" : "رفض"} ({selectedIds.length})
              </button>
              )}
            </>
          )}
          {pendingCount > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-[11px] font-bold">
              {pendingCount} {langue === "fr" ? "En attente" : "في الانتظار"}
            </span>
          )}
        </div>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 shadow-sm text-center">
          <p className="text-slate-400 font-bold">{langue === "fr" ? "Aucune notification" : "لا توجد إشعارات"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center gap-3">
            <input type="checkbox" onChange={toggleAll}
              checked={selectedIds.length === notifications.length && notifications.length > 0}
              className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-600">{langue === "fr" ? "Tout sélectionner" : "تحديد الكل"}</span>
          </div>

          {notifications.map(n => (
            <div key={n.id} className={`bg-white border rounded-lg p-5 shadow-sm transition ${n.statut === "EnAttente" ? "border-amber-200" : "border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selectedIds.includes(n.id)} onChange={() => toggleSelect(n.id)}
                  className="w-4 h-4 text-blue-600 mt-1" />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm text-slate-800">{n.documentSujet}</h4>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${n.statut === "EnAttente" ? "bg-amber-100 text-amber-700" : n.statut === "Accepte" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {n.statut === "EnAttente" ? (langue === "fr" ? "En attente" : "في الانتظار") : n.statut === "Accepte" ? (langue === "fr" ? "Accepté" : "مقبول") : (langue === "fr" ? "Refusé" : "مرفوض")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 mb-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                      {langue === "fr" ? "De" : "من"} : {getServiceLabel(n.sourceServiceId)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                      {langue === "fr" ? "Vers" : "إلى"} : {getServiceLabel(n.destinationServiceId)}
                    </span>
                    {n.doitRevenir && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold border border-amber-300">
                        {langue === "fr" ? "🔁 Doit revenir" : "🔁 يجب الرجوع"}
                      </span>
                    )}
                    {n.message && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                        {langue === "fr" ? "Message" : "رسالة"} : {n.message}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                      {langue === "fr" ? "Envoyé le" : "أرسل في"} : {n.dateEnvoi ? new Date(n.dateEnvoi).toLocaleDateString() : "-"}
                    </span>
                  </div>

                  {n.statut === "EnAttente" && (
                    <div className="space-y-2">
                      <textarea rows={2} value={commentaires[n.id] || ""}
                        onChange={(e) => setCommentaires(prev => ({ ...prev, [n.id]: e.target.value }))}
                        placeholder={langue === "fr" ? "Votre réponse..." : "ردك..."}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500" />
                      <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                          <input type="checkbox" checked={!!retours[n.id]}
                            onChange={(e) => setRetours(prev => ({ ...prev, [n.id]: e.target.checked }))}
                            className="w-3 h-3" />
                          {langue === "fr" ? "Doit revenir" : "يجب الرجوع"}
                        </label>
                        {canAccept && (
                        <button type="button" onClick={() => handleAccept(n.id)}
                          className="px-4 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition">
                          {langue === "fr" ? "Accepter" : "قبول"}
                        </button>
                        )}
                        {canRefuse && (
                        <button type="button" onClick={() => handleRefuse(n.id)}
                          className="px-4 py-1.5 rounded bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition">
                          {langue === "fr" ? "Refuser" : "رفض"}
                        </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
