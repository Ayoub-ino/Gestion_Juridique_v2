"use client";

import type { TranslationKeys } from "@/lib/translations";
import type { User } from "@/context/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { Langue } from "@/app/types";
import { SERVICE_GROUPS, getRoleLabel } from "@/lib/constants";
import { api } from "@/lib/api/client";

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

export function ProfilPage({ langue, cur, token, user }: Props) {
  const [substitutes, setSubstitutes] = useState<SubstituteEntry[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; nom: string; service: string }[]>([]);
  const [selectedSubstitute, setSelectedSubstitute] = useState<number | 0>(0);

  const fetchSubstitutes = useCallback(async () => {
    if (!user?.id) return;
    try {
      setSubstitutes(await api.get<SubstituteEntry[]>(`/api/Substitutes/history/${user.id}`, token));
    } catch (err) { console.error(err); }
  }, [user, token]);

  const fetchUsers = useCallback(async () => {
    try {
      // /api/Users/actifs is the non-admin, lightweight user list (the plain
      // /api/Users endpoint requires gerer_utilisateurs and would 403 here).
      const data = await api.get<{ id: number; nom: string; service: string }[]>("/api/Users/actifs", token);
      setAllUsers(data.filter((u) => u.id !== user?.id));
    } catch (err) { console.error(err); }
  }, [user, token]);

  useEffect(() => { fetchSubstitutes(); fetchUsers(); }, [fetchSubstitutes, fetchUsers]);

  const handleSaveSubstitute = async () => {
    if (!selectedSubstitute) {
      alert(langue === "fr" ? "Veuillez choisir un remplaçant" : "يرجى اختيار بديل");
      return;
    }
    try {
      await api.post("/api/Substitutes", { userId: user.id, substituteUserId: selectedSubstitute }, token);
      alert(langue === "fr" ? "Remplaçant enregistré" : "تم حفظ البديل");
      fetchSubstitutes();
    } catch (err) { console.error(err); }
  };

  const handleCancelSubstitute = async (id: number) => {
    try {
      await api.delete(`/api/Substitutes/${id}`, token);
      fetchSubstitutes();
    } catch (err) { console.error(err); }
  };

  const getServiceLabel = (value: string) => {
    for (const group of SERVICE_GROUPS) {
      for (const child of group.children) {
        if (child.value === value) return langue === "fr" ? child.fr : child.ar;
      }
    }
    return getRoleLabel(value, langue);
  };

  const activeSubstitute = substitutes.find(s => s.isActive);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-bold text-sm text-slate-800 mb-4">{langue === "fr" ? "Mes informations" : "معلوماتي"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{langue === "fr" ? "Nom complet" : "الاسم الكامل"}</label>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.nom || "-"}</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Login</label>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.login || "-"}</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{langue === "fr" ? "Service" : "المصلحة"}</label>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{getServiceLabel(user?.service || "")}</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{langue === "fr" ? "Rôle" : "الدور"}</label>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.role || "-"}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-bold text-sm text-slate-800 mb-4">{langue === "fr" ? "Gestion du remplaçant" : "إدارة البديل"}</h3>
        {activeSubstitute ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              {langue === "fr" ? "Remplaçant actuel" : "البديل الحالي"} : <span className="font-bold text-emerald-700">{activeSubstitute.substituteUserName}</span>
            </p>
            <button type="button" onClick={() => handleCancelSubstitute(activeSubstitute.id)}
              className="px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition">
              {langue === "fr" ? "Annuler le remplaçant" : "إلغاء البديل"}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">{langue === "fr" ? "Choisir un remplaçant" : "اختر بديلاً"}</label>
                <select value={selectedSubstitute} onChange={(e) => setSelectedSubstitute(Number(e.target.value))}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500">
                  <option value={0}>-- {langue === "fr" ? "Aucun" : "لا أحد"} --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.nom} ({u.service})</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={handleSaveSubstitute}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
                {cur.btnEnregistrer}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
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
                        <button type="button" onClick={() => handleCancelSubstitute(s.id)}
                          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-bold">
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
    </div>
  );
}
