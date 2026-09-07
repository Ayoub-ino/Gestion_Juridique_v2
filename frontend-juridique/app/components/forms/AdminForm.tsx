// app/components/forms/AdminForm.tsx

"use client";

import type { TranslationKeys } from "@/lib/translations";

import { useRef } from "react";
import { SERVICE_GROUPS } from "@/lib/constants";

interface AdminFormProps {
  expediteur: string;
  setExpediteur: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
  dateArrivee: string;
  setDateArrivee: (v: string) => void;
  dateMessage: string;
  setDateMessage: (v: string) => void;
  numeroInterne: string;
  setNumeroInterne: (v: string) => void;
  anneeNumerotation: string;
  setAnneeNumerotation: (v: string) => void;
  transmissible: string;
  setTransmissible: (v: string) => void;
  etat: string;
  setEtat: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  fichier: File | null;
  setFichier: (f: File | null) => void;
  modeTraitement: string;
  setModeTraitement: (v: string) => void;
  serviceDestinataire: string;
  setServiceDestinataire: (v: string) => void;
  servicesDiffusion: string[];
  setServicesDiffusion: (v: string[]) => void;
  langue: "fr" | "ar";
  cur: TranslationKeys;
  sourceOptions?: { value: string; label: string }[];
  etatOptions?: { value: string; label: string }[];
  serviceOptions?: { value: string; label: string }[];
  reference: string;
  setReference: (v: string) => void;
  objet: string;
  setObjet: (v: string) => void;
  serviceOrigine: string;
  setServiceOrigine: (v: string) => void;
  canEditService: boolean;
}

export function AdminForm({
  expediteur,
  setExpediteur,
  source,
  setSource,
  dateArrivee,
  setDateArrivee,
  dateMessage,
  setDateMessage,
  numeroInterne,
  setNumeroInterne,
  anneeNumerotation,
  setAnneeNumerotation,
  transmissible,
  setTransmissible,
  etat,
  setEtat,
  notes,
  setNotes,
  fichier,
  setFichier,
  modeTraitement,
  setModeTraitement,
  serviceDestinataire,
  setServiceDestinataire,
  servicesDiffusion,
  setServicesDiffusion,
  langue,
  cur,
  sourceOptions,
  etatOptions,
  reference,
  setReference,
  objet,
  setObjet,
  serviceOrigine,
  setServiceOrigine,
  canEditService
}: AdminFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFichier(e.target.files[0]);
    }
  };

  return (
    <>
      {/* ===== Référence & Objet ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {cur.tblRef} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={cur.recherche_exemple}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {cur.tblTitre} <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={2}
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            placeholder={cur.sujet_placeholder}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            required
          />
        </div>
      </div>

      {/* ===== Service ===== */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">
          {cur.serviceOrigine}
        </label>
        <input
          type="text"
          value={serviceOrigine}
          onChange={(e) => setServiceOrigine(e.target.value)}
          disabled={!canEditService}
          className={`w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 ${canEditService ? "bg-white" : "bg-slate-100 text-slate-500"}`}
          required
        />
      </div>

      {/* ===== LIGNE 1 : المرسل (Expéditeur) - TEXTE LIBRE ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {cur.provenance} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={expediteur}
            onChange={(e) => setExpediteur(e.target.value)}
            placeholder={cur.provenance}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.dateArrivee} <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={dateArrivee}
            onChange={(e) => setDateArrivee(e.target.value)}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            required
          />
        </div>
      </div>

      {/* ===== LIGNE 2 : المصدر (Source) - DROPDOWN ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {cur.tblSource} <span className="text-red-500">*</span>
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            required
          >
            <option value="">-- {cur.choisirService} --</option>
            {(sourceOptions && sourceOptions.length > 0 ? sourceOptions : [
              { value: "Ministère", label: langue === "fr" ? "Ministère" : "وزارة" },
              { value: "Direction", label: langue === "fr" ? "Direction" : "مديرية" },
              { value: "Service", label: langue === "fr" ? "Service" : "مصلحة" },
              { value: "Autre", label: langue === "fr" ? "Autre" : "أخرى" }
            ]).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.dateMessage}</label>
          <input
            type="date"
            value={dateMessage}
            onChange={(e) => setDateMessage(e.target.value)}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {/* ===== LIGNE 3 : Numéro interne & Année de numérotation ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.numeroInterne}</label>
          <input
            type="text"
            value={numeroInterne}
            onChange={(e) => setNumeroInterne(e.target.value)}
            placeholder="15"
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.anneeNumerotation}</label>
          <input
            type="text"
            value={anneeNumerotation}
            onChange={(e) => setAnneeNumerotation(e.target.value)}
            placeholder="/ 2026"
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {/* ===== LIGNE 4 : Transmissible & État ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.transmissible}</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="radio"
                name="transmissible"
                value="Oui"
                checked={transmissible === "Oui"}
                onChange={() => setTransmissible("Oui")}
              />
              {cur.oui}
            </label>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="radio"
                name="transmissible"
                value="Non"
                checked={transmissible === "Non"}
                onChange={() => setTransmissible("Non")}
              />
              {cur.non}
            </label>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.etat}</label>
          <select
            value={etat}
            onChange={(e) => setEtat(e.target.value)}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          >
            <option value="">-- {cur.choisirEtat} --</option>
            {(etatOptions && etatOptions.length > 0 ? etatOptions : [
              { value: "Reçu", label: langue === "fr" ? "Reçu" : "وارد" },
              { value: "En cours", label: cur.enCours },
              { value: "Traité", label: langue === "fr" ? "Traité" : "معالج" },
              { value: "Classé", label: langue === "fr" ? "Classé" : "مصنف" }
            ]).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== LIGNE 5 : Fichier & Notes ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* ===== MODE DE TRAITEMENT ===== */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-2">{cur.modeTraitement} <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { value: "archivage", label: cur.archivage },
              { value: "unique", label: cur.unique },
              { value: "diffusion", label: cur.diffusion }
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-2 rounded-lg border p-3 text-xs font-bold cursor-pointer ${
                  modeTraitement === option.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="modeTraitement"
                  checked={modeTraitement === option.value}
                  onChange={() => {
                    setModeTraitement(option.value);
                    setServiceDestinataire("");
                    setServicesDiffusion([]);
                  }}
                  required
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        {modeTraitement === "unique" && (
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">{cur.serviceDest}</label>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SERVICE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] font-bold text-slate-500 mb-1">{group.fr}</p>
                    <div className="space-y-1">
                      {group.children.map((svc) => (
                        <label
                          key={svc.value}
                          className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold cursor-pointer ${
                            serviceDestinataire === svc.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          <input
                            type="radio"
                            name="serviceDestinataire"
                            checked={serviceDestinataire === svc.value}
                            onChange={() => setServiceDestinataire(svc.value)}
                            required
                          />
                          {langue === "fr" ? svc.fr : svc.ar}
                        </label>
                      ))}
                    </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {modeTraitement === "diffusion" && (
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">{cur.servicesDiff}</label>
            <div className="grid grid-cols-2 gap-2 bg-white p-4 border border-slate-300 rounded-lg max-h-48 overflow-y-auto">
              {SERVICE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">{group.fr}</p>
                  {group.children.map((svc) => (
                    <label key={svc.value} className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        value={svc.value}
                        checked={Boolean(servicesDiffusion.includes(svc.value))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setServicesDiffusion([...servicesDiffusion, svc.value]);
                          } else {
                            setServicesDiffusion(servicesDiffusion.filter(v => v !== svc.value));
                          }
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      {langue === "fr" ? svc.fr : svc.ar}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            {servicesDiffusion.length > 0 && (
              <p className="text-xs text-emerald-600 font-bold mt-2">
                {servicesDiffusion.length} {cur.nbServices}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}