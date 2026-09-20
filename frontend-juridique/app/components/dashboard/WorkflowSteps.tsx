"use client";

import type { TranslationKeys } from "@/lib/translations";
import { CourrierSimule } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { useServiceLabels } from "@/app/hooks/useServiceLabels";
import type { WorkflowStep } from "@/lib/constants";
import { isDocInService } from "@/lib/utils";

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

// A fixed colour table cannot work any more: the pipeline is built from the live
// catalog, so a service created tomorrow would have no entry in it. The colour is
// derived from the code instead, which makes it stable and self-assigning.
const STEP_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#6b7280",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];

function resolveServiceColor(key?: string): string {
  const normalized = (key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return "#64748b";

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % 100000;
  }
  return STEP_COLORS[hash % STEP_COLORS.length];
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
  const { token } = useAuth();
  const { getServiceLabel } = useServiceLabels(token, langue);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{cur.fluxDossier}</h3>
          {selectedDoc ? (
            <p className="text-[11px] text-slate-500 font-semibold">
              {cur.emplacementActuel}: {getServiceLabel(selectedDoc.serviceActuelCode || selectedDoc.serviceActuel)}
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
      {steps.length === 0 ? (
        <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
          {langue === "fr"
            ? "Aucun service dans le catalogue : le circuit s'affichera dès qu'un service sera enregistré."
            : "لا توجد مصالح في الدليل: سيظهر المسار بمجرد تسجيل مصلحة."}
        </p>
      ) : (
      <div data-testid="workflow-steps" className="grid grid-cols-1 md:grid-cols-6 gap-2">
        {steps.map((step, index) => {
          const isReached = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const count = docsPerStep[index] || 0;
          const docsAtStep = allDocs.filter((d) => isDocInService(d, step.code));
          return (
            <button
              key={step.code}
              type="button"
              data-testid="workflow-step"
              onClick={() => onStepClick(step.label, index)}
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
              <p data-testid="workflow-step-label" className="text-[11px] font-bold mt-2">{step.label}</p>
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
      )}
    </div>
  );
}
