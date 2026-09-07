"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useRef } from "react";
import { CourrierSimule } from "@/app/types";
import { ExportFormat } from "@/lib/exportImport";
import { getWorkflowProgress, getDelayDays } from "@/lib/constants";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { useAuth } from "@/context/AuthContext";

interface GeneralTableProps {
  documents: CourrierSimule[];
  onView: (doc: CourrierSimule) => void;
  onTransfer: (doc: CourrierSimule) => void;
  onDelete: (doc: CourrierSimule) => void;
  onOpen?: (doc: CourrierSimule) => void;
  canDelete?: boolean;
  cur: TranslationKeys;
  langue?: "fr" | "ar";
  onExport?: (format: ExportFormat) => void;
  onImportExcel?: (file: File) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  onSelectAll?: () => void;
}

export function GeneralTable({
  documents,
  onView,
  onTransfer,
  onDelete,
  canDelete = true,
  cur,
  onExport,
  onImportExcel,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
}: GeneralTableProps) {
  const { hasPermission } = useAuth();
  const canImport = hasPermission("creer_courrier_admin") || hasPermission("creer_courrier_juridique");
  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.includes(d.id));
  const someSelected = selectedIds.length > 0 && !allSelected;
  const importExcelRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 text-xs">
          {cur.entrants} {cur.et} {cur.juridique}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {documents.length} {cur.documents}
          </span>
          {onExport && (
            <ExportButtons onExcel={() => onExport("export excel")} onWord={() => onExport("export word")} />
          )}
          {onImportExcel && canImport && (
            <label className="px-2 py-1 rounded bg-violet-600 text-white text-[10px] font-bold border border-violet-700 hover:bg-violet-700 cursor-pointer">
              📥 {cur.importExcel}
              <input ref={importExcelRef} type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f && onImportExcel) onImportExcel(f); e.target.value = ""; }} className="hidden" />
            </label>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-600 text-[11px]">
              {onToggleSelect && (
                <th className="p-3 w-8">
                  <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={onSelectAll} className="w-3.5 h-3.5" />
                </th>
              )}
              <th className="p-3 text-start">{cur.tblTitre}</th>
              <th className="p-3 text-start">{cur.tblRef}</th>
              <th className="p-3 text-start">{cur.tblType}</th>
              <th className="p-3 text-start">{cur.tblDate}</th>
              <th className="p-3 text-start">{cur.tblSource}</th>
              <th className="p-3 text-start">{cur.tblDest}</th>
              <th className="p-3 text-center">{cur.avancement}</th>
              <th className="p-3 text-center">{cur.tblActions}</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={onToggleSelect ? 9 : 8} className="p-8 text-center font-bold text-slate-400 bg-slate-50/50">
                  {cur.aucunDoc}
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const typeColor = doc.type === "entrant-juridique" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700";
                const progress = getWorkflowProgress(doc.serviceActuelKey || doc.serviceActuel);
                const delayDays = getDelayDays(doc.dateRaw || doc.date);
                const isLate = delayDays > 7;

                return (
                  <tr key={doc.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isLate ? "bg-red-50/50" : ""}`}>
                    {onToggleSelect && (
                      <td className="p-3">
                        <input type="checkbox" checked={selectedIds.includes(doc.id)} onChange={() => onToggleSelect(doc.id)} className="w-3.5 h-3.5" />
                      </td>
                    )}
                    <td className="p-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        {isLate && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title={`${delayDays} jours`}></span>}
                        {doc.objet}
                        {doc.filePath && (
                          <span className="text-amber-500 flex-shrink-0" title={doc.filePath}>📎</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-600">{doc.reference}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${typeColor}`}>
                        {doc.type === "entrant-admin" ? cur.admin : cur.juridique}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{doc.date}</td>
                    <td className="p-3 text-slate-700">{doc.source}</td>
                    <td className="p-3 text-slate-700">{doc.serviceActuel}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${progress.pct === 100 ? "bg-emerald-500" : progress.pct > 50 ? "bg-blue-500" : "bg-amber-500"}`} style={{ width: `${progress.pct}%` }}></div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold w-6 text-end">{progress.label}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center space-x-1 whitespace-nowrap">
                      <button type="button" onClick={() => onView(doc)} className="text-blue-600 hover:text-blue-800 font-bold px-2 py-1 rounded hover:bg-blue-50">{cur.btnVoir}</button>
                      {doc.transmissible !== "Non" && (
                        <button
                          onClick={() => onTransfer(doc)}
                          className="font-bold px-2 py-1 rounded text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                        >
                          {cur.btnSuivant}
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => onDelete(doc)} className="text-red-600 hover:text-red-800 font-bold px-2 py-1 rounded hover:bg-red-50">{cur.btnSupprimer}</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
