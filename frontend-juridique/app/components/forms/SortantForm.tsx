"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useRef } from "react";
import { SERVICE_GROUPS } from "@/lib/constants";

interface SortantFormProps {
  // Champs existants
  dateEnvoi: string;
  setDateEnvoi: (v: string) => void;
  typeCourrier: string;
  vueActive: string;
  cur: TranslationKeys;
  // Nouveaux champs
  service: string;
  setService: (v: string) => void;
  numeroBureauOrdre: string;
  setNumeroBureauOrdre: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  fichier: File | null;
  setFichier: (f: File | null) => void;
  langue: "fr" | "ar";
  tribunalOrigine: string;
  setTribunalOrigine: (v: string) => void;
  tribunalDestination: string;
  setTribunalDestination: (v: string) => void;
}

export function SortantForm({
  dateEnvoi,
  setDateEnvoi,
  typeCourrier,
  cur,
  service,
  setService,
  numeroBureauOrdre,
  setNumeroBureauOrdre,
  notes,
  setNotes,
  fichier,
  setFichier,
  langue,
  tribunalOrigine,
  setTribunalOrigine,
  tribunalDestination,
  setTribunalDestination
}: SortantFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFichier(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Champs existants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.dateEnvoi} <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={dateEnvoi}
            onChange={(e) => setDateEnvoi(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50/50"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.typeCourrier}</label>
          <input
            type="text"
            value={typeCourrier}
            disabled
            className="w-full p-3 border border-slate-300 rounded-lg text-xs bg-slate-100 text-slate-600"
          />
        </div>
      </div>

      {/* Nouveaux champs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Service */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.service} <span className="text-red-500">*</span></label>
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          >
            <option value="">-- {cur.choisirService} --</option>
            {SERVICE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.fr}>
                {group.children.map((svc) => (
                  <option key={svc.value} value={svc.value}>
                    {langue === "fr" ? svc.fr : svc.ar}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Numéro de bureau d'ordre */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.numeroBureauOrdre}</label>
          <input
            type="text"
            value={numeroBureauOrdre}
            onChange={(e) => setNumeroBureauOrdre(e.target.value)}
            placeholder="BO-2026-123"
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tribunal d'origine */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {cur.tribunalOrigine}
          </label>
          <input
            type="text"
            value={tribunalOrigine}
            onChange={(e) => setTribunalOrigine(e.target.value)}
            placeholder={cur.tribunalOrigine}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>

        {/* Tribunal de destination */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {cur.tribunalDestination}
          </label>
          <input
            type="text"
            value={tribunalDestination}
            onChange={(e) => setTribunalDestination(e.target.value)}
            placeholder={cur.tribunalDestination}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Document PDF/Word */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.fichier}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="w-full border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-blue-500 bg-white file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {fichier && <p className="text-[10px] text-slate-500 mt-1">{fichier.name}</p>}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.notes}</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={cur.commentaire}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
      </div>
    </div>
  );
}