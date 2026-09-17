// app/components/forms/AdminForm.tsx
//
// "Courrier Administratif" sub-tab of the consolidated "Gérer les courriers"
// module. Field set follows the reference layout:
//   Source · Date d'arrivée · Date du message · Numéro interne · N° Bureau d'ordre
//   Transmissible · État · Service · Objet
//   Document · Notes
// `N° de bureau` (creator user id + year) and `Service` (creator's originating
// service) are system-assigned and rendered read-only.

"use client";

import type { TranslationKeys } from "@/lib/translations";

import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServiceOptions } from "@/app/hooks/useServiceOptions";
import { useServiceLabels } from "@/app/hooks/useServiceLabels";

interface AdminFormProps {
  source: string;
  setSource: (v: string) => void;
  dateArrivee: string;
  setDateArrivee: (v: string) => void;
  dateMessage: string;
  setDateMessage: (v: string) => void;
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
  /** `Numéro interne` — the unique reference of the folder. */
  reference: string;
  setReference: (v: string) => void;
  objet: string;
  setObjet: (v: string) => void;
}

export function AdminForm({
  source,
  setSource,
  dateArrivee,
  setDateArrivee,
  dateMessage,
  setDateMessage,
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
  setObjet
}: AdminFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, token } = useAuth();

  // Destination services come from the live catalog: anything added in the
  // admin panel becomes selectable immediately.
  const { groups: serviceGroups } = useServiceOptions(token, langue);
  const { getServiceLabel } = useServiceLabels(token, langue);

  // ── System-assigned values ──
  // N° de bureau = the id of the user creating the folder (a service can host
  // several users). The year is appended by the backend and shown as a hint.
  const annee = new Date().getFullYear();
  // Service d'origine = the creator's current service (dynamic label).
  const serviceOrigineLabel = user?.service
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
    <>
      {/* ===== LIGNE 1 : Source · Dates · Numéro interne · N° bureau ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div>
          <label htmlFor="admin-source" className={labelClass}>
            {cur.tblSource} <span className="text-red-500">*</span>
          </label>
          <select
            id="admin-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={fieldClass}
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
          <label htmlFor="admin-date-arrivee" className={labelClass}>
            {cur.dateArrivee} <span className="text-red-500">*</span>
          </label>
          <input
            id="admin-date-arrivee"
            type="date"
            value={dateArrivee}
            onChange={(e) => setDateArrivee(e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label htmlFor="admin-date-message" className={labelClass}>{cur.dateMessage}</label>
          <input
            id="admin-date-message"
            type="date"
            value={dateMessage}
            onChange={(e) => setDateMessage(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="admin-ref" className={labelClass}>{cur.numeroInterne} <span className="text-red-500">*</span></label>
          <input
            id="admin-ref"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={cur.recherche_exemple}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label htmlFor="admin-numero-bureau" className={labelClass}>{cur.numeroBureau}</label>
          <input
            id="admin-numero-bureau"
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
      </div>

      {/* ===== LIGNE 2 : Transmissible · État · Service · Objet ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div>
          <span className={labelClass}>{cur.transmissible}</span>
          <label htmlFor="admin-transmissible-oui" className="flex items-center gap-2 text-xs font-medium mt-1">
            <input
              id="admin-transmissible-oui"
              type="checkbox"
              checked={transmissible === "Oui"}
              onChange={(e) => setTransmissible(e.target.checked ? "Oui" : "Non")}
              className="w-4 h-4 text-blue-600"
            />
            {cur.oui}
          </label>
        </div>

        <div>
          <label htmlFor="admin-etat" className={labelClass}>{cur.etat}</label>
          <select
            id="admin-etat"
            value={etat}
            onChange={(e) => setEtat(e.target.value)}
            className={fieldClass}
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

        <div>
          <label htmlFor="admin-service-origine" className={labelClass}>
            {cur.service} <span className="text-red-500">*</span>
          </label>
          <input
            id="admin-service-origine"
            type="text"
            value={serviceOrigineLabel}
            readOnly
            aria-readonly="true"
            className={readonlyClass}
          />
        </div>

        <div>
          <label htmlFor="admin-objet" className={labelClass}>
            {cur.tblTitre} <span className="text-red-500">*</span>
          </label>
          <input
            id="admin-objet"
            type="text"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            placeholder={cur.sujet_placeholder}
            className={fieldClass}
            required
          />
        </div>
      </div>

      {/* ===== LIGNE 3 : Document (pleine largeur) ===== */}
      <div>
        <label htmlFor="admin-fichier" className={labelClass}>{cur.documentPdfWord}</label>
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
              id="admin-fichier"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* ===== LIGNE 4 : Notes (pleine largeur) ===== */}
      <div>
        <label htmlFor="admin-notes" className={labelClass}>{cur.notes}</label>
        <textarea
          id="admin-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={cur.commentaire}
          className={fieldClass}
        />
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
