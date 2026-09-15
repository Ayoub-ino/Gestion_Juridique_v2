// app/components/forms/AdminForm.tsx

"use client";

import type { TranslationKeys } from "@/lib/translations";

import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServiceOptions } from "@/app/hooks/useServiceOptions";

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
  const { token } = useAuth();

  // Destination services come from the live catalog: anything added in the
  // admin panel becomes selectable immediately.
  const { groups: serviceGroups } = useServiceOptions(token, langue);

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
          <label htmlFor="admin-ref" className="block text-xs font-bold text-slate-700 mb-2">
            {cur.tblRef} <span className="text-red-500">*</span>
          </label>
          <input
            id="admin-ref"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={cur.recherche_exemple}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            required
          />
        </div>
        <div>
          <label htmlFor="admin-titre" className="block text-xs font-bold text-slate-700 mb-2">
            {cur.tblTitre} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="admin-titre"
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
        <label htmlFor="admin-service-origine" className="block text-xs font-bold text-slate-700 mb-2">
          {cur.serviceOrigine}
        </label>
        <input
          id="admin-service-origine"
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
          <label htmlFor="admin-provenance" className="block text-xs font-bold text-slate-700 mb-2">
            {cur.provenance} <span className="text-red-500">*</span>
          </label>
          <input
            id="admin-provenance"
            type="text"
            value={expediteur}
            onChange={(e) => setExpediteur(e.target.value)}
            placeholder={cur.provenance}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            required
          />
        </div>
        <div>
          <label htmlFor="admin-date-arrivee" className="block text-xs font-bold text-slate-700 mb-2">{cur.dateArrivee} <span className="text-red-500">*</span></label>
          <input
            id="admin-date-arrivee"
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
          <label htmlFor="admin-source" className="block text-xs font-bold text-slate-700 mb-2">
            {cur.tblSource} <span className="text-red-500">*</span>
          </label>
          <select
            id="admin-source"
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
          <label htmlFor="admin-date-message" className="block text-xs font-bold text-slate-700 mb-2">{cur.dateMessage}</label>
          <input
            id="admin-date-message"
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
          <label htmlFor="admin-numero-interne" className="block text-xs font-bold text-slate-700 mb-2">{cur.numeroInterne}</label>
          <input
            id="admin-numero-interne"
            type="text"
            value={numeroInterne}
            onChange={(e) => setNumeroInterne(e.target.value)}
            placeholder="15"
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
        <div>
          <label htmlFor="admin-annee" className="block text-xs font-bold text-slate-700 mb-2">{cur.anneeNumerotation}</label>
          <input
            id="admin-annee"
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
          <span className="block text-xs font-bold text-slate-700 mb-2">{cur.transmissible}</span>
          <div className="flex gap-4 mt-1">
            <label htmlFor="admin-transmissible-oui" className="flex items-center gap-2 text-xs font-medium">
              <input
                id="admin-transmissible-oui"
                type="radio"
                name="transmissible"
                value="Oui"
                checked={transmissible === "Oui"}
                onChange={() => setTransmissible("Oui")}
              />
              {cur.oui}
            </label>
            <label htmlFor="admin-transmissible-non" className="flex items-center gap-2 text-xs font-medium">
              <input
                id="admin-transmissible-non"
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
          <label htmlFor="admin-etat" className="block text-xs font-bold text-slate-700 mb-2">{cur.etat}</label>
          <select
            id="admin-etat"
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
          <label htmlFor="admin-fichier" className="block text-xs font-bold text-slate-700 mb-2">{cur.fichier}</label>
          <input
            id="admin-fichier"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="w-full border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-blue-500 bg-white file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {fichier && <p className="text-[10px] text-slate-500 mt-1">{fichier.name}</p>}
        </div>
        <div>
          <label htmlFor="admin-notes" className="block text-xs font-bold text-slate-700 mb-2">{cur.notes}</label>
          <textarea
            id="admin-notes"
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
          <span className="block text-xs font-bold text-slate-800 mb-2">{cur.modeTraitement} <span className="text-red-500">*</span></span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { value: "archivage", label: cur.archivage },
              { value: "unique", label: cur.unique },
              { value: "diffusion", label: cur.diffusion }
            ].map((option) => (
              <label
                key={option.value}
                htmlFor={`admin-mode-${option.value}`}
                className={`flex items-center gap-2 rounded-lg border p-3 text-xs font-bold cursor-pointer ${
                  modeTraitement === option.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                <input
                  id={`admin-mode-${option.value}`}
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
            <span className="block text-xs font-bold text-slate-800 mb-2">{cur.serviceDest}</span>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {serviceGroups.map((group) => (
                  <div key={group.key}>
                    <p className="text-[10px] font-bold text-slate-500 mb-1">{group.label}</p>
                    <div className="space-y-1">
                      {group.children.map((svc) => (
                        <label
                          key={svc.value}
                          htmlFor={`admin-dest-${svc.value}`}
                          className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold cursor-pointer ${
                            serviceDestinataire === svc.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          <input
                            id={`admin-dest-${svc.value}`}
                            type="radio"
                            name="serviceDestinataire"
                            checked={serviceDestinataire === svc.value}
                            onChange={() => setServiceDestinataire(svc.value)}
                            required
                          />
                          {svc.label}
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
            <span className="block text-xs font-bold text-slate-800 mb-2">{cur.servicesDiff}</span>
            <div className="grid grid-cols-2 gap-2 bg-white p-4 border border-slate-300 rounded-lg max-h-48 overflow-y-auto">
              {serviceGroups.map((group) => (
                <div key={group.key}>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">{group.label}</p>
                  {group.children.map((svc) => (
                    <label key={svc.value} htmlFor={`admin-diff-${svc.value}`} className="flex items-center gap-2 text-xs font-medium">
                      <input
                        id={`admin-diff-${svc.value}`}
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
                      {svc.label}
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