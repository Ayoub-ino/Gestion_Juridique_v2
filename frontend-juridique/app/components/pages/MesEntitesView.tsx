"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useMemo } from "react";
import { CourrierSimule, Langue, VueActive } from "@/app/types";
import { ExportFormat } from "@/lib/exportImport";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { useAuth } from "@/context/AuthContext";
import { SERVICE_GROUPS } from "@/lib/constants";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  filteredGeneral: CourrierSimule[];
  selectedIds: number[];
  selectedDocIds: number[];
  docsArchives: number;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  onNavigate: (v: VueActive) => void;
  onOpenRetourner: () => void;
  toggleSelected: (id: number) => void;
  setSelectedIds: (ids: number[]) => void;
  onViewDoc: (doc: CourrierSimule) => void;
  onTransfer: (doc: CourrierSimule) => void;
  onBatchTransferSelected: () => void;
  onDelete: (doc: CourrierSimule) => void;
  onArchiveSelection: () => void;
  onExportSelected: (format: ExportFormat) => void;
  onExportGeneral: (format: ExportFormat) => void;
  onDownloadTemplate: () => void;
  onImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getServiceLabel: (service: string, langue: Langue) => string;
  canTransfer?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
}

export function MesEntitesView({
  langue,
  cur,
  filteredGeneral,
  selectedIds,
  selectedDocIds,
  docsArchives,
  searchTerm,
  setSearchTerm,
  onNavigate,
  onOpenRetourner,
  toggleSelected,
  setSelectedIds,
  onViewDoc,
  onTransfer,
  onBatchTransferSelected,
  onDelete,
  onArchiveSelection,
  onExportSelected,
  onExportGeneral,
  onDownloadTemplate,
  onImportExcel,
  getServiceLabel,
  canTransfer = true,
  canArchive = true,
  canDelete = true,
}: Props) {
  const { hasPermission } = useAuth();
  const canImport = hasPermission("creer_courrier_admin") || hasPermission("creer_courrier_juridique");

  // Filter state
  const [serviceFilter, setServiceFilter] = useState("all");
  const [refFilter, setRefFilter] = useState("");

  // Build flat list of all services for the dropdown
  const allServiceOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (const group of SERVICE_GROUPS) {
      for (const child of group.children) {
        options.push({ value: child.value, label: langue === "fr" ? child.fr : child.ar });
      }
    }
    return options;
  }, [langue]);

  // Apply service + reference filters to filteredGeneral
  const displayDocs = useMemo(() => {
    let result = filteredGeneral;
    if (serviceFilter !== "all") {
      result = result.filter((doc) => doc.serviceActuelKey === serviceFilter || doc.serviceActuel === serviceFilter);
    }
    if (refFilter.trim()) {
      const s = refFilter.trim().toLowerCase();
      result = result.filter((doc) => doc.reference?.toLowerCase().includes(s));
    }
    return result;
  }, [filteredGeneral, serviceFilter, refFilter]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <button
            type="button"
            onClick={() => onNavigate("entrant-admin")}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
          >
            + {cur.gestionCourriers}
          </button>
          <input
            type="text"
            placeholder={cur.recherche}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-64 p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50"
          />
          {/* Service filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white min-w-40"
          >
            <option value="all">{langue === "fr" ? "Tous les services" : "جميع المصالح"}</option>
            {allServiceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {/* Reference filter */}
          <input
            type="text"
            placeholder={langue === "fr" ? "N° de référence..." : "رقم المرجع..."}
            value={refFilter}
            onChange={(e) => setRefFilter(e.target.value)}
            className="p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50 min-w-40"
          />
          <button
            type="button"
            onClick={onOpenRetourner}
            className="px-4 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold"
          >
            {cur.docsRetourner} ({docsArchives})
          </button>
          <div className="flex flex-wrap gap-1.5">
            <ExportButtons
              onExcel={() => selectedDocIds.length > 0 ? onExportSelected("export excel") : onExportGeneral("export excel")}
              onWord={() => selectedDocIds.length > 0 ? onExportSelected("export word") : onExportGeneral("export word")}
              excelLabel={selectedDocIds.length > 0 ? `export excel (${selectedDocIds.length})` : "export excel"}
              wordLabel={selectedDocIds.length > 0 ? `export word (${selectedDocIds.length})` : "export word"}
            />
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-200 hover:bg-teal-100 cursor-pointer flex items-center gap-1"
            >                        📋 {cur.chargerModele}
            </button>
            {canImport && (
              <label className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-bold border border-violet-700 hover:bg-violet-700 cursor-pointer flex items-center gap-1">                        📥 {cur.importExcel}
                <input type="file" accept=".xlsx,.xls" onChange={onImportExcel} className="hidden" />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {cur.mesDocuments} ({displayDocs.length})
            </h3>
            <p className="text-[11px] text-slate-500 font-semibold">
              {selectedIds.length} {cur.doc_selectionne}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canTransfer && (
              <button
                type="button"
                onClick={onBatchTransferSelected}
                className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold"
              >
                {cur.transfererSelection}
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                onClick={onArchiveSelection}
                className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold"
              >
                {cur.archiverSelection}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-sky-50 border-b border-sky-200 text-slate-700">
              <tr>
                <th className="p-3 text-start w-10">
                  <input
                    type="checkbox"
                    aria-label={cur.select}
                    checked={selectedIds.length === displayDocs.length && displayDocs.length > 0}
                    onChange={() => {
                      if (selectedIds.length === displayDocs.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(displayDocs.map((d) => d.id));
                      }
                    }}
                  />
                </th>
                <th className="p-3 text-start">{cur.tblTitre}</th>
                <th className="p-3 text-start">{cur.tblRef}</th>
                <th className="p-3 text-start">{cur.tblType}</th>
                <th className="p-3 text-start">{cur.tblDate}</th>
                <th className="p-3 text-start">{cur.tblSource}</th>
                <th className="p-3 text-start">{cur.tblDest}</th>
                <th className="p-3 text-center">{cur.tblActions}</th>
              </tr>
            </thead>
            <tbody>
              {displayDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    {cur.aucunDoc}
                  </td>
                </tr>
              ) : (
                displayDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={doc.reference}
                        checked={selectedIds.includes(doc.id)}
                        onChange={() => toggleSelected(doc.id)}
                      />
                    </td>
                    <td className="p-3 font-bold text-slate-800">{doc.objet}</td>
                    <td className="p-3 font-mono text-slate-600">{doc.reference}</td>
                    <td className="p-3">
                      {doc.type === "entrant-juridique" ? cur.juridique : cur.admin}
                    </td>
                    <td className="p-3 text-slate-500">{doc.date}</td>
                    <td className="p-3">{doc.source}</td>
                    <td className="p-3">{getServiceLabel(doc.serviceActuel, langue)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onViewDoc(doc)}
                          className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold"
                        >
                          {cur.btnVoir}
                        </button>
                        {doc.transmissible !== "Non" && canTransfer && (
                          <button
                            type="button"
                            onClick={() => onTransfer(doc)}
                            className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 text-[10px] font-bold"
                          >
                            {cur.btnSuivant}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(doc)}
                            className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-bold"
                          >
                            {cur.btnSupprimer}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
