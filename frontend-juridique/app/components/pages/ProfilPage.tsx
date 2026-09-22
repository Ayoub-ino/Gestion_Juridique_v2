"use client";

import type { TranslationKeys } from "@/lib/translations";
import type { User } from "@/context/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { Langue } from "@/app/types";
import { useServiceLabels } from "@/app/hooks/useServiceLabels";
import { api } from "@/lib/api/client";
import { notify } from "@/lib/feedback";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
  user: User;
}

interface SubstituteEntry {
  id: number;
  substituteUserId: number;
  substituteUserName: string;
  dateAssignation: string;
  dateRevocation?: string;
  isActive: boolean;
}

interface CoveringEntry {
  id: number;
  absentUserId: number;
  absentUserName: string;
  dateAssignation: string;
}

interface SubstitutionActionEntry {
  id: number;
  effectueParUserId: number;
  effectueParNom: string;
  pourUserId: number;
  pourNom: string;
  action: string;
  documentId?: number | null;
  reference: string;
  dateAction: string;
}

export function ProfilPage({ langue, cur, token, user }: Props) {
  const [substitutes, setSubstitutes] = useState<SubstituteEntry[]>([]);
  const [covering, setCovering] = useState<CoveringEntry[]>([]);
  const [actions, setActions] = useState<SubstitutionActionEntry[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; nom: string; service: string }[]>([]);
  const [selectedSubstitute, setSelectedSubstitute] = useState<number | 0>(0);
  const [busy, setBusy] = useState(false);

  const fetchSubstitutes = useCallback(async () => {
    if (!user?.id) return;
    try {
      setSubstitutes(await api.get<SubstituteEntry[]>(`/api/Substitutes/history/${user.id}`, token));
    } catch (err) { console.warn(err); }
  }, [user, token]);

  const fetchCovering = useCallback(async () => {
    if (!user?.id) return;
    try {
      setCovering(await api.get<CoveringEntry[]>(`/api/Substitutes/covering/${user.id}`, token));
    } catch (err) { console.warn(err); }
  }, [user, token]);

  const fetchActions = useCallback(async () => {
    if (!user?.id) return;
    try {
      setActions(await api.get<SubstitutionActionEntry[]>(`/api/Substitutes/actions/${user.id}`, token));
    } catch (err) { console.warn(err); }
  }, [user, token]);

  const fetchUsers = useCallback(async () => {
    try {
      // /api/Users/actifs is the non-admin, lightweight user list (the plain
      // /api/Users endpoint requires gerer_utilisateurs and would 403 here).
      const data = await api.get<{ id: number; nom: string; service: string }[]>("/api/Users/actifs", token);
      setAllUsers(data.filter((u) => u.id !== user?.id));
    } catch (err) { console.warn(err); }
  }, [user, token]);

  useEffect(() => {
    fetchSubstitutes();
    fetchCovering();
    fetchActions();
    fetchUsers();
  }, [fetchSubstitutes, fetchCovering, fetchActions, fetchUsers]);

  const refreshAll = () => {
    fetchSubstitutes();
    fetchCovering();
    fetchActions();
  };

  const handleSaveSubstitute = async () => {
    if (!selectedSubstitute) {
      notify(langue === "fr" ? "Veuillez choisir un remplaçant" : "يرجى اختيار بديل");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/Substitutes", { userId: user.id, substituteUserId: selectedSubstitute }, token);
      notify(langue === "fr" ? "Remplaçant enregistré" : "تم حفظ البديل");
      setSelectedSubstitute(0);
      refreshAll();
    } catch (err) {
      // Surface the failure: a silent catch here made the button look broken.
      notify(langue === "fr" ? "Impossible d'enregistrer le remplaçant" : "تعذر حفظ البديل");
      console.warn(err);
    }
    setBusy(false);
  };

  const handleCancelSubstitute = async (id: number) => {
    setBusy(true);
    try {
      await api.delete(`/api/Substitutes/${id}`, token);
      notify(langue === "fr" ? "Substitution révoquée" : "تم إلغاء التبديل");
      refreshAll();
    } catch (err) {
      notify(langue === "fr" ? "Impossible de révoquer la substitution" : "تعذر إلغاء التبديل");
      console.warn(err);
    }
    setBusy(false);
  };

  const { getServiceLabel } = useServiceLabels(token, langue);

  const activeSubstitute = substitutes.find(s => s.isActive);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm" data-testid="profil-infos">
        <h3 className="font-bold text-sm text-slate-800 mb-4">{langue === "fr" ? "Mes informations" : "معلوماتي"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">{langue === "fr" ? "Nom complet" : "الاسم الكامل"}</span>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.nom || "-"}</p>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">Login</span>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.login || "-"}</p>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">{langue === "fr" ? "Service" : "المصلحة"}</span>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{getServiceLabel(user?.service || "")}</p>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">{langue === "fr" ? "Rôle" : "الدور"}</span>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.role || "-"}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          {langue === "fr"
            ? "Ces informations sont gérées par l'administrateur et ne sont pas modifiables ici."
            : "هذه المعلومات يديرها المدير ولا يمكن تعديلها من هنا."}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm" data-testid="profil-substitution">
        <h3 className="font-bold text-sm text-slate-800 mb-4">{langue === "fr" ? "Gestion de l'absence — remplaçant" : "إدارة الغياب — البديل"}</h3>
        {activeSubstitute ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              {langue === "fr" ? "Remplaçant actuel" : "البديل الحالي"} : <span className="font-bold text-emerald-700">{activeSubstitute.substituteUserName}</span>
            </p>
            <p className="text-[11px] text-slate-400">
              {langue === "fr"
                ? "Cette personne traite vos dossiers en votre absence. Chaque action qu'elle effectue est tracée."
                : "يعالج هذا الشخص ملفاتك في غيابك، وتُسجَّل كل حركة يقوم بها."}
            </p>
            <button type="button" onClick={() => handleCancelSubstitute(activeSubstitute.id)} disabled={busy}
              className="px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:opacity-40 transition">
              {langue === "fr" ? "Supprimer (révoquer)" : "حذف (إلغاء)"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{langue === "fr" ? "Aucun remplaçant défini." : "لم يتم تحديد بديل."}</p>
            <p className="text-[11px] text-slate-400">
              {langue === "fr" ? "Cette personne pourra traiter vos dossiers en votre absence." : "سيتمكن هذا الشخص من معالجة ملفاتك في غيابك."}
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label htmlFor="substitute-select" className="block text-xs font-bold text-slate-700 mb-1">{langue === "fr" ? "Choisir un remplaçant" : "اختر بديلاً"}</label>
                <select id="substitute-select" value={selectedSubstitute} onChange={(e) => setSelectedSubstitute(Number(e.target.value))}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500">
                  <option value={0}>-- {langue === "fr" ? "Aucun" : "لا أحد"} --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.nom} ({u.service})</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={handleSaveSubstitute} disabled={busy}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40 transition">
                {cur.btnEnregistrer}
              </button>
            </div>
          </div>
        )}

        {covering.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-200">
            <p className="text-xs font-bold text-slate-700 mb-2">
              {langue === "fr" ? "Vous remplacez actuellement" : "أنت تنوب حالياً عن"}
            </p>
            <ul className="space-y-1">
              {covering.map(c => (
                <li key={c.id} className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{c.absentUserName}</span>
                  {" — "}
                  {langue === "fr" ? "depuis le" : "منذ"} {new Date(c.dateAssignation).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" data-testid="profil-historique">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-sm text-slate-800">{langue === "fr" ? "Historique des substitutions" : "سجل التبديلات"}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-start">{langue === "fr" ? "Remplaçant" : "البديل"}</th>
                <th className="p-3 text-start">{langue === "fr" ? "Date d'assignation" : "تاريخ التعيين"}</th>
                <th className="p-3 text-start">{langue === "fr" ? "Date de révocation" : "تاريخ الإلغاء"}</th>
                <th className="p-3 text-start">{langue === "fr" ? "Statut" : "الحالة"}</th>
                <th className="p-3 text-center">{cur.tblActions}</th>
              </tr>
            </thead>
            <tbody>
              {substitutes.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">{langue === "fr" ? "Aucune substitution" : "لا توجد تبديلات"}</td></tr>
              ) : (
                substitutes.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-bold">{s.substituteUserName || "-"}</td>
                    <td className="p-3">{new Date(s.dateAssignation).toLocaleDateString()}</td>
                    <td className="p-3">{s.dateRevocation ? new Date(s.dateRevocation).toLocaleDateString() : "-"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {s.isActive ? (langue === "fr" ? "Actif" : "نشط") : (langue === "fr" ? "Inactif" : "غير نشط")}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {s.isActive && (
                        <button type="button" onClick={() => handleCancelSubstitute(s.id)} disabled={busy}
                          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-bold disabled:opacity-40">
                          {cur.btnSupprimer}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" data-testid="profil-trace">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-sm text-slate-800">{langue === "fr" ? "Traçabilité — qui a agi à la place de qui" : "التتبع — من تصرف مكان من"}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-start">{langue === "fr" ? "Action" : "الإجراء"}</th>
                <th className="p-3 text-start">{langue === "fr" ? "Dossier" : "الملف"}</th>
                <th className="p-3 text-start">{langue === "fr" ? "Effectué par" : "نُفِّذ من طرف"}</th>
                <th className="p-3 text-start">{langue === "fr" ? "Au nom de" : "باسم"}</th>
                <th className="p-3 text-start">{langue === "fr" ? "Date" : "التاريخ"}</th>
              </tr>
            </thead>
            <tbody>
              {actions.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">{langue === "fr" ? "Aucune action déléguée" : "لا توجد إجراءات مفوضة"}</td></tr>
              ) : (
                actions.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-bold">{a.action}</td>
                    <td className="p-3 font-mono">{a.reference || (a.documentId ?? "-")}</td>
                    <td className="p-3">{a.effectueParNom || "-"}</td>
                    <td className="p-3">{a.pourNom || "-"}</td>
                    <td className="p-3">{new Date(a.dateAction).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
