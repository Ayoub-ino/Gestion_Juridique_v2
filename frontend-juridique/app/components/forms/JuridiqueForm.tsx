// app/components/forms/JuridiqueForm.tsx

"use client";

import type { TranslationKeys } from "@/lib/translations";

import { useRef } from "react";
import { SERVICE_GROUPS } from "@/lib/constants";
import { Langue } from "@/app/types";

interface JuridiqueFormProps {
  // Nouveaux champs
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
  numeroBureauOrdre: string;
  setNumeroBureauOrdre: (v: string) => void;
  autoYearSuffix: string;
  setAutoYearSuffix: (v: string) => void;
  juridiqueEtat: string;
  setJuridiqueEtat: (v: string) => void;
  juridiqueService: string;
  setJuridiqueService: (v: string) => void;
  typeDossier: string;
  setTypeDossier: (v: string) => void;
  numeroPremiereInstance: string;
  setNumeroPremiereInstance: (v: string) => void;
  juridiqueNotes: string;
  setJuridiqueNotes: (v: string) => void;
  juridiqueFichier: File | null;
  setJuridiqueFichier: (f: File | null) => void;

  // Champs existants
  circuitJuridique: string;
  setCircuitJuridique: (v: string) => void;
  etapeService: number;
  setEtapeService: (v: number) => void;
  etapeJalsat: string;
  setEtapeJalsat: (v: string) => void;
  etapeTaslim: string;
  setEtapeTaslim: (v: string) => void;
  autoriteRetrait: string;
  setAutoriteRetrait: (v: string) => void;
  typeException: string;
  setTypeException: (v: string) => void;
  numeroDossierAppel: string;
  setNumeroDossierAppel: (v: string) => void;
  typeProcedure: string;
  setTypeProcedure: (v: string) => void;
  numCourAppel: string;
  setNumCourAppel: (v: string) => void;
  conseillerRapporteur: string;
  setConseillerRapporteur: (v: string) => void;
  dateAudience: string;
  setDateAudience: (v: string) => void;
  statutSousService: string;
  setStatutSousService: (v: string) => void;
  commentaireSousService: string;
  setCommentaireSousService: (v: string) => void;

  // Références communes
  reference: string;
  tiers: string;
  objet: string;
  isJalsatService: boolean;
  isTaslimService: boolean;
  langue: Langue;
  cur: TranslationKeys;
  userRole?: string;
}

export function JuridiqueForm({
  // Nouveaux champs
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
  numeroBureauOrdre,
  setNumeroBureauOrdre,
  autoYearSuffix,
  setAutoYearSuffix,
  juridiqueEtat,
  setJuridiqueEtat,
  juridiqueService,
  setJuridiqueService,
  typeDossier,
  setTypeDossier,
  numeroPremiereInstance,
  setNumeroPremiereInstance,
  juridiqueNotes,
  setJuridiqueNotes,
  juridiqueFichier,
  setJuridiqueFichier,
  // Champs existants
  circuitJuridique,
  setCircuitJuridique,
  etapeService,
  setEtapeService,
  etapeJalsat,
  setEtapeJalsat,
  etapeTaslim,
  setEtapeTaslim,
  autoriteRetrait,
  setAutoriteRetrait,
  typeException,
  setTypeException,
  numeroDossierAppel,
  setNumeroDossierAppel,
  typeProcedure,
  setTypeProcedure,
  numCourAppel,
  setNumCourAppel,
  conseillerRapporteur,
  setConseillerRapporteur,
  dateAudience,
  setDateAudience,
  statutSousService,
  setStatutSousService,
  commentaireSousService,
  setCommentaireSousService,
  reference,
  tiers,
  objet,
  isJalsatService,
  isTaslimService,
  langue,
  cur,
  userRole
}: JuridiqueFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fonction pour sélectionner un dossier parent
  const handleSelectParentFolder = async () => {
    try {
      const browserWindow = window as typeof window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };
      if (!browserWindow.showDirectoryPicker) {
        alert(langue === "fr"
          ? "Votre navigateur ne supporte pas la sélection de dossier."
          : "المتصفح لا يدعم اختيار المجلد.");
        return;
      }
      const handle = await browserWindow.showDirectoryPicker();
      setParentDossier(handle.name || (langue === "fr" ? "Dossier sélectionné" : "مجلد مختار"));
    } catch {
      console.warn("Sélection annulée");
    }
  };

  // Options traduites
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

  // Workflow dynamique (5 cercles) - filtré par rôle
  const allWorkflowSteps = [
    { id: 1, label: cur.maktabDabt },
    { id: 2, label: cur.ouvertureDossier },
    { id: 3, label: cur.kitabaKhasa },
    { id: 4, label: cur.jalsatSection },
    { id: 5, label: cur.taslimSection }
  ];

  const workflowStepsJuridique = allWorkflowSteps.filter((step) => {
    if (!userRole) return true;
    const r = userRole.toLowerCase();
    if (r === "admin" || r === "greffier" || r === "directeur" || r === "consultant") return true;
    switch (r) {
      case "bureauordre": return step.id === 1;
      case "ouverturedossier": return step.id === 2;
      case "kitabakhasa": return step.id === 3;
      case "jalsat": return step.id === 4;
      case "taslim": return step.id === 5;
      case "notification": return step.id === 5;
      case "archive": return step.id === 5;
      case "expertise": return step.id === 4;
      case "procedures": return step.id === 4;
      case "pourvois": return step.id === 4;
      case "remisecopie": return step.id === 5;
      case "recouvrement": return step.id === 1;
      case "caisse": return step.id === 1;
      case "finances": return step.id === 1;
      case "stats": return step.id === 1;
      case "informatique": return step.id === 1;
      case "enregistrement": return step.id === 2;
      default: return true;
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setJuridiqueFichier(e.target.files[0]);
    }
  };

  // Vérifie si l'utilisateur peut accéder à une étape donnée
  const canAccessStep = (stepId: number): boolean => {
    if (!userRole) return true;
    const r = userRole.toLowerCase();
    if (r === "admin" || r === "greffier" || r === "directeur" || r === "consultant") return true;
    switch (r) {
      case "bureauordre": return stepId === 1;
      case "ouverturedossier": return stepId === 2;
      case "enregistrement": return stepId === 2;
      case "kitabakhasa": return stepId === 3;
      case "jalsat": return stepId === 4;
      case "expertise": return stepId === 4;
      case "procedures": return stepId === 4;
      case "pourvois": return stepId === 4;
      case "taslim": return stepId === 5;
      case "notification": return stepId === 5;
      case "archive": return stepId === 5;
      case "remisecopie": return stepId === 5;
      case "recouvrement": return stepId === 1;
      case "caisse": return stepId === 1;
      case "finances": return stepId === 1;
      case "stats": return stepId === 1;
      case "informatique": return stepId === 1;
      default: return true;
    }
  };

  return (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
      {/* ===== NOUVEAUX CHAMPS ===== */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-slate-800">{cur.juridique}</h3>

        {/* Document lié & Dossier principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {cur.docsReference}
            </label>
            <select
              value={docLie}
              onChange={(e) => setDocLie(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            >
              <option value="">{langue === "fr" ? "Choisir" : "اختر"}</option>
              <option value="Oui">{cur.oui}</option>
              <option value="Non">{cur.non}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {cur.dossierPrincipal}
            </label>
            <select
              value={dossierPrincipal}
              onChange={(e) => setDossierPrincipal(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            >
              <option value="">{langue === "fr" ? "Choisir" : "اختر"}</option>
              <option value="Oui">{cur.oui}</option>
              <option value="Non">{cur.non}</option>
            </select>
          </div>
        </div>

        {/* Source du document lié & Dossier parent (avec bouton parcourir) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {cur.source_service} <span className="text-red-500">*</span>
            </label>
            <select
              value={sourceDocLie}
              onChange={(e) => setSourceDocLie(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
              required
            >
              <option value="">{langue === "fr" ? "Choisir" : "اختر"}</option>
              {getSourceOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {cur.parentDossier}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={parentDossier}
                readOnly
                placeholder={cur.aucune_doc_reference}
                className="flex-1 border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={handleSelectParentFolder}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition whitespace-nowrap"
              >
                {cur.parcourir}
              </button>
            </div>
          </div>
        </div>

        {/* Date & N° Bureau d'ordre */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">{cur.dateArrivee} <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={juridiqueDate}
              onChange={(e) => setJuridiqueDate(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">{cur.numeroBureauOrdre}</label>
            <input
              type="text"
              value={numeroBureauOrdre}
              onChange={(e) => setNumeroBureauOrdre(e.target.value)}
              placeholder="15"
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Année & État */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">{cur.anneeNumerotation}</label>
            <input
              type="text"
              value={autoYearSuffix}
              onChange={(e) => setAutoYearSuffix(e.target.value)}
              placeholder="/ 2026"
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">{cur.etat}</label>
            <select
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
        </div>

        {/* Service & Type de dossier */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">{cur.service} <span className="text-red-500">*</span></label>
            <select
              value={juridiqueService}
              onChange={(e) => setJuridiqueService(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
              required
            >
              <option value="">{cur.choisirService}</option>
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
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {cur.tblType}
            </label>
            <select
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
        </div>

        {/* N° première instance & Fichier */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {cur.numeroPremiereInstance}
            </label>
            <input
              type="text"
              value={numeroPremiereInstance}
              onChange={(e) => setNumeroPremiereInstance(e.target.value)}
              placeholder="2026/12"
              className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">{cur.fichier}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="w-full border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-blue-500 bg-white file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {juridiqueFichier && <p className="text-[10px] text-slate-500 mt-1">{juridiqueFichier.name}</p>}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">{cur.notes}</label>
          <textarea
            rows={2}
            value={juridiqueNotes}
            onChange={(e) => setJuridiqueNotes(e.target.value)}
            placeholder={cur.commentaire}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {/* ===== WORKFLOW DYNAMIQUE (5 CERCLES) ===== */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-4 text-center">
          {cur.fluxDossier}
        </h3>
        <div className="flex items-center justify-between relative before:absolute before:bg-slate-200 before:h-1 before:w-full before:top-1/2 before:-translate-y-1/2 before:z-0 mb-6 px-4">
          {workflowStepsJuridique.map((step) => {
            const isReached = etapeService >= step.id;
            const isCurrent = etapeService === step.id;
            return (
              <div
                key={step.id}
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  isReached ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                    isReached
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  {step.id}
                </div>
                <span className="text-[10px] font-bold bg-white px-2 rounded-full shadow-sm border border-slate-100 text-center leading-tight max-w-[80px]">
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                    {cur.serviceActuel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-center text-xs text-slate-500 mt-2">
          {`${cur.etapeActuelle} : ${workflowStepsJuridique.find(s => s.id === etapeService)?.label || cur.nonCommence}`}
        </div>
      </div>

      {/* ===== CIRCUIT DE TRAITEMENT (inchangé) ===== */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
        {/* Circuit de traitement */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-2">{cur.circuitTraitement}</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { value: "maktab_dabt", label: cur.maktabDabt },
              { value: "kitaba_khasa", label: cur.kitabaKhasa }
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-2 rounded-lg border p-3 text-xs font-bold cursor-pointer ${
                  circuitJuridique === option.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="circuitJuridique"
                  checked={circuitJuridique === option.value}
                  onChange={() => {
                    setCircuitJuridique(option.value);
                    setEtapeService(1);
                    setEtapeJalsat("");
                    setEtapeTaslim("");
                    setAutoriteRetrait("");
                    setTypeException("");
                    setNumeroDossierAppel("");
                    setTypeProcedure("ordinaire");
                    setNumCourAppel("");
                    setConseillerRapporteur("");
                    setDateAudience("");
                    setStatutSousService("");
                    setCommentaireSousService("");
                  }}
                  required
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        {/* Circuit Maktab Dabt */}
        {circuitJuridique === "maktab_dabt" && (
          <div className="space-y-6 p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
            {/* Indicateur d'étapes (petit) */}
            <div className="flex items-center justify-between relative before:absolute before:bg-slate-200 before:h-1 before:w-full before:top-1/2 before:-translate-y-1/2 before:z-0 mb-8 px-4">
              {[
                { id: 1, label: cur.maktabDabt },
                { id: 2, label: cur.ouvertureDossier },
                { id: 3, label: cur.kitabaKhasa },
                { id: 4, label: cur.jalsatSection },
                { id: 5, label: cur.taslimSection }
              ].map(step => (
                <div
                  key={step.id}
                  className={`relative z-10 flex flex-col items-center gap-2 ${
                    etapeService >= step.id ? 'text-blue-600' : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-colors ${
                      etapeService >= step.id
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {step.id}
                  </div>
                  <span className="text-[10px] font-bold bg-white px-2 rounded-full shadow-sm border border-slate-100">
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Résumé du dossier */}
            {circuitJuridique && etapeService > 1 && (
              <div className="bg-slate-100 p-4 rounded-lg border border-slate-300 text-xs">
                <h4 className="font-bold text-slate-700 mb-2">{cur.resumeDossier}</h4>
                <div className="grid grid-cols-2 gap-1">
                  <div><span className="font-semibold">{cur.tblRef} :</span> {reference}</div>
                  <div><span className="font-semibold">{cur.provenance} :</span> {tiers}</div>
                  <div className="col-span-2"><span className="font-semibold">{cur.tblTitre} :</span> {objet}</div>
                  <div><span className="font-semibold">{cur.etapeActuelle} :</span> {
                    etapeService === 1 && cur.maktabDabt}
                    {etapeService === 2 && cur.ouvertureDossier}
                    {etapeService === 3 && cur.kitabaKhasa}
                    {etapeService === 4 && cur.jalsatSection}
                    {etapeService === 5 && cur.taslimSection}
                  </div>
                  {numeroDossierAppel && <div><span className="font-semibold">{cur.numDossierAppel} :</span> {numeroDossierAppel}</div>}
                  {numCourAppel && <div><span className="font-semibold">{cur.numCourAppel} :</span> {numCourAppel}</div>}
                </div>
              </div>
            )}

            {/* Contenu des étapes */}
            <div className="p-5 border border-blue-100 bg-blue-50/40 rounded-xl">
              {/* Étape 1 : Bureau d'Ordre */}
              {etapeService === 1 && canAccessStep(1) && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 text-sm text-center">{cur.maktabDabt}</h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{cur.numDossierAppel}</label>
                    <input
                      type="text"
                      value={numeroDossierAppel}
                      onChange={(e) => setNumeroDossierAppel(e.target.value)}
                      placeholder={cur.recherche_exemple}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{cur.typeProcedure}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { value: "ordinaire", label: cur.ordinaire },
                        { value: "urgent", label: cur.urgent },
                        { value: "tres_urgent", label: cur.tresUrgent }
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold cursor-pointer ${
                            typeProcedure === option.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          <input
                            type="radio"
                            name="typeProcedure"
                            checked={typeProcedure === option.value}
                            onChange={() => setTypeProcedure(option.value)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!numeroDossierAppel) {
                        alert(langue === "fr" ? "Veuillez attribuer un numéro de dossier" : "يرجى تحديد رقم الملف");
                        return;
                      }
                      setEtapeService(2);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg text-xs transition"
                  >
                    {cur.validerEtTransmettre}
                  </button>
                </div>
              )}

              {/* Étape 2 : Ouverture des dossiers */}
              {etapeService === 2 && canAccessStep(2) && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 text-sm text-center">{cur.ouvertureDossier}</h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{cur.numCourAppel}</label>
                    <input
                      type="text"
                      value={numCourAppel}
                      onChange={(e) => setNumCourAppel(e.target.value)}
                      placeholder={cur.recherche_exemple}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{cur.conseillerRapporteur}</label>
                    <input
                      type="text"
                      value={conseillerRapporteur}
                      onChange={(e) => setConseillerRapporteur(e.target.value)}
                      placeholder={cur.nomConseiller}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{cur.dateAudience}</label>
                    <input
                      type="date"
                      value={dateAudience}
                      onChange={(e) => setDateAudience(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEtapeService(1)}
                      className="w-1/2 bg-white border border-slate-300 text-slate-700 font-bold p-3 rounded-lg text-xs hover:bg-slate-50 transition"
                    >
                      {cur.btnRetour}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!numCourAppel) {
                          alert(langue === "fr" ? "Veuillez attribuer le numéro de Cour d'Appel" : "يرجى تحديد رقم محكمة الاستئناف");
                          return;
                        }
                        setEtapeService(3);
                      }}
                      className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg text-xs transition"
                    >
                      {cur.btnSuivant}
                    </button>
                  </div>
                </div>
              )}

              {/* Étape 3 : Secrétariat particulier */}
              {etapeService === 3 && canAccessStep(3) && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 text-sm text-center">{cur.kitabaKhasa}</h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{cur.titreKitabaKhasa}</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "islah_khata2", label: cur.islahKhata2 },
                        { value: "mous3ada", label: cur.mous3ada },
                        { value: "ikhtissas_ra2is", label: cur.ikhtissasRa2is }
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold cursor-pointer ${
                            typeException === option.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          <input
                            type="radio"
                            name="typeExceptionStep"
                            checked={typeException === option.value}
                            onChange={() => setTypeException(option.value)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEtapeService(2)}
                      className="w-1/2 bg-white border border-slate-300 text-slate-700 font-bold p-3 rounded-lg text-xs hover:bg-slate-50 transition"
                    >
                      {cur.btnRetour}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!typeException) {
                          alert(langue === "fr" ? "Veuillez choisir le type d'exception" : "يرجى اختيار نوع الإجراء");
                          return;
                        }
                        setEtapeService(4);
                      }}
                      className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg text-xs transition"
                    >
                      {cur.btnSuivant}
                    </button>
                  </div>
                </div>
              )}

              {/* Étape 4 : Jalsat */}
              {etapeService === 4 && canAccessStep(4) && (
                <div className="space-y-6 text-start">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 text-sm">{cur.jalsatSection}</h3>
                    <button
                      type="button"
                      onClick={() => setEtapeService(3)}
                      className="text-[10px] text-blue-600 underline font-bold"
                    >
                      {cur.btnRetour}
                    </button>
                  </div>

                  {etapeJalsat !== "" && (
                    <div className="space-y-3 p-3 bg-blue-50/60 border border-blue-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-blue-800">
                          {etapeJalsat === "ijra2_baht" && cur.ijra2Baht}
                          {etapeJalsat === "moufawad" && cur.moufawad}
                          {etapeJalsat === "khibra" && cur.khibra}
                          {etapeJalsat === "moqarir" && cur.moqarir}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-1 rounded font-bold ${
                            statutSousService === "en_attente"
                              ? "bg-amber-100 text-amber-700"
                              : statutSousService === "en_cours"
                              ? "bg-blue-100 text-blue-700"
                              : statutSousService === "effectue"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {statutSousService === "en_attente" && cur.enAttente}
                          {statutSousService === "en_cours" && cur.enCours}
                          {statutSousService === "effectue" && cur.effectue}
                          {!statutSousService && cur.nonCommence}
                        </span>
                      </div>

                      {isJalsatService && (
                        <>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setStatutSousService("en_attente")}
                              className="px-3 py-1 text-[10px] font-bold rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
                            >
                              {cur.enAttente}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatutSousService("en_cours")}
                              className="px-3 py-1 text-[10px] font-bold rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                            >
                              {cur.enCours}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatutSousService("effectue")}
                              className="px-3 py-1 text-[10px] font-bold rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
                            >
                              {cur.effectue}
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={commentaireSousService}
                            onChange={(e) => setCommentaireSousService(e.target.value)}
                            placeholder={cur.commentaire}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setEtapeJalsat("")}
                            className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold p-2 rounded-lg text-xs transition"
                          >
                            {cur.retourJalsat}
                          </button>
                        </>
                      )}

                      {!isJalsatService && (
                        <div className="text-xs text-red-500 text-center">{cur.serviceNonAutorise}</div>
                      )}
                    </div>
                  )}

                  {etapeJalsat === "" && (
                    <div className="grid grid-cols-2 gap-3">
                      {isJalsatService ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEtapeJalsat("ijra2_baht")}
                            className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold text-blue-700 transition"
                          >
                            {cur.ijra2Baht}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEtapeJalsat("moufawad")}
                            className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold text-blue-700 transition"
                          >
                            {cur.moufawad}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEtapeJalsat("khibra")}
                            className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold text-blue-700 transition"
                          >
                            {cur.khibra}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEtapeJalsat("moqarir")}
                            className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold text-blue-700 transition"
                          >
                            {cur.moqarir}
                          </button>
                        </>
                      ) : (
                        <div className="col-span-2 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
                          {cur.serviceNonAutorise}
                        </div>
                      )}
                    </div>
                  )}

                  {etapeJalsat !== "" && statutSousService === "effectue" && isJalsatService && (
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-300">
                      <p className="text-xs text-slate-500 mb-2 text-center">
                        {langue === "fr"
                          ? "Après achèvement des procédures, transmettre à la Délivrance des copies"
                          : "بعد الانتهاء من الإجراءات، إحالة إلى مصلحة تسليم النسخ"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEtapeService(5)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-lg text-xs transition"
                      >
                        {cur.versTaslim}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 5 : Taslim */}
              {etapeService === 5 && canAccessStep(5) && (
                <div className="space-y-6 text-start">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 text-sm">{cur.taslimSection}</h3>
                    <button
                      type="button"
                      onClick={() => setEtapeService(4)}
                      className="text-[10px] text-blue-600 underline font-bold"
                    >
                      {cur.btnRetour}
                    </button>
                  </div>

                  {etapeTaslim !== "" && (
                    <div className="space-y-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-emerald-800">
                          {etapeTaslim === "tabligh" && cur.tabligh}
                          {etapeTaslim === "tasfiya" && cur.tasfiya}
                          {etapeTaslim === "archive" && cur.archiveDef}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-1 rounded font-bold ${
                            statutSousService === "en_attente"
                              ? "bg-amber-100 text-amber-700"
                              : statutSousService === "en_cours"
                              ? "bg-blue-100 text-blue-700"
                              : statutSousService === "effectue"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {statutSousService === "en_attente" && cur.enAttente}
                          {statutSousService === "en_cours" && cur.enCours}
                          {statutSousService === "effectue" && cur.effectue}
                          {!statutSousService && cur.nonCommence}
                        </span>
                      </div>

                      {isTaslimService && etapeTaslim !== "archive" && (
                        <>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setStatutSousService("en_attente")}
                              className="px-3 py-1 text-[10px] font-bold rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
                            >
                              {cur.enAttente}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatutSousService("en_cours")}
                              className="px-3 py-1 text-[10px] font-bold rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                            >
                              {cur.enCours}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatutSousService("effectue")}
                              className="px-3 py-1 text-[10px] font-bold rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
                            >
                              {cur.effectue}
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={commentaireSousService}
                            onChange={(e) => setCommentaireSousService(e.target.value)}
                            placeholder={cur.commentaire}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setEtapeTaslim("")}
                            className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold p-2 rounded-lg text-xs transition"
                          >
                            {cur.retourTaslim}
                          </button>
                        </>
                      )}

                      {etapeTaslim === "archive" && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                          <p className="text-xs font-bold text-slate-700 text-center">{cur.retraitSection}</p>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { value: "ra2is_kitaba", label: cur.ra2isKitaba },
                              { value: "mustachar_moqarir", label: cur.mustacharMoqarir },
                              { value: "ra2is_awal", label: cur.ra2isAwal }
                            ].map((option) => (
                              <label
                                key={option.value}
                                className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold cursor-pointer ${
                                  autoriteRetrait === option.value
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-700 border-slate-200"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="autoriteRetrait"
                                  checked={autoriteRetrait === option.value}
                                  onChange={() => setAutoriteRetrait(option.value)}
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                          {autoriteRetrait !== "" && (
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 text-center">
                              ✅ {cur.retraitEffectue}{" "}
                              {autoriteRetrait === "ra2is_kitaba" && cur.ra2isKitaba}
                              {autoriteRetrait === "mustachar_moqarir" && cur.mustacharMoqarir}
                              {autoriteRetrait === "ra2is_awal" && cur.ra2isAwal}
                            </div>
                          )}
                        </div>
                      )}

                      {!isTaslimService && (
                        <div className="text-xs text-red-500 text-center">{cur.serviceNonAutorise}</div>
                      )}
                    </div>
                  )}

                  {etapeTaslim === "" && (
                    <div className="grid grid-cols-3 gap-3">
                      {isTaslimService ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEtapeTaslim("tabligh")}
                            className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700 transition"
                          >
                            {cur.tabligh}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEtapeTaslim("tasfiya")}
                            className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700 transition"
                          >
                            {cur.tasfiya}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEtapeTaslim("archive")}
                            className="p-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold text-red-700 transition"
                          >
                            {cur.archiveDef}
                          </button>
                        </>
                      ) : (
                        <div className="col-span-3 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
                          {cur.serviceNonAutorise}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Circuit Kitaba Khasa (direct) */}
        {circuitJuridique === "kitaba_khasa" && (
          <div className="space-y-4 p-5 bg-amber-50/60 border border-amber-200 rounded-lg">
            <h3 className="font-bold text-slate-800 text-sm text-center mb-4">{cur.kitabaKhasa}</h3>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-amber-900">{cur.titreKitabaKhasa}</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: "islah_khata2", label: cur.islahKhata2 },
                  { value: "mous3ada", label: cur.mous3ada },
                  { value: "ikhtissas_ra2is", label: cur.ikhtissasRa2is }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-xs font-bold cursor-pointer ${
                      typeException === option.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-amber-900 border-amber-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="typeExceptionDirect"
                      checked={typeException === option.value}
                      onChange={() => setTypeException(option.value)}
                      required
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            {typeException !== "" && (
              <div className="p-3 bg-white border border-amber-300 rounded-lg text-[11px] text-amber-900 font-bold text-center shadow-sm">
                {langue === "fr"
                  ? "Transmission immédiate vers le Secrétariat particulier"
                  : "إجراء إحالة فورية ومباشرة نحو مصلحة الكتابة الخاصة"}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (!typeException) {
                  alert(langue === "fr" ? "Veuillez choisir le type d'exception" : "يرجى اختيار نوع الإجراء");
                  return;
                }
                alert(langue === "fr" ? "Dossier enregistré en Kitaba Khasa" : "تم تسجيل الملف في الكتابة الخاصة");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg text-xs transition"
            >
              {cur.btnEnregistrer}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}