"use client";

import type { TranslationKeys } from "@/lib/translations";
import { CourrierSimule } from "@/app/types";
import { getServiceLabel } from "@/lib/constants";

interface WorkflowStep {
  labelFr: string;
  labelAr: string;
  service: string;
}

interface WorkflowStepsProps {
  steps: WorkflowStep[];
  currentIndex: number;
  selectedDoc: CourrierSimule | null;
  allDocs?: CourrierSimule[];
  onStepClick: (stepLabel: string, index: number) => void;
  onSelectDoc?: (doc: CourrierSimule) => void;
  cur: TranslationKeys;
  langue: "fr" | "ar";
  docsPerStep?: number[];
}

const SERVICE_COLORS: Record<string, string> = {
  BureauOrdre: "#3b82f6",
  OuvertureDossier: "#8b5cf6",
  KitabaKhasa: "#06b6d4",
  JalsatWaIjra2at: "#f59e0b",
  TaslimNusakh: "#10b981",
  Archive: "#6b7280",
};

function resolveServiceColor(key?: string): string {
  if (key && SERVICE_COLORS[key]) return SERVICE_COLORS[key];
  const map: Record<string, string> = {
    Ijra2Baht: "#f59e0b",
    MofawidMalaki: "#f59e0b",
    Khibra: "#f59e0b",
    MustacharMoqarir: "#f59e0b",
    Tabligh: "#10b981",
    TasfiyatSawa2ir: "#10b981",
    BureauNotification: "#ec4899",
    BureauExpertise: "#14b8a6",
    CelluleInformatique: "#8b5cf6",
    GestionFinanciere: "#f97316",
    CaisseTribunal: "#eab308",
    BureauRecouvrement: "#ef4444",
    ProcduresCommissaireRoyal: "#6366f1",
    GestionPourvoisCassation: "#a855f7",
    RemiseCopieJugement: "#06b6d4",
    EfficaciteJudiciaire: "#10b981",
    Greffe: "#3b82f6",
    Direction: "#1e293b",
  };
  return map[key || ""] || "#64748b";
}

export function WorkflowSteps({
  steps,
  currentIndex,
  selectedDoc,
  allDocs = [],
  onStepClick,
  onSelectDoc,
  cur,
  langue,
  docsPerStep = [],
}: WorkflowStepsProps) {
  const getLabel = (step: WorkflowStep) => (langue === "fr" ? step.labelFr : step.labelAr);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{cur.fluxDossier}</h3>
          {selectedDoc ? (
            <p className="text-[11px] text-slate-500 font-semibold">
              {cur.emplacementActuel}: {getServiceLabel(selectedDoc.serviceActuel, langue)}
              <span className="mx-1.5 text-slate-300">|</span>
              {cur.tblRef}: <span className="text-blue-600">{selectedDoc.reference}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-400">
              {cur.dossierSelectionne}
            </p>
          )}
        </div>
        {allDocs.length > 0 && (
          <span className="text-[10px] font-bold text-slate-400">
            {allDocs.length} {cur.documents}
          </span>
        )}
      </div>

      {/* Document pills - embedded in the diagram */}
      {allDocs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-slate-100 scrollbar-thin">
          {allDocs.map((doc) => {
            const color = resolveServiceColor(doc.serviceActuelKey);
            const isSelected = selectedDoc?.id === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectDoc?.(doc)}
                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition ${
                  isSelected
                    ? "bg-blue-600 border-blue-600 text-white shadow"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isSelected ? "#fff" : color }}
                />
                <span className="max-w-24 truncate">{doc.reference}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Workflow steps */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        {steps.map((step, index) => {
          const isReached = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const count = docsPerStep[index] || 0;
          const docsAtStep = allDocs.filter((d) => d.serviceActuelKey === step.service);
          return (
            <button
              key={step.service}
              type="button"
              onClick={() => onStepClick(getLabel(step), index)}
              className={`relative rounded-lg border p-3 min-h-20 text-start transition ${
                isCurrent
                  ? "bg-blue-600 border-blue-600 text-white shadow-md"
                  : isReached
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`absolute -top-2 start-3 h-5 min-w-5 rounded-full px-1 text-[10px] font-bold flex items-center justify-center ${
                  isCurrent ? "bg-white text-blue-700" : isReached ? "bg-blue-200 text-blue-700" : "bg-slate-200 text-slate-600"
                }`}
              >
                {index + 1}
              </span>
              <p className="text-[11px] font-bold mt-2">{getLabel(step)}</p>
              {count > 0 && (
                <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  isCurrent ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {count} {cur.documents}
                </span>
              )}
              {isCurrent && selectedDoc && (
                <span className="mt-1 block text-[10px] font-bold opacity-80 truncate">
                  {selectedDoc.reference}
                </span>
              )}
              {docsAtStep.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {docsAtStep.slice(0, 3).map((d) => (
                    <span
                      key={d.id}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isCurrent ? "#fff" : resolveServiceColor(d.serviceActuelKey) }}
                      title={d.reference}
                    />
                  ))}
                  {docsAtStep.length > 3 && (
                    <span className={`text-[8px] font-bold ${isCurrent ? "text-white/70" : "text-slate-400"}`}>
                      +{docsAtStep.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
