"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useMemo } from "react";
import { Langue, CourrierSimule } from "@/app/types";
import { exportRows, ExportFormat } from "@/lib/exportImport";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { USER_SERVICE_TO_ENUM } from "@/lib/constants";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
  userService: string;
  userId: number | undefined;
  visibleCourriers: CourrierSimule[];
  hasPermission: (key: string) => boolean;
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  toggleSelected: (id: number) => void;
  selectedDocument: CourrierSimule | null;
  setSelectedDocument: (doc: CourrierSimule | null) => void;
  setShowModal: (show: boolean) => void;
  openTransfer: (doc: CourrierSimule) => void;
  handleDelete: (doc: CourrierSimule) => void;
  getServiceLabel: (service: string, langue: Langue) => string;
}

export function MesDossiersEnCoursView({ 
  langue, cur, userService, userId, visibleCourriers, hasPermission,
  selectedIds, setSelectedIds, toggleSelected, setSelectedDocument, setShowModal,
  openTransfer, handleDelete, getServiceLabel
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [volumeFilter, setVolumeFilter] = useState<"all" | "dizaines" | "cinquantaines">("all");
  const [dizaineRange, setDizaineRange] = useState(0);
  const [cinquantaineRange, setCinquantaineRange] = useState(0);

  // Map RBAC service code to ServiceTribunal enum for comparison with serviceActuelKey
  const userServiceEnum = USER_SERVICE_TO_ENUM[userService] || userService;

  // Filter documents that are currently in user's service OR specifically transferred to this user
  const mesDossiers = useMemo(() => {
    return visibleCourriers.filter((doc) => {
      // Check if document is in user's active service (using enum mapping)
      const inMyService = doc.serviceActuelKey === userServiceEnum
        || doc.serviceActuelKey === userService
        || doc.serviceActuel === userServiceEnum
        || doc.serviceActuel === userService;
      
      // Check if document was specifically transferred to this user (TargetUserId)
      const transferredToMe = doc.targetUserId === userId;
      
      // Document must be in my service OR transferred to me
      return inMyService || transferredToMe;
    });
  }, [visibleCourriers, userService, userServiceEnum, userId]);

  // Apply search filter
  const searchedDossiers = useMemo(() => {
    if (!searchTerm) return mesDossiers;
    const s = searchTerm.toLowerCase();
    return mesDossiers.filter((doc) =>
      doc.objet?.toLowerCase().includes(s) ||
      doc.reference?.toLowerCase().includes(s) ||
      doc.source?.toLowerCase().includes(s) ||
      doc.serviceActuel?.toLowerCase().includes(s)
    );
  }, [mesDossiers, searchTerm]);

  // Apply volume filter
  const filteredDossiers = useMemo(() => {
    let result = searchedDossiers;
    
    if (volumeFilter === "dizaines") {
      const start = dizaineRange * 10;
      const end = start + 10;
      result = result.slice(start, end);
    } else if (volumeFilter === "cinquantaines") {
      const start = cinquantaineRange * 50;
      const end = start + 50;
      result = result.slice(start, end);
    }
    
    return result;
  }, [searchedDossiers, volumeFilter, dizaineRange, cinquantaineRange]);

  // Calculate pagination info
  const totalDizaines = Math.ceil(searchedDossiers.length / 10);
  const totalCinquantaines = Math.ceil(searchedDossiers.length / 50);

  const getDizaineLabel = (index: number) => {
    const start = index * 10 + 1;
    const end = Math.min((index + 1) * 10, searchedDossiers.length);
    return `${start} - ${end}`;
  };

  const getCinquantaineLabel = (index: number) => {
    const start = index * 50 + 1;
    const end = Math.min((index + 1) * 50, searchedDossiers.length);
    return `${start} - ${end}`;
  };

  const exportDossiers = (format: ExportFormat) => {
    const rows = filteredDossiers.map((doc) => ({
      reference: doc.reference,
      objet: doc.objet,
      type: doc.type,
      date: doc.date,
      source: doc.source,
      serviceActuel: doc.serviceActuel,
      statut: doc.statut,
    }));
    exportRows(rows, "mes-dossiers-en-cours", format, cur.mesDossiersEnCours || "Mes Dossiers En Cours");
  };

  return (
    <div className="space-y-5">
      {/* Header with filters */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder={cur.recherche}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-64 p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50"
            />
            
            {/* Volume Filter Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">
                {langue === "fr" ? "Filtre volume :" : "تصفية الحجم :"}
              </span>
              <select
                value={volumeFilter}
                onChange={(e) => setVolumeFilter(e.target.value as "all" | "dizaines" | "cinquantaines")}
                className="p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
              >
                <option value="all">{langue === "fr" ? "Tous" : "الكل"}</option>
                <option value="dizaines">{langue === "fr" ? "Par dizaines (10)" : "بالعشرات (10)"}</option>
                <option value="cinquantaines">{langue === "fr" ? "Par cinquantaines (50)" : "بالخمسينات (50)"}</option>
              </select>
            </div>

            {/* Dizaines Pagination */}
            {volumeFilter === "dizaines" && totalDizaines > 1 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-slate-500">
                  {langue === "fr" ? "Dizaine :" : "العشرية :"}
                </span>
                {Array.from({ length: totalDizaines }, (_, i) => i).map((i) => (
                  <button
                    key={i}
                    onClick={() => setDizaineRange(i)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                      dizaineRange === i
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {getDizaineLabel(i)}
                  </button>
                ))}
              </div>
            )}

            {/* Cinquantaines Pagination */}
            {volumeFilter === "cinquantaines" && totalCinquantaines > 1 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-slate-500">
                  {langue === "fr" ? "Cinquantaine :" : "الخمسينية :"}
                </span>
                {Array.from({ length: totalCinquantaines }, (_, i) => i).map((i) => (
                  <button
                    key={i}
                    onClick={() => setCinquantaineRange(i)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                      cinquantaineRange === i
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {getCinquantaineLabel(i)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <ExportButtons
              onExcel={() => exportDossiers("export excel")}
              onWord={() => exportDossiers("export word")}
              excelLabel={selectedIds.length > 0 ? `export excel (${selectedIds.length})` : "export excel"}
              wordLabel={selectedIds.length > 0 ? `export word (${selectedIds.length})` : "export word"}
            />
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {cur.mesDossiersEnCours} ({searchedDossiers.length})
            </h3>
            <p className="text-[11px] text-slate-500 font-semibold">
              {filteredDossiers.length} / {searchedDossiers.length} {langue === "fr" ? "dossiers affichés" : "ملفات معروضة"}
            </p>
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
                    checked={selectedIds.length === filteredDossiers.length && filteredDossiers.length > 0}
                    onChange={() => {
                      if (selectedIds.length === filteredDossiers.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(filteredDossiers.map((d) => d.id));
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
              {filteredDossiers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    {cur.aucunDoc}
                  </td>
                </tr>
              ) : (
                filteredDossiers.map((doc) => (
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
                          onClick={() => { setSelectedDocument(doc); setShowModal(true); }}
                          className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold"
                        >
                          {cur.btnVoir}
                        </button>
                        {doc.transmissible !== "Non" && (
                          <button
                            type="button"
                            onClick={() => openTransfer(doc)}
                            className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 text-[10px] font-bold"
                          >
                            {cur.btnSuivant}
                          </button>
                        )}
                        {hasPermission("supprimer") && (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc)}
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