// app/components/forms/SortantForm.tsx
//
// "Courrier Sortant" sub-tab of the consolidated "Gérer les courriers" module.
// Field order mirrors the reference layout:
//   N° Bureau d'ordre · Service · Destinataire · Objet · Date
//   Document PDF / Word (full width)
//   Notes (full width)
// `Service` (creator's originating service) and `N° Bureau d'ordre`
// (creator user id + year) are system-assigned and rendered read-only.

"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServiceLabels } from "@/app/hooks/useServiceLabels";

interface SortantFormProps {
  destinataire: string;
  setDestinataire: (v: string) => void;
  objet: string;
  setObjet: (v: string) => void;
  dateEnvoi: string;
  setDateEnvoi: (v: string) => void;
  typeCourrier: string;
  cur: TranslationKeys;
  notes: string;
  setNotes: (v: string) => void;
  fichier: File | null;
  setFichier: (f: File | null) => void;
  langue: "fr" | "ar";
}

export function SortantForm({
  destinataire,
  setDestinataire,
  objet,
  setObjet,
  dateEnvoi,
  setDateEnvoi,
  cur,
  notes,
  setNotes,
  fichier,
  setFichier,
  langue
}: SortantFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, token } = useAuth();
  const { getServiceLabel } = useServiceLabels(token, langue);

  // ── System-assigned values ──
  const annee = new Date().getFullYear();
  const serviceLabel = user?.service
    ? getServiceLabel(user.service) || user.service
    : "";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFichier(e.target.files[0]);
    }
  };

  const fieldClass =
    "w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white";
  const labelClass = "block text-xs font-bold text-slate-700 mb-2";
  const readonlyClass =
    "w-full border border-slate-200 p-2.5 rounded-lg text-xs bg-slate-50 text-slate-600";

  return (
    <div className="space-y-4">
      {/* ===== LIGNE 1 : N° bureau · Service · Destinataire · Objet · Date ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div>
          <label htmlFor="sortant-bo" className={labelClass}>{cur.numeroBureau}</label>
          <input
            id="sortant-bo"
            type="text"
            value={user?.id ?? ""}
            readOnly
            aria-readonly="true"
            placeholder="15"
            className={readonlyClass}
          />
          <p className="text-[10px] text-slate-400 mt-1 text-end">
            {annee} / {cur.autoYearSuffix}
          </p>
        </div>

        <div>
          <label htmlFor="sortant-service" className={labelClass}>
            {cur.service} <span className="text-red-500">*</span>
          </label>
          <input
            id="sortant-service"
            type="text"
            value={serviceLabel}
            readOnly
            aria-readonly="true"
            className={readonlyClass}
          />
        </div>

        <div>
          <label htmlFor="sortant-destinataire" className={labelClass}>{cur.destinataireLabel}</label>
          <input
            id="sortant-destinataire"
            type="text"
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value)}
            placeholder={`-- ${cur.choisirService} --`}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="sortant-objet" className={labelClass}>
            {cur.objetLabel} <span className="text-red-500">*</span>
          </label>
          <input
            id="sortant-objet"
            type="text"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label htmlFor="sortant-date-envoi" className={labelClass}>
            {cur.tblDate} <span className="text-red-500">*</span>
          </label>
          <input
            id="sortant-date-envoi"
            type="date"
            value={dateEnvoi}
            onChange={(e) => setDateEnvoi(e.target.value)}
            className={fieldClass}
            required
          />
        </div>
      </div>

      {/* ===== LIGNE 2 : Document PDF / Word (pleine largeur) ===== */}
      <div>
        <label htmlFor="sortant-fichier" className={labelClass}>{cur.documentPdfWord}</label>
        <div className="flex items-center gap-3">
          <div
            className="flex-1 min-w-0 border border-slate-200 bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-500 truncate"
            title={fichier?.name}
          >
            {fichier ? fichier.name : cur.aucunFichier}
          </div>
          <label className="cursor-pointer whitespace-nowrap border border-slate-300 rounded-lg px-6 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition">
            {cur.choisirFichier}
            <input
              id="sortant-fichier"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* ===== LIGNE 3 : Notes (pleine largeur) ===== */}
      <div>
        <label htmlFor="sortant-notes" className={labelClass}>{cur.notes}</label>
        <textarea
          id="sortant-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={cur.commentaire}
          className={fieldClass}
        />
      </div>
    </div>
  );
}
