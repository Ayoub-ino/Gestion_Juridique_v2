"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api/client";

interface Retrait {
  id: number;
  documentId: number;
  reference: string;
  effectuePar: string;
  motifRetrait: string;
  notes: string;
  dateRetrait: string;
  dateRetour: string | null;
  estAnnule: boolean;
  serviceArchives: string;
}

interface ArchiveRetraitPageProps {
  langue: "fr" | "ar";
  cur: TranslationKeys;
  token: string | null;
  selectedDoc: { id: number; reference: string; objet: string } | null;
  onClose: () => void;
  userNom: string;
}

export function ArchiveRetraitPage({
  langue,
  cur,
  token,
  selectedDoc,
  onClose,
  userNom,
}: ArchiveRetraitPageProps) {
  const { hasPermission } = useAuth();
  const canRetrait = hasPermission("retrait_archive");
  const [effectuePar, setEffectuePar] = useState(userNom || "");
  const [motifRetrait, setMotifRetrait] = useState("");
  const [dateRetour, setDateRetour] = useState("");
  const [dateRetrait, setDateRetrait] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRetraits = useCallback(async () => {
    if (!selectedDoc || !token) return;
    try {
      setRetraits(await api.get<Retrait[]>(`/api/Retrait/document/${selectedDoc.id}`, token));
    } catch {}
  }, [selectedDoc, token]);

  useEffect(() => {
    fetchRetraits();
  }, [fetchRetraits]);

  const handleSave = async () => {
    if (!canRetrait) { alert(langue === "fr" ? "Action non autorisée" : "إجراء غير مصرح به"); return; }
    if (!selectedDoc || !token) return;
    if (!motifRetrait.trim()) {
      alert(langue === "fr" ? "Le motif du retrait est obligatoire" : "سبب الإخراج مطلوب");
      return;
    }
    setLoading(true);
    try {
      await api.post(
        "/api/Retrait",
        {
          documentId: selectedDoc.id,
          reference: selectedDoc.reference,
          effectuePar,
          motifRetrait,
          notes,
          dateRetrait: dateRetrait || new Date().toISOString(),
          dateRetour: dateRetour || null,
          serviceArchives: userNom,
        },
        token
      );
      alert(langue === "fr" ? "Retrait enregistré" : "تم تسجيل الإخراج");
      setMotifRetrait("");
      setNotes("");
      setDateRetour("");
      setDateRetrait(new Date().toISOString().split("T")[0]);
      fetchRetraits();
    } catch {
      alert(langue === "fr" ? "Erreur serveur" : "خطأ في الخادم");
    }
    setLoading(false);
  };

  const handleAnnuler = async (id: number) => {
    if (!token) return;
    const msg = langue === "fr" ? "Annuler ce retrait ?" : "هل تريد إلغاء هذا الإخراج ?";
    if (!confirm(msg)) return;
    try {
      await api.patch(`/api/Retrait/${id}/annuler`, undefined, token);
      alert(langue === "fr" ? "Retrait annulé" : "تم الإلغاء");
      fetchRetraits();
    } catch {
      alert(langue === "fr" ? "Erreur lors de l'annulation du retrait" : "خطأ في إلغاء الإخراج");
    }
  };

  const handleRetourner = async (id: number) => {
    if (!token) return;
    try {
      await api.patch(`/api/Retrait/${id}/retourner`, undefined, token);
      alert(langue === "fr" ? "Document retourné" : "تم إرجاع الوثيقة");
      fetchRetraits();
    } catch {
      alert(langue === "fr" ? "Erreur lors du retour du document" : "خطأ في إرجاع الوثيقة");
    }
  };

  if (!selectedDoc) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/40 flex items-start justify-center pt-8 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <p className="text-xs text-blue-600 font-bold">
              {langue === "fr" ? "Service archives" : "مصلحة الأرشيف"} | RE: {selectedDoc.reference}
            </p>
            <p className="text-sm font-bold text-slate-900 mt-1">{selectedDoc.objet}</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100">
            {cur.fermer}
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {langue === "fr" ? "Effectué par" : "تنفيذ"}
              </label>
              <input
                type="text"
                value={effectuePar}
                onChange={(e) => setEffectuePar(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {langue === "fr" ? "* Motif du retrait" : "* سبب الإخراج"}
              </label>
              <input
                type="text"
                value={motifRetrait}
                onChange={(e) => setMotifRetrait(e.target.value)}
                placeholder={langue === "fr" ? "Motif du retrait" : "سبب الإخراج"}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {langue === "fr" ? "Date de retour (Optionnel)" : "تاريخ الإرجاع (اختياري)"}
              </label>
              <input
                type="date"
                value={dateRetour}
                onChange={(e) => setDateRetour(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {langue === "fr" ? "Date du retrait" : "تاريخ الإخراج"}
              </label>
              <input
                type="date"
                value={dateRetrait}
                onChange={(e) => setDateRetrait(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {langue === "fr" ? "Notes" : "ملاحظات"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 resize-none"
            />
          </div>
          {canRetrait && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-blue-900 text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-40 transition"
            >
              {langue === "fr" ? "Enregistrer le retrait" : "تسجيل الإخراج"}
            </button>
          </div>
          )}
        </div>

        <div className="border-t border-slate-200">
          <div className="p-4 bg-slate-900 text-white font-bold text-xs">
            {langue === "fr" ? "Historique des retraits" : "سجل الإخراجات"}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="p-3 text-start">{cur.tblActions}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Notes" : "ملاحظات"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Date de retour" : "تاريخ الإرجاع"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Effectué par" : "تنفيذ"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Motif du retrait" : "سبب الإخراج"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Date du retrait" : "تاريخ الإخراج"}</th>
                </tr>
              </thead>
              <tbody>
                {retraits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                      {langue === "fr" ? "Aucun retrait enregistré" : "لا توجد إخراجات مسجلة"}
                    </td>
                  </tr>
                ) : (
                  retraits.map((r) => (
                    <tr key={r.id} className={`border-b border-slate-100 ${r.estAnnule ? "bg-red-50/50 opacity-60" : "hover:bg-slate-50"}`}>
                      <td className="p-3 space-x-1">
                        {canRetrait && (
                        <>
                        <button
                          type="button"
                          onClick={() => handleAnnuler(r.id)}
                          disabled={r.estAnnule}
                          className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold hover:bg-red-700 disabled:opacity-40"
                        >
                          {langue === "fr" ? "Annuler le retrait" : "إلغاء الإخراج"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRetourner(r.id)}
                          disabled={r.estAnnule || !!r.dateRetour}
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 text-[10px] font-bold hover:bg-slate-50 disabled:opacity-40"
                        >
                          {langue === "fr" ? "retourner" : "إرجاع"}
                        </button>
                        </>
                        )}
                      </td>
                      <td className="p-3">{r.notes || "-"}</td>
                      <td className="p-3">{r.dateRetour ? new Date(r.dateRetour).toLocaleDateString() : "-"}</td>
                      <td className="p-3">{r.effectuePar}</td>
                      <td className="p-3">{r.motifRetrait}</td>
                      <td className="p-3">{new Date(r.dateRetrait).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
