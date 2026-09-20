// app/components/forms/JuridiqueForm.tsx

"use client";

import type { TranslationKeys } from "@/lib/translations";

import { useEffect, useRef, useState } from "react";
import { Langue } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { useServiceLabels } from "@/app/hooks/useServiceLabels";
import { useServiceOptions } from "@/app/hooks/useServiceOptions";
import { api } from "@/lib/api/client";

interface JuridiqueFormProps {
  // Champs
  docLie: string;
  setDocLie: (v: string) => void;
  dossierPrincipal: string;
  setDossierPrincipal: (v: string) => void;
  sourceDocLie: string;
  setSourceDocLie: (v: string) => void;
  parentDossier: string;
  setParentDossier: (v: string) => void;
  juridiqueDate: string;
  setJuridiqueDate: (v: string) => void;
  juridiqueEtat: string;
  setJuridiqueEtat: (v: string) => void;
  linkedDocumentType: string;
  setLinkedDocumentType: (v: string) => void;
  typeDossier: string;
  setTypeDossier: (v: string) => void;
  numeroPremiereInstance: string;
  setNumeroPremiereInstance: (v: string) => void;
  /** « Numéro de dossier (Cour d'Appel) » — stored as NumeroDossierJuridique. */
  numeroDossierAppel: string;
  setNumeroDossierAppel: (v: string) => void;
  juridiqueNotes: string;
  setJuridiqueNotes: (v: string) => void;
  juridiqueFichier: File | null;
  setJuridiqueFichier: (f: File | null) => void;

  // Références communes
  reference: string;
  setReference: (v: string) => void;
  tiers: string;
  setTiers: (v: string) => void;
  objet: string;
  setObjet: (v: string) => void;
  /** Options of the dedicated "tribunaux" list (falls back to a built-in list). */
  tribunalOptions?: { value: string; label: string }[];
  langue: Langue;
  cur: TranslationKeys;

  // Destination du dossier (remplace le circuit de traitement)
  /** RBAC code of the service the folder is sent to. Empty = kept in place. */
  serviceDestination: string;
  setServiceDestination: (v: string) => void;
  /** Named recipients inside that service. Empty = the whole service. */
  recipientUserIds: number[];
  setRecipientUserIds: (ids: number[]) => void;
}

export function JuridiqueForm({
  docLie,
  setDocLie,
  dossierPrincipal,
  setDossierPrincipal,
  sourceDocLie,
  setSourceDocLie,
  parentDossier,
  setParentDossier,
  juridiqueDate,
  setJuridiqueDate,
  juridiqueEtat,
  setJuridiqueEtat,
  linkedDocumentType,
  setLinkedDocumentType,
  typeDossier,
  setTypeDossier,
  numeroPremiereInstance,
  setNumeroPremiereInstance,
  numeroDossierAppel,
  setNumeroDossierAppel,
  juridiqueNotes,
  setJuridiqueNotes,
  juridiqueFichier,
  setJuridiqueFichier,
  reference,
  setReference,
  tiers,
  setTiers,
  objet,
  setObjet,
  tribunalOptions,
  langue,
  cur,
  serviceDestination,
  setServiceDestination,
  recipientUserIds,
  setRecipientUserIds
}: JuridiqueFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, token } = useAuth();
  const { getServiceLabel } = useServiceLabels(token, langue);

  // Destination pickers read the LIVE catalog, so a service created (or
  // archived) from the admin panel shows up — or disappears — immediately.
  const { groups, historicalOptions, isHistorical } = useServiceOptions(token, langue);

  // ── System-assigned values ──
  // N° de bureau = id of the creating user (a service can host several users).
  const annee = new Date().getFullYear();
  // Service d'origine = the creator's current service (dynamic label).
  const serviceOrigineLabel = user?.service
    ? getServiceLabel(user.service) || user.service
    : "";

  // Existing dossiers, used by "Choisir un dossier parent". A linked document
  // is attached to an already-created folder and therefore shares its
  // identification number (the only case where two dossiers may do so).
  const [existingDossiers, setExistingDossiers] = useState<Array<{ id: number; numeroReference: string; objet: string }>>([]);
  const [parentSearchTerm, setParentSearchTerm] = useState("");
  const [showParentDropdown, setShowParentDropdown] = useState(false);

  // Users of the chosen destination service. The list is scoped to that one
  // service so the sender can address a specific person, or nobody (in which
  // case the folder goes to the service and every member can work on it).
  const [serviceUsers, setServiceUsers] = useState<Array<{ id: number; nom: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!token || docLie !== "Oui") return;
    let cancelled = false;
    api.get<Array<{ id: number; numeroReference: string; objet: string }>>("/api/CourrierJuridique", token)
      .then((rows) => {
        if (!cancelled) setExistingDossiers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => { /* dropdown simply stays empty */ });
    return () => { cancelled = true; };
  }, [token, docLie]);

  useEffect(() => {
    // Record-only destinations have no accounts to address.
    if (!token || !serviceDestination || isHistorical(serviceDestination)) {
      setServiceUsers([]);
      setRecipientUserIds([]);
      return;
    }

    let cancelled = false;
    setLoadingUsers(true);
    api
      .get<Array<{ id: number; nom: string }>>(
        `/api/Users/by-service/${encodeURIComponent(serviceDestination)}`,
        token
      )
      .then((rows) => {
        if (!cancelled) setServiceUsers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setServiceUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });

    // Changing service invalidates the previously chosen recipients.
    setRecipientUserIds([]);

    return () => { cancelled = true; };
  }, [token, serviceDestination, isHistorical, setRecipientUserIds]);

  // Options traduites
  // "Tribunal / Source" draws on its own "tribunaux" list rather than reusing
  // the Source list, so the two can be curated independently from
  // « Listes dynamiques ». The built-in list below is only a fallback for a
  // database whose tribunal list has not been filled in yet.
  const getTribunalOptions = () => {
    const builtIn = [
      { value: "caa_fes", fr: "Cour d'appel administrative de Fès", ar: "محكمة الاستئناف الإدارية بفاس" },
      { value: "caa_rabat", fr: "Cour d'appel administrative de Rabat", ar: "محكمة الاستئناف الإدارية بالرباط" },
      { value: "caa_casablanca", fr: "Cour d'appel administrative de Casablanca", ar: "محكمة الاستئناف الإدارية بالدار البيضاء" },
      { value: "caa_marrakech", fr: "Cour d'appel administrative de Marrakech", ar: "محكمة الاستئناف الإدارية بمراكش" },
      { value: "caa_tanger", fr: "Cour d'appel administrative de Tanger", ar: "محكمة الاستئناف الإدارية بطنجة" },
      { value: "caa_agadir", fr: "Cour d'appel administrative d'Agadir", ar: "محكمة الاستئناف الإدارية بأكادير" },
      { value: "caa_oujda", fr: "Cour d'appel administrative d'Oujda", ar: "محكمة الاستئناف الإدارية بوجدة" },
      { value: "ta_fes", fr: "Tribunal administratif de Fès", ar: "المحكمة الإدارية بفاس" },
      { value: "ta_meknes", fr: "Tribunal administratif de Meknès", ar: "المحكمة الإدارية بمكناس" },
      { value: "ta_taza", fr: "Tribunal administratif de Taza", ar: "المحكمة الإدارية بتازة" }
    ];
    return builtIn.map((t) => ({ value: t.value, label: langue === "fr" ? t.fr : t.ar }));
  };

  const getSourceOptions = () => {
    if (langue === "fr") {
      return [
        { value: "Ministère", label: "Ministère" },
        { value: "Direction", label: "Direction" },
        { value: "Service", label: "Service" },
        { value: "Autre", label: "Autre" }
      ];
    } else {
      return [
        { value: "Ministère", label: "وزارة" },
        { value: "Direction", label: "مديرية" },
        { value: "Service", label: "مصلحة" },
        { value: "Autre", label: "أخرى" }
      ];
    }
  };

  const getTypeDossierOptions = () => {
    if (langue === "fr") {
      return [
        { value: "Ordinaire", label: "Ordinaire" },
        { value: "Urgent", label: "Urgent" },
        { value: "Très urgent", label: "Très urgent" }
      ];
    } else {
      return [
        { value: "Ordinaire", label: "عادي" },
        { value: "Urgent", label: "مستعجل" },
        { value: "Très urgent", label: "مستعجل جداً" }
      ];
    }
  };

  const getEtatOptions = () => {
    if (langue === "fr") {
      return [
        { value: "Reçu", label: "Reçu" },
        { value: "En cours", label: "En cours" },
        { value: "Traité", label: "Traité" },
        { value: "Classé", label: "Classé" }
      ];
    } else {
      return [
        { value: "Reçu", label: "وارد" },
        { value: "En cours", label: "قيد المعالجة" },
        { value: "Traité", label: "معالج" },
        { value: "Classé", label: "مصنف" }
      ];
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setJuridiqueFichier(e.target.files[0]);
    }
  };

  const destinationIsHistorical = isHistorical(serviceDestination);
  const chosenServiceLabel =
    groups
      .flatMap((g) => g.children)
      .concat(historicalOptions)
      .find((s) => s.value === serviceDestination)?.label || serviceDestination;

  return (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
      {/* ===== CHAMPS DU DOSSIER ===== */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-slate-800">{cur.juridique}</h3>

        {/* Dossier principal / document lié */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            aria-pressed={docLie === "Oui"}
            onClick={() => { setDocLie("Oui"); setDossierPrincipal("Non"); }}
            className={`px-6 py-2.5 rounded-lg text-xs font-bold border transition ${docLie === "Oui" ? "bg-blue-800 text-white border-blue-800" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
          >
            {cur.documentLie}
          </button>
          <button
            type="button"
            aria-pressed={dossierPrincipal === "Oui"}
            onClick={() => { setDocLie("Non"); setDossierPrincipal("Oui"); }}
            className={`px-6 py-2.5 rounded-lg text-xs font-bold border transition ${dossierPrincipal === "Oui" ? "bg-blue-800 text-white border-blue-800" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
          >
            {cur.dossierPrincipalTab}
          </button>
        </div>

        {/* ===== LIGNE 1 ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {docLie === "Oui" ? (
            <>
              <div>
                <label htmlFor="jur-linked-type" className="block text-xs font-bold text-slate-700 mb-2">
                  {cur.typeDocumentLie}
                </label>
                <select
                  id="jur-linked-type"
                  value={linkedDocumentType}
                  onChange={(e) => setLinkedDocumentType(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">{langue === "fr" ? "Choisir" : "اختر"}</option>
                  {getTypeDossierOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="jur-source-doc" className="block text-xs font-bold text-slate-700 mb-2">
                  {cur.sourceDocumentLie} <span className="text-red-500">*</span>
                </label>
                <select
                  id="jur-source-doc"
                  value={sourceDocLie}
                  onChange={(e) => setSourceDocLie(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">{langue === "fr" ? "Choisir" : "اختر"}</option>
                  {getSourceOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="jur-parent-dossier" className="block text-xs font-bold text-slate-700 mb-2">
                  {cur.choisirDossierParent}
                </label>
                <div className="relative">
                  <input
                    id="jur-parent-dossier"
                    type="text"
                    value={parentDossier ? existingDossiers.find(d => d.numeroReference === parentDossier)?.numeroReference + " — " + existingDossiers.find(d => d.numeroReference === parentDossier)?.objet : parentSearchTerm}
                    onChange={(e) => {
                      setParentSearchTerm(e.target.value);
                      setParentDossier("");
                      setShowParentDropdown(true);
                    }}
                    onFocus={() => setShowParentDropdown(true)}
                    onBlur={() => setTimeout(() => setShowParentDropdown(false), 200)}
                    placeholder={cur.choisirDossierParent}
                    className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  />
                  {showParentDropdown && (
                    <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {existingDossiers
                        .filter((d) => {
                          const term = parentSearchTerm.toLowerCase();
                          return (
                            !term ||
                            d.numeroReference.toLowerCase().includes(term) ||
                            d.objet.toLowerCase().includes(term)
                          );
                        })
                        .map((d) => (
                          <li
                            key={d.id}
                            onMouseDown={() => {
                              setParentDossier(d.numeroReference);
                              setParentSearchTerm("");
                              setShowParentDropdown(false);
                            }}
                            className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                          >
                            <span className="font-bold text-slate-800">{d.numeroReference}</span>
                            <span className="text-slate-500 ml-2">— {d.objet}</span>
                          </li>
                        ))}
                      {existingDossiers.filter((d) => {
                        const term = parentSearchTerm.toLowerCase();
                        return !term || d.numeroReference.toLowerCase().includes(term) || d.objet.toLowerCase().includes(term);
                      }).length === 0 && (
                        <li className="px-3 py-2 text-xs text-slate-400 italic">{langue === "fr" ? "Aucun dossier trouvé" : "لم يتم العثور على ملف"}</li>
                      )}
                    </ul>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {langue === "fr"
                    ? "Le document lié partage le numéro du dossier parent."
                    : "الوثيقة المرتبطة تتقاسم رقم الملف الأصلي."}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="jur-objet" className="block text-xs font-bold text-slate-700 mb-2">
                  {cur.objetLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  id="jur-objet"
                  type="text"
                  value={objet}
                  onChange={(e) => setObjet(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  required
                />
              </div>
              <div>
                <label htmlFor="jur-tribunal" className="block text-xs font-bold text-slate-700 mb-2">
                  {cur.tribunalSource} <span className="text-red-500">*</span>
                </label>
                <select
                  id="jur-tribunal"
                  value={tiers}
                  onChange={(e) => setTiers(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">-- {cur.choisirService} --</option>
                  {(tribunalOptions && tribunalOptions.length > 0 ? tribunalOptions : getTribunalOptions()).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label htmlFor="jur-date" className="block text-xs font-bold text-slate-700 mb-2">
              {cur.tblDate} <span className="text-red-500">*</span>
            </label>
            <input
              id="jur-date"
              type="date"
              value={juridiqueDate}
              onChange={(e) => setJuridiqueDate(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
              required
            />
          </div>

          {docLie !== "Oui" && (
            <div>
              <label htmlFor="jur-num-dossier" className="block text-xs font-bold text-slate-700 mb-2">
                {cur.numeroDossierJuridique} <span className="text-red-500">*</span>
              </label>
              <input
                id="jur-num-dossier"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="2026/15/3"
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="jur-bo" className="block text-xs font-bold text-slate-700 mb-2">{cur.numeroBureau}</label>
            <input
              id="jur-bo"
              type="text"
              value={user?.id ?? ""}
              readOnly
              aria-readonly="true"
              placeholder="15"
              className="w-full border border-slate-200 p-2.5 rounded-lg text-xs bg-slate-50 text-slate-600"
            />
            <p className="text-[10px] text-slate-400 mt-1 text-end">
              {annee} / {cur.autoYearSuffix}
            </p>
          </div>
        </div>

        {/* ===== LIGNE 2 ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label htmlFor="jur-etat" className="block text-xs font-bold text-slate-700 mb-2">{cur.etat}</label>
            <select
              id="jur-etat"
              value={juridiqueEtat}
              onChange={(e) => setJuridiqueEtat(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            >
              <option value="">{cur.choisirEtat}</option>
              {getEtatOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="jur-service" className="block text-xs font-bold text-slate-700 mb-2">
              {cur.service} <span className="text-red-500">*</span>
            </label>
            <input
              id="jur-service"
              type="text"
              value={serviceOrigineLabel}
              readOnly
              aria-readonly="true"
              className="w-full border border-slate-200 p-2.5 rounded-lg text-xs bg-slate-50 text-slate-600"
            />
          </div>

          <div>
            <label htmlFor="jur-num-appel" className="block text-xs font-bold text-slate-700 mb-2">
              {cur.numDossierAppel} <span className="text-red-500">*</span>
            </label>
            <input
              id="jur-num-appel"
              type="text"
              value={numeroDossierAppel}
              onChange={(e) => setNumeroDossierAppel(e.target.value)}
              placeholder={cur.recherche_exemple}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
              required
            />
          </div>

          {docLie === "Oui" ? (
            <div>
              <label htmlFor="jur-objet-linked" className="block text-xs font-bold text-slate-700 mb-2">
                {cur.objetLabel} <span className="text-red-500">*</span>
              </label>
              <input
                id="jur-objet-linked"
                type="text"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                required
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="jur-type" className="block text-xs font-bold text-slate-700 mb-2">
                  {cur.typeDossier}
                </label>
                <select
                  id="jur-type"
                  value={typeDossier}
                  onChange={(e) => setTypeDossier(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">{langue === "fr" ? "Choisir" : "اختر"}</option>
                  {getTypeDossierOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="jur-num-premiere" className="block text-xs font-bold text-slate-700 mb-2">
                  {cur.numeroPremiereInstance}
                </label>
                <input
                  id="jur-num-premiere"
                  type="text"
                  value={numeroPremiereInstance}
                  onChange={(e) => setNumeroPremiereInstance(e.target.value)}
                  placeholder="2026/12"
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </>
          )}
        </div>

        {/* Document PDF / Word (pleine largeur) */}
        <div>
          <label htmlFor="jur-fichier" className="block text-xs font-bold text-slate-700 mb-2">{cur.documentPdfWord}</label>
          <div className="flex items-center gap-3">
            <div
              className="flex-1 min-w-0 border border-slate-200 bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-500 truncate"
              title={juridiqueFichier?.name}
            >
              {juridiqueFichier ? juridiqueFichier.name : cur.aucunFichier}
            </div>
            <label className="cursor-pointer whitespace-nowrap border border-slate-300 rounded-lg px-6 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition">
              {cur.choisirFichier}
              <input
                id="jur-fichier"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Notes (pleine largeur) */}
        <div>
          <label htmlFor="jur-notes" className="block text-xs font-bold text-slate-700 mb-2">{cur.notes}</label>
          <textarea
            id="jur-notes"
            rows={3}
            value={juridiqueNotes}
            onChange={(e) => setJuridiqueNotes(e.target.value)}
            placeholder={cur.commentaire}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {/* ===== DESTINATION DU DOSSIER ===== */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800">{cur.serviceDest}</h3>
          <p className="text-[10px] text-slate-400 mt-1">
            {langue === "fr"
              ? "Le dossier reste dans votre service jusqu'à ce que le service destinataire accepte la réception."
              : "يبقى الملف في مصلحتك إلى أن تقبل المصلحة المستقبِلة الاستلام."}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Choix du service destinataire */}
          <div>
            <label htmlFor="jur-service-destination" className="block text-xs font-bold text-slate-700 mb-2">
              {cur.serviceDest} <span className="text-red-500">*</span>
            </label>
            <select
              id="jur-service-destination"
              data-testid="jur-service-destination"
              value={serviceDestination}
              onChange={(e) => setServiceDestination(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
              required
            >
              <option value="">{cur.choisirService}</option>
              {groups.map((group) => (
                <optgroup key={group.key} label={group.label}>
                  {group.children.map((svc) => (
                    <option key={svc.value} value={svc.value}>{svc.label}</option>
                  ))}
                </optgroup>
              ))}
              {historicalOptions.length > 0 && (
                <optgroup label={cur.servicesHistoriques}>
                  {historicalOptions.map((svc) => (
                    <option key={svc.value} value={svc.value}>{svc.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              {langue === "fr"
                ? "Liste lue en direct : les services créés ou archivés apparaissent ici sans redémarrage."
                : "تُقرأ القائمة مباشرة: تظهر المصالح المحدثة أو المؤرشفة هنا دون إعادة التشغيل."}
            </p>
          </div>

          {/* Utilisateurs du service choisi — apparaît une fois le service choisi */}
          {serviceDestination && (
            <div data-testid="jur-recipients-group">
              {destinationIsHistorical ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                  {langue === "fr"
                    ? "Service historique : le dossier ne bouge pas, l'étape est seulement enregistrée dans son parcours."
                    : "مصلحة تاريخية: لا يتحرك الملف، وتُسجَّل المرحلة في مساره فقط."}
                </div>
              ) : (
                <>
                  <span className="block text-xs font-bold text-slate-700 mb-2">
                    {langue === "fr" ? `Utilisateurs — ${chosenServiceLabel}` : `المستخدمون — ${chosenServiceLabel}`}
                  </span>

                  {loadingUsers ? (
                    <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      {langue === "fr" ? "Chargement des utilisateurs..." : "جاري تحميل المستخدمين..."}
                    </p>
                  ) : serviceUsers.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      {langue === "fr" ? "Aucun utilisateur actif dans ce service" : "لا يوجد مستخدمون نشطون في هذه المصلحة"}
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                      <label
                        htmlFor="jur-recipient-service-wide"
                        className="flex items-center gap-2 p-2.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          id="jur-recipient-service-wide"
                          type="radio"
                          name="jur-recipient-mode"
                          checked={recipientUserIds.length === 0}
                          onChange={() => setRecipientUserIds([])}
                          className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="text-[11px] font-bold text-slate-600">
                          {langue === "fr" ? "Tout le service" : "جميع المصلحة"}
                        </span>
                      </label>
                      {serviceUsers.map((u) => (
                        <label
                          key={u.id}
                          htmlFor={`jur-recipient-${u.id}`}
                          className={`flex items-center gap-2 p-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition ${
                            recipientUserIds.includes(u.id) ? "bg-blue-50" : ""
                          }`}
                        >
                          <input
                            id={`jur-recipient-${u.id}`}
                            data-testid="jur-recipient-user"
                            type="radio"
                            name="jur-recipient-mode"
                            checked={recipientUserIds.includes(u.id)}
                            onChange={() => setRecipientUserIds([u.id])}
                            className="w-3.5 h-3.5 text-blue-600"
                          />
                          <span className="text-xs font-bold text-slate-700">{u.nom}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 mt-1">
                    {recipientUserIds.length === 0
                      ? (langue === "fr"
                          ? "Aucun utilisateur choisi : le dossier est envoyé au service entier."
                          : "لم يتم اختيار أي مستخدم: يُرسل الملف إلى المصلحة بأكملها.")
                      : (langue === "fr"
                          ? "Le dossier est envoyé uniquement à l'utilisateur choisi."
                          : "يُرسل الملف إلى المستخدم المحدد فقط.")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {!serviceDestination && (
          <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg border border-slate-200">
            {langue === "fr"
              ? "Choisissez le service destinataire pour envoyer le dossier."
              : "اختر المصلحة المستقبِلة لإرسال الملف."}
          </p>
        )}
      </div>
    </div>
  );
}
