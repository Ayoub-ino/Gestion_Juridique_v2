"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback } from "react";
import { Langue } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { SERVICE_GROUPS, getRoleLabel } from "@/lib/constants";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { exportRows, ExportFormat } from "@/lib/exportImport";
import { api } from "@/lib/api/client";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
  onAccepted?: () => void;
}

interface TransactionData {
  id: number;
  documentId: number;
  documentSujet: string;
  sourceServiceId: string;
  destinationServiceId: string;
  message: string;
  statut: string;
  dateEnvoi: string;
  doitRevenir: boolean;
  commentaire?: string;
  motifRefus?: string;
  role?: "sender" | "receiver";
}

export function TransactionsPage({ langue, cur, token, onAccepted }: Props) {
  const { hasPermission } = useAuth();
  const canAccept = hasPermission("accepter");
  const canRefuse = hasPermission("refuser");
  const canCancelTransfer = hasPermission("annuler_transfert");
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [commentaires, setCommentaires] = useState<Record<number, string>>({});
  const [retours, setRetours] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setTransactions(await api.get<TransactionData[]>("/api/Transactions/all", token));
    } catch (err) {
      console.error("Erreur fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const pendingTransactions = transactions.filter(t => t.statut === "EnAttente");
  const acceptedTransactions = transactions.filter(t => t.statut === "Accepte");
  const refusedTransactions = transactions.filter(t => t.statut === "Refuse");

  const exportTransactions = (format: ExportFormat) => {
    const rows = transactions.map(t => ({
      [langue === "fr" ? "Document" : "الوثيقة"]: t.documentSujet,
      [langue === "fr" ? "De" : "من"]: getServiceLabel(t.sourceServiceId),
      [langue === "fr" ? "Vers" : "إلى"]: getServiceLabel(t.destinationServiceId),
      [langue === "fr" ? "Statut" : "الحالة"]: t.statut === "EnAttente" ? (langue === "fr" ? "En attente" : "في الانتظار") : t.statut === "Accepte" ? (langue === "fr" ? "Accepté" : "مقبول") : (langue === "fr" ? "Refusé" : "مرفوض"),
      [langue === "fr" ? "Message" : "رسالة"]: t.message || "",
      [langue === "fr" ? "Date" : "التاريخ"]: new Date(t.dateEnvoi).toLocaleDateString(),
    }));
    exportRows(rows, "transactions", format, cur.registreTransactions);
  };

  const getServiceLabel = (value: string) => {
    for (const group of SERVICE_GROUPS) {
      for (const child of group.children) {
        if (child.value === value) return langue === "fr" ? child.fr : child.ar;
      }
    }
    return getRoleLabel(value, langue);
  };

  const handleAccept = async (id: number) => {
    if (!canAccept) { alert(cur.permissionRefusee); return; }
    if (!token) return;
    try {
      await api.put(`/api/Transactions/${id}/accepter`, { commentaire: commentaires[id] || "" }, token);
      alert(langue === "fr" ? "Transaction acceptée avec succès" : "تم قبول المعاملة بنجاح");
      fetchTransactions();
      onAccepted?.();
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
    if (!token) return;
    const motif = commentaires[id] || "";
    if (!motif) {
      alert(langue === "fr" ? "Veuillez saisir un motif de refus" : "يرجى إدخال سبب الرفض");
      return;
    }
    try {
      await api.put(`/api/Transactions/${id}/refuser`, { commentaire: motif, doitRevenir: !!retours[id] }, token);
      alert(langue === "fr" ? "Transaction refusée" : "تم رفض المعاملة");
      fetchTransactions();
      onAccepted?.();
    } catch (err) {
      console.error("Refuse error:", err);
      const msg = err instanceof Error ? err.message : "";
      alert(
        (langue === "fr" ? "Erreur lors du refus: " : "خطأ أثناء الرفض: ") + (msg || (langue === "fr" ? "Veuillez réessayer." : "يرجى المحاولة مرة أخرى."))
      );
    }
  };

  const handleAnnuler = async (id: number) => {
    if (!token) return;
    const confirmed = confirm(
      langue === "fr"
        ? "Annuler cette transition ? Le dossier retournera au service précédent."
        : "إلغاء هذه المعاملة؟ سيعود الملف للمصلحة السابقة."
    );
    if (!confirmed) return;
    try {
      await api.put(`/api/Transactions/${id}/annuler-transition`, {}, token);
      alert(langue === "fr" ? "Transaction annulée avec succès" : "تم إلغاء المعاملة بنجاح");
      fetchTransactions();
      onAccepted?.();
    } catch (err) {
      console.error("Annuler error:", err);
      const msg = err instanceof Error ? err.message : "";
      alert(
        (langue === "fr" ? "Erreur lors de l'annulation: " : "خطأ أثناء الإلغاء: ") + (msg || (langue === "fr" ? "Veuillez réessayer." : "يرجى المحاولة مرة أخرى."))
      );
    }
  };

  const getStatutBadge = (statut: string) => {
    if (statut === "EnAttente") {
      return (
        <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 font-bold text-[10px]">
          {langue === "fr" ? "En attente" : "في الانتظار"}
        </span>
      );
    }
    if (statut === "Accepte") {
      return (
        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">
          {langue === "fr" ? "Accepté" : "مقبول"}
        </span>
      );
    }
    if (statut === "Annule") {
      return (
        <span className="px-2 py-1 rounded bg-slate-200 text-slate-600 font-bold text-[10px]">
          {langue === "fr" ? "Annulé" : "ملغاة"}
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded bg-red-100 text-red-700 font-bold text-[10px]">
        {langue === "fr" ? "Refusé" : "مرفوض"}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-600">
            {langue === "fr" ? "En attente" : "في الانتظار"}
          </span>
          <strong className="block text-2xl mt-2 text-amber-600">{pendingTransactions.length}</strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-600">
            {langue === "fr" ? "Acceptées" : "المقبولات"}
          </span>
          <strong className="block text-2xl mt-2 text-emerald-600">{acceptedTransactions.length}</strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-600">
            {langue === "fr" ? "Refusées" : "المرفوضات"}
          </span>
          <strong className="block text-2xl mt-2 text-red-600">{refusedTransactions.length}</strong>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm">{cur.registreTransactions}</h3>
          <div className="flex gap-1.5">
            <ExportButtons onExcel={() => exportTransactions("export excel")} onWord={() => exportTransactions("export word")} />
            <button
              type="button"
              onClick={fetchTransactions}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
            >
              {langue === "fr" ? "Rafraîchir" : "تحديث"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 font-bold">
            {langue === "fr" ? "Chargement..." : "جاري التحميل..."}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-bold">
            {cur.aucunDoc}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-3 text-start">{cur.tblTitre}</th>
                  <th className="p-3 text-start">{cur.tblRef}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "De" : "من"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Vers" : "إلى"}</th>
                  <th className="p-3 text-start">{cur.statut}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Message" : "رسالة"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Date" : "التاريخ"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const isSender = t.role === "sender";
                  const isReceiver = t.role === "receiver";
                  return (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-bold">{t.documentSujet}</td>
                    <td className="p-3 font-mono text-[10px]">{t.documentId}</td>
                    <td className="p-3">{getServiceLabel(t.sourceServiceId)}</td>
                    <td className="p-3">{getServiceLabel(t.destinationServiceId)}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {getStatutBadge(t.statut)}
                        {t.role === "sender" && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold text-[8px] border border-blue-200">
                            {langue === "fr" ? "📤 Envoyé" : "📤 مرسل"}
                          </span>
                        )}
                        {t.role === "receiver" && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-bold text-[8px] border border-purple-200">
                            {langue === "fr" ? "📥 Reçu" : "📥 مستلم"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 max-w-[200px] truncate text-slate-500">{t.message || "-"}</td>
                    <td className="p-3 text-slate-500">{new Date(t.dateEnvoi).toLocaleDateString()}</td>
                    <td className="p-3">
                      {t.statut === "EnAttente" ? (
                        <div className="flex flex-col gap-1.5">
                          {isReceiver && (
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="text"
                              value={commentaires[t.id] || ""}
                              onChange={(e) => setCommentaires(prev => ({ ...prev, [t.id]: e.target.value }))}
                              placeholder={langue === "fr" ? "Commentaire..." : "تعليق..."}
                              className="w-32 p-1.5 border border-slate-300 rounded text-[10px] outline-none focus:border-blue-500"
                            />
                            <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600 cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={!!retours[t.id]}
                                onChange={(e) => setRetours(prev => ({ ...prev, [t.id]: e.target.checked }))}
                                className="w-3 h-3"
                              />
                              {langue === "fr" ? "Retour" : "مرجع"}
                            </label>
                          </div>
                          )}
                          <div className="flex gap-1.5">
                            {/* Receiver: Accepter + Refuser */}
                            {isReceiver && canAccept && (
                            <button
                              type="button"
                              onClick={() => handleAccept(t.id)}
                              className="px-2.5 py-1.5 rounded bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition whitespace-nowrap"
                            >
                              {langue === "fr" ? "Accepter" : "قبول"}
                            </button>
                            )}
                            {isReceiver && canRefuse && (
                            <button
                              type="button"
                              onClick={() => handleRefuse(t.id)}
                              className="px-2.5 py-1.5 rounded bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 transition whitespace-nowrap"
                            >
                              {langue === "fr" ? "Refuser" : "رفض"}
                            </button>
                            )}
                            {/* Sender: Annuler l'envoi only */}
                            {isSender && canCancelTransfer && (
                            <button
                              type="button"
                              onClick={() => handleAnnuler(t.id)}
                              className="px-2.5 py-1.5 rounded bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 transition whitespace-nowrap"
                            >
                              {langue === "fr" ? "Annuler l'envoi" : "إلغاء الإرسال"}
                            </button>
                            )}
                          </div>
                        </div>
                      ) : t.statut === "Accepte" ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-emerald-600 italic">{t.commentaire || "-"}</span>
                          {/* Sender can cancel accepted transactions */}
                          {isSender && canCancelTransfer && (
                            <button
                              type="button"
                              onClick={() => handleAnnuler(t.id)}
                              className="mt-1 px-2.5 py-1.5 rounded bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 transition whitespace-nowrap"
                            >
                              {langue === "fr" ? "Annuler" : "إلغاء"}
                            </button>
                          )}
                        </div>
                      ) : t.statut === "Refuse" ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-red-500 italic">{t.motifRefus || "-"}</span>
                          {t.doitRevenir && (
                            <span className="text-[10px] text-amber-600 font-bold">
                              {langue === "fr" ? "↩ Retourné à l'expéditeur" : "↩ أُعيد للمرسل"}
                            </span>
                          )}
                        </div>
                      ) : t.statut === "Annule" ? (
                        <span className="text-[10px] text-slate-500 italic">
                          {langue === "fr" ? "Transaction annulée" : "تم إلغاء المعاملة"}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
