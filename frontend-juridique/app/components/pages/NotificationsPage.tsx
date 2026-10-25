"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback, useRef } from "react";
import { Langue } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { useServiceLabels } from "@/app/hooks/useServiceLabels";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { ExportFormat } from "@/lib/exportImport";
import { getErrorMessage } from "@/lib/utils";
import { notify } from "@/lib/feedback";
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
  commentaire?: string;
  statut: string;
  dateEnvoi: string;
  doitRevenir: boolean;
  sourceUserName?: string;
}

/**
 * A pending absence-delegation invitation. It shares the notifications screen
 * with folder transfers because it is the same kind of decision for the agent:
 * something is waiting for an answer. Accepting it opens the replacement
 * workspace (see SubstitutesController).
 */
interface DelegationInvitation {
  id: number;
  absentUserId: number;
  absentUserName: string;
  absentUserService?: string;
  dateAssignation: string;
  dateDebut: string;
  dateFin?: string | null;
}

/**
 * Refusal notices are ordinary pending transactions directed back to the original
 * sender, flagged with the [REFUS] marker in the commentaire column. They carry the
 * reason the receiver typed in `message` and only need an acknowledgement.
 */
const isRefusalNotice = (n: { commentaire?: string }) => n.commentaire === "[REFUS]";

export function NotificationsPage({ langue, cur, token, onExport, refreshTrigger }: Props) {
  const { hasPermission, user } = useAuth();
  const [invitations, setInvitations] = useState<DelegationInvitation[]>([]);
  const [invitationMotifs, setInvitationMotifs] = useState<Record<number, string>>({});
  const [invitationBusy, setInvitationBusy] = useState<number[]>([]);
  const canAccept = hasPermission("accepter");
  const canRefuse = hasPermission("refuser");
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [commentaires, setCommentaires] = useState<Record<number, string>>({});
  const [retours, setRetours] = useState<Record<number, boolean>>({});
  // Guards against a decision being applied twice for the same notification
  // (rapid clicks / bulk action + individual click on the same row).
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const inFlight = useRef<Set<number>>(new Set());

  const beginAction = (id: number): boolean => {
    if (inFlight.current.has(id)) return false;
    inFlight.current.add(id);
    setBusyIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    return true;
  };

  const endAction = (id: number) => {
    inFlight.current.delete(id);
    setBusyIds(prev => prev.filter(x => x !== id));
  };

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setNotifications(await api.get<NotificationData[]>("/api/Transactions/pending", token));
    } catch (err) {
      console.warn("Erreur fetch notifications:", getErrorMessage(err));
    }
  }, [token]);

  const fetchInvitations = useCallback(async () => {
    if (!token || !user?.id) return;
    try {
      const rows = await api.get<DelegationInvitation[]>(
        `/api/Substitutes/invitations/${user.id}`,
        token
      );
      setInvitations(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.warn("Erreur fetch invitations:", getErrorMessage(err));
    }
  }, [token, user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);
  // Re-fetch when parent signals a refresh (e.g. after accepting from Transactions tab)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchNotifications();
      fetchInvitations();
    }
  }, [refreshTrigger, fetchNotifications, fetchInvitations]);
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
    if (!canAccept) { notify(cur.permissionRefusee); return; }
    if (!beginAction(id)) return;
    try {
      await api.put(`/api/Transactions/${id}/accepter`, { commentaire: commentaires[id] || "" }, token);
      notify(langue === "fr" ? "Transaction acceptée avec succès" : "تم قبول المعاملة بنجاح");
      fetchNotifications();
    } catch (err) {
      console.warn("Accept error:", getErrorMessage(err));
      const msg = err instanceof Error ? err.message : "";
      notify(
        (langue === "fr" ? "Erreur lors de l'acceptation: " : "خطأ أثناء القبول: ") + (msg || (langue === "fr" ? "Veuillez réessayer." : "يرجى المحاولة مرة أخرى."))
      );
    } finally {
      endAction(id);
    }
  };

  const handleRefuse = async (id: number) => {
    if (!canRefuse) { notify(cur.permissionRefusee); return; }
    const motif = commentaires[id] || "";
    if (!motif) {
      notify(langue === "fr" ? "Veuillez saisir un motif" : "يرجى إدخال سبب الرفض");
      return;
    }
    if (!beginAction(id)) return;
    try {
      await api.put(`/api/Transactions/${id}/refuser`, { commentaire: motif, doitRevenir: !!retours[id] }, token);
      notify(langue === "fr" ? "Transaction refusée" : "تم رفض المعاملة");
      fetchNotifications();
    } catch (err) {
      console.warn("Refuse error:", getErrorMessage(err));
      const msg = err instanceof Error ? err.message : "";
      notify(
        (langue === "fr" ? "Erreur lors du refus: " : "خطأ أثناء الرفض: ") + (msg || (langue === "fr" ? "Veuillez réessayer." : "يرجى المحاولة مرة أخرى."))
      );
    } finally {
      endAction(id);
    }
  };

  /** Accept a delegation invitation — the replacement workspace opens at once. */
  const handleAcceptInvitation = async (id: number) => {
    setInvitationBusy((prev) => [...prev, id]);
    try {
      await api.post(`/api/Substitutes/${id}/accepter`, {}, token);
      notify(
        langue === "fr"
          ? "Remplacement accepté. Votre espace de remplacement est ouvert."
          : "تم قبول النيابة. فضاء النيابة مفتوح."
      );
      fetchInvitations();
    } catch (err) {
      notify((langue === "fr" ? "Erreur lors de l'acceptation: " : "خطأ أثناء القبول: ") + getErrorMessage(err));
    }
    setInvitationBusy((prev) => prev.filter((x) => x !== id));
  };

  /** Decline a delegation invitation, with the reason the absent agent will read. */
  const handleRefuseInvitation = async (id: number) => {
    const motif = invitationMotifs[id] || "";
    if (!motif.trim()) {
      notify(langue === "fr" ? "Veuillez saisir un motif" : "يرجى إدخال سبب الرفض");
      return;
    }
    setInvitationBusy((prev) => [...prev, id]);
    try {
      await api.post(`/api/Substitutes/${id}/refuser`, { motif }, token);
      notify(langue === "fr" ? "Invitation refusée" : "تم رفض الدعوة");
      fetchInvitations();
    } catch (err) {
      notify((langue === "fr" ? "Erreur lors du refus: " : "خطأ أثناء الرفض: ") + getErrorMessage(err));
    }
    setInvitationBusy((prev) => prev.filter((x) => x !== id));
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
        notify(langue === "fr" ? `Veuillez saisir un motif pour la notification ${id}` : `يرجى إدخال سبب الرفض للإشعار ${id}`);
        return;
      }
    }
    for (const id of selectedIds) {
      await handleRefuse(id);
    }
    setSelectedIds([]);
  };

  const { getServiceLabel } = useServiceLabels(token, langue);

  const pendingCount = notifications.filter(n => n.statut === "EnAttente").length;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex justify-between items-center">
        <h3 className="font-bold text-sm text-slate-800">
          {langue === "fr"
            ? `Mes notifications (${notifications.length + invitations.length})`
            : `إشعاراتي (${notifications.length + invitations.length})`}
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

      {/* Invitations de remplacement — même écran, même geste : répondre. */}
      {invitations.length > 0 && (
        <div className="space-y-3" data-testid="delegation-invitations">
          <p className="text-xs font-bold text-slate-600">
            {langue === "fr"
              ? "Invitations de remplacement"
              : "دعوات النيابة"}
          </p>
          {invitations.map((inv) => {
            const busy = invitationBusy.includes(inv.id);
            return (
              <div
                key={inv.id}
                data-testid={`delegation-invitation-${inv.id}`}
                className="bg-white border border-blue-200 rounded-lg p-5 shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-sm text-slate-800">
                    {langue === "fr"
                      ? `${inv.absentUserName} vous désigne comme remplaçant`
                      : `${inv.absentUserName} يعيّنك بديلاً عنه`}
                  </h4>
                  <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {langue === "fr" ? "Remplacement" : "نيابة"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 mb-3">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                    {langue === "fr" ? "Service" : "المصلحة"} : {getServiceLabel(inv.absentUserService || "")}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                    {langue === "fr" ? "Du" : "من"} {new Date(inv.dateDebut).toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                    {langue === "fr" ? "Au" : "إلى"}{" "}
                    {inv.dateFin ? new Date(inv.dateFin).toLocaleString() : "-"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  {langue === "fr"
                    ? "En acceptant, vous travaillerez dans son espace : ses dossiers, ses permissions et ses notifications, jusqu'à la fin de la période."
                    : "بقبولك، ستعمل في فضائه: ملفاته وصلاحياته وإشعاراته، إلى غاية نهاية المدة."}
                </p>
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={invitationMotifs[inv.id] || ""}
                    onChange={(e) =>
                      setInvitationMotifs((prev) => ({ ...prev, [inv.id]: e.target.value }))
                    }
                    placeholder={langue === "fr" ? "Motif (en cas de refus)..." : "السبب (في حالة الرفض)..."}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid={`accept-invitation-${inv.id}`}
                      onClick={() => handleAcceptInvitation(inv.id)}
                      disabled={busy}
                      className="px-4 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {langue === "fr" ? "Accepter" : "قبول"}
                    </button>
                    <button
                      type="button"
                      data-testid={`refuse-invitation-${inv.id}`}
                      onClick={() => handleRefuseInvitation(inv.id)}
                      disabled={busy}
                      className="px-4 py-1.5 rounded bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition disabled:opacity-50"
                    >
                      {langue === "fr" ? "Refuser" : "رفض"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 shadow-sm text-center">
          <p className="text-slate-400 font-bold">
            {invitations.length > 0
              ? langue === "fr"
                ? "Aucun transfert de dossier en attente"
                : "لا توجد تحويلات ملفات في الانتظار"
              : langue === "fr"
                ? "Aucune notification"
                : "لا توجد إشعارات"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center gap-3">
            <input type="checkbox" onChange={toggleAll}
              checked={selectedIds.length === notifications.length && notifications.length > 0}
              className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-600">{langue === "fr" ? "Tout sélectionner" : "تحديد الكل"}</span>
          </div>

          {notifications.map(n => {
            const busy = busyIds.includes(n.id);
            return (
            <div key={n.id} className={`bg-white border rounded-lg p-5 shadow-sm transition ${n.statut === "EnAttente" ? "border-amber-200" : "border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selectedIds.includes(n.id)} onChange={() => toggleSelect(n.id)}
                  disabled={busy}
                  className="w-4 h-4 text-blue-600 mt-1 disabled:opacity-50" />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm text-slate-800">{n.documentSujet}</h4>
                    {isRefusalNotice(n) && (
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                        {langue === "fr" ? "⚠️ Transfert refusé par le destinataire" : "⚠️ رفض المستلم التحويل"}
                      </span>
                    )}
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
                      <span className={`px-2 py-0.5 rounded font-bold ${isRefusalNotice(n) ? "bg-red-50 text-red-600 border border-red-200" : "bg-slate-100"}`}>
                        {isRefusalNotice(n)
                          ? (langue === "fr" ? `Motif du refus: ${n.message}` : `سبب الرفض: ${n.message}`)
                          : `${langue === "fr" ? "Message" : "رسالة"} : ${n.message}`
                        }
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                      {langue === "fr" ? "Envoyé le" : "أرسل في"} : {n.dateEnvoi ? new Date(n.dateEnvoi).toLocaleDateString() : "-"}
                    </span>
                  </div>

                  {n.statut === "EnAttente" && (
                    isRefusalNotice(n) ? (
                      /* Refusal notice received by the original sender: acknowledge only —
                         the receiver already decided, so accept/refuse must not be offered. */
                      <div className="flex gap-2 items-center">
                        <button type="button" onClick={() => handleAccept(n.id)}
                          disabled={busy}
                          className="px-4 py-1.5 rounded bg-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed">
                          {langue === "fr" ? "Accusé de réception" : "تأكيد الاستلام"}
                        </button>
                      </div>
                    ) : (
                    <div className="space-y-2">
                      <textarea rows={2} value={commentaires[n.id] || ""}
                        onChange={(e) => setCommentaires(prev => ({ ...prev, [n.id]: e.target.value }))}
                        placeholder={langue === "fr" ? "Votre réponse..." : "ردك..."}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500" />
                      <div className="flex gap-2 items-center">
                        <label htmlFor={`notif-retour-${n.id}`} className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                          <input id={`notif-retour-${n.id}`} type="checkbox" checked={!!retours[n.id]}
                            onChange={(e) => setRetours(prev => ({ ...prev, [n.id]: e.target.checked }))}
                            className="w-3 h-3" />
                          {langue === "fr" ? "Doit revenir" : "يجب الرجوع"}
                        </label>
                        {canAccept && (
                        <button type="button" onClick={() => handleAccept(n.id)}
                          disabled={busy}
                          className="px-4 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                          {langue === "fr" ? "Accepter" : "قبول"}
                        </button>
                        )}
                        {canRefuse && (
                        <button type="button" onClick={() => handleRefuse(n.id)}
                          disabled={busy}
                          className="px-4 py-1.5 rounded bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                          {langue === "fr" ? "Refuser" : "رفض"}
                        </button>
                        )}
                      </div>
                    </div>
                    )
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
