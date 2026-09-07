"use client";

import type { TranslationKeys } from "@/lib/translations";
import { CourrierSimule, VueActive } from "@/app/types";              
import { SearchBar } from "@/app/components/common/SearchBar";       
import { WorkflowSteps } from "@/app/components/dashboard/WorkflowSteps"; 
import { StatsCircles, StatsData } from "@/app/components/dashboard/StatsCircles";
import { ActivityCards } from "@/app/components/dashboard/ActivityCards"; 
import { GeneralTable } from "@/app/components/tables/GeneralTable";      
import { SortantTable } from "@/app/components/tables/SortantTable";     
import { WORKFLOW_STEPS } from "@/lib/constants";
import { ExportFormat } from "@/lib/exportImport";

interface DashboardViewProps {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  workflowDoc: CourrierSimule | null;
  setWorkflowDocId: (id: number) => void;
  filteredGeneral: CourrierSimule[];
  filteredSortant: CourrierSimule[];
  allDocs?: CourrierSimule[];
  filtreStatutSortant: string;
  setFiltreStatutSortant: (s: string) => void;
  stats: StatsData;
  totalDocs: number;
  activityCards: { title: string; value: number; view: VueActive; accent: string }[];
  onViewDoc: (doc: CourrierSimule) => void;
  onTransferDoc: (doc: CourrierSimule) => void;
  onDeleteDoc: (doc: CourrierSimule) => void;
  canDelete?: boolean;
  canTransfer?: boolean;
  canModify?: boolean;
  onMarquerEnvoye: (id: number) => void;
  onMarquerAttente: (id: number) => void;
  onAnnuler: (id: number) => void;
  onOpenDoc?: (doc: CourrierSimule) => void;
  onNavigate: (view: VueActive) => void;
  cur: TranslationKeys;
  langue: "fr" | "ar";
  onExportGeneral?: (format: ExportFormat) => void;
  onImportExcel?: (file: File) => void;
  onExportSortant?: (format: ExportFormat) => void;
  docsPerStep?: number[];
  workflowIndex?: number;
  selectedDocIds?: number[];
  onToggleDocSelect?: (id: number) => void;
  onSelectAllDocs?: () => void;
  recentActivity?: { type: string; label: string; reference: string; time: string; doc?: CourrierSimule }[];
  serviceLoad?: { service: string; count: number; label: string }[];
}

export function DashboardView({
  searchTerm,
  setSearchTerm,
  workflowDoc,
  filteredGeneral,
  filteredSortant,
  allDocs = [],
  filtreStatutSortant,
  setFiltreStatutSortant,
  stats,
  totalDocs,
  activityCards,
  onViewDoc,
  onTransferDoc,
  onDeleteDoc,
  canDelete = true,
  canTransfer = true,
  canModify = true,
  onMarquerEnvoye,
  onMarquerAttente,
  onAnnuler,
  onOpenDoc,
  onNavigate,
  cur,
  langue,
  onExportGeneral,
  onImportExcel,
  onExportSortant,
  docsPerStep = [],
  workflowIndex = 0,
  selectedDocIds = [],
  onToggleDocSelect,
  onSelectAllDocs,
  recentActivity = [],
  serviceLoad = [],
}: DashboardViewProps) {
  return (
    <div className="space-y-6">
      {/* Activite recente */}
      {recentActivity.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
            {cur.activiteRecente}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentActivity.slice(0, 6).map((a, i) => (
              <button
                key={i}
                onClick={() => a.doc && onViewDoc(a.doc)}
                className="flex-shrink-0 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg p-3 min-w-[180px] text-left hover:border-blue-400 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    a.type === "transfer" ? "bg-blue-500" :
                    a.type === "create" ? "bg-emerald-500" :
                    a.type === "archive" ? "bg-purple-500" :
                    "bg-amber-500"
                  }`}></span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{a.label}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">{a.reference}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{a.time}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Charge par service */}
      {serviceLoad.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {cur.dossiersParService}
              </h3>
              <p className="text-[9px] text-slate-400 mt-0.5">
                {cur.volumeTravailParService}
              </p>
            </div>
            <div className="flex gap-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-500"></span>{cur.faible}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span>{cur.moyen}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>{cur.eleve}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {serviceLoad.map((s) => {
              const maxCount = Math.max(...serviceLoad.map((x) => x.count), 1);
              const pct = Math.round((s.count / maxCount) * 100);
              return (
                <div key={s.service} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{s.label}</p>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-blue-400 to-indigo-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 mt-1">{s.count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SearchBar
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={cur.recherche}
      />

      <WorkflowSteps
        steps={WORKFLOW_STEPS}
        currentIndex={workflowIndex}
        selectedDoc={workflowDoc}
        allDocs={allDocs}
        onStepClick={(stepLabel, index) => {
          alert(`${cur.stage1} ${index + 1}: ${stepLabel}`);
        }}
        onSelectDoc={onViewDoc}
        cur={cur}
        langue={langue}
        docsPerStep={docsPerStep}
      />

      <StatsCircles stats={stats} totalDocs={totalDocs} langue={langue} />

      <ActivityCards cards={activityCards} onCardClick={onNavigate} cur={cur} />

      <GeneralTable
        documents={filteredGeneral}
        onView={onViewDoc}
        onTransfer={onTransferDoc}
        onDelete={onDeleteDoc}
        onOpen={onOpenDoc}
        canDelete={canDelete}
        cur={cur}
        langue={langue}
        onExport={onExportGeneral}
        onImportExcel={onImportExcel}
        selectedIds={selectedDocIds}
        onToggleSelect={onToggleDocSelect}
        onSelectAll={onSelectAllDocs}
      />

      <SortantTable
        documents={filteredSortant}
        filtreStatut={filtreStatutSortant}
        setFiltreStatut={setFiltreStatutSortant}
        onView={onViewDoc}
        onTransfer={onTransferDoc}
        onDelete={onDeleteDoc}
        onOpen={onOpenDoc}
        canDelete={canDelete}
        canTransfer={canTransfer}
        canModify={canModify}
        onMarquerEnvoye={onMarquerEnvoye}
        onMarquerAttente={onMarquerAttente}
        onAnnuler={onAnnuler}
        cur={cur}
        langue={langue}
        onExport={onExportSortant}
      />
    </div>
  );
}
