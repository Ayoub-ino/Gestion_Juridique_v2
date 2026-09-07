"use client";

import type { TranslationKeys } from "@/lib/translations";
import { CourrierSimule, Langue } from "@/app/types";
import { normalizeStatus } from "@/lib/utils";
import { exportRows } from "@/lib/exportImport";
import { ExportButtons } from "@/app/components/common/ExportButtons";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  visibleCourriers: CourrierSimule[];
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  searchFilterService: string;
  setSearchFilterService: (s: string) => void;
  searchFilterType: string;
  setSearchFilterType: (s: string) => void;
  searchFilterDateDebut: string;
  setSearchFilterDateDebut: (s: string) => void;
  searchFilterDateFin: string;
  setSearchFilterDateFin: (s: string) => void;
  searchLocalFiles: boolean;
  setSearchLocalFiles: (b: boolean) => void;
  localFiles: { name: string; content: string; path: string }[];
  setLocalFiles: (f: { name: string; content: string; path: string }[]) => void;
  onSearchLocalDirectory: () => void;
  getLocalSearchResults: (term: string) => { name: string; path: string; snippet: string }[];
  getServiceLabel: (service: string, langue: Langue) => string;
  onViewDoc: (doc: CourrierSimule) => void;
}

export function RechercheDossiersView({
  langue,
  cur,
  visibleCourriers,
  searchTerm,
  setSearchTerm,
  searchFilterService,
  setSearchFilterService,
  searchFilterType,
  setSearchFilterType,
  searchFilterDateDebut,
  setSearchFilterDateDebut,
  searchFilterDateFin,
  setSearchFilterDateFin,
  searchLocalFiles,
  setSearchLocalFiles,
  localFiles,
  setLocalFiles,
  onSearchLocalDirectory,
  getLocalSearchResults,
  getServiceLabel,
  onViewDoc,
}: Props) {
  const s = searchTerm.toLowerCase().trim();
  const searchResults = (() => {
    let results = visibleCourriers;
    if (s) {
      results = results.filter((doc) =>
        doc.reference.toLowerCase().includes(s) ||
        doc.objet.toLowerCase().includes(s) ||
        doc.source.toLowerCase().includes(s) ||
        doc.serviceActuel.toLowerCase().includes(s) ||
        doc.statut.toLowerCase().includes(s)
      );
    }
    if (searchFilterService) {
      results = results.filter((doc) => doc.serviceActuel === searchFilterService);
    }
    if (searchFilterType) {
      results = results.filter((doc) => doc.type === searchFilterType);
    }
    if (searchFilterDateDebut) {
      results = results.filter((doc) => doc.date >= searchFilterDateDebut);
    }
    if (searchFilterDateFin) {
      results = results.filter((doc) => doc.date <= searchFilterDateFin);
    }
    return results;
  })();
  const hasSearched = s.length > 0 || searchFilterService.length > 0 || searchFilterType.length > 0 || searchFilterDateDebut.length > 0 || searchFilterDateFin.length > 0;

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={cur.recherche_placeholder}
            className="flex-1 min-w-64 p-3 border border-slate-300 dark:border-slate-600 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50 dark:bg-slate-700 dark:text-slate-200"
          />
          <button
            type="button"
            onClick={() => {
              // If no search term, toggle the local search
              if (!searchTerm.trim()) {
                setSearchTerm(cur.recherche_exemple);
              }
            }}
            className="px-6 py-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
          >
            {cur.lancerRecherche}
          </button>
          <button
            type="button"
            onClick={onSearchLocalDirectory}
            className="px-6 py-3 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition"
          >
            {cur.recherchePC}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <select value={searchFilterService} onChange={(e) => setSearchFilterService(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-700 dark:text-slate-200 outline-none">
            <option value="">{cur.tousLesServices}</option>
            {[...new Set(visibleCourriers.map(d => d.serviceActuel))].sort().map(svc => (
              <option key={svc} value={svc}>{getServiceLabel(svc, langue)}</option>
            ))}
          </select>
          <select value={searchFilterType} onChange={(e) => setSearchFilterType(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-700 dark:text-slate-200 outline-none">
            <option value="">{cur.tousLesTypes}</option>
            <option value="entrant-admin">{cur.admin}</option>
            <option value="entrant-juridique">{cur.juridique}</option>
            <option value="sortant-normal">{cur.normal}</option>
            <option value="sortant-demande">{cur.demande}</option>
          </select>
          <input type="date" value={searchFilterDateDebut} onChange={(e) => setSearchFilterDateDebut(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-700 dark:text-slate-200 outline-none" title={cur.dateDebut} />
          <input type="date" value={searchFilterDateFin} onChange={(e) => setSearchFilterDateFin(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-700 dark:text-slate-200 outline-none" title={cur.dateFin} />
          {(searchFilterService || searchFilterType || searchFilterDateDebut || searchFilterDateFin) && (
            <button type="button" onClick={() => { setSearchFilterService(""); setSearchFilterType(""); setSearchFilterDateDebut(""); setSearchFilterDateFin(""); }} className="px-3 py-2 text-[11px] font-bold text-red-600 hover:text-red-800 underline">
              {cur.effacerFiltres}
            </button>
          )}
        </div>
        {searchLocalFiles && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-bold">
              {localFiles.length} {cur.fichiersCharges}
            </span>
            <button
              type="button"
              onClick={() => { setSearchLocalFiles(false); setLocalFiles([]); }}
              className="text-red-500 hover:text-red-700 font-bold underline"
            >
              {cur.decharger}
            </button>
          </div>
        )}
      </div>

      {hasSearched ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-xs text-slate-800">
              {cur.resultatsPour(searchTerm)} ({searchResults.length})
            </h3>
            <ExportButtons
              onExcel={() => exportRows(searchResults.map(d => ({
                [cur.tblRef]: d.reference,
                [cur.tblTitre]: d.objet,
                [cur.tblSource]: d.source,
                [cur.serviceActuel]: d.serviceActuel,
                [cur.statutAction]: d.statut,
              })), "recherche", "export excel", cur.rechercheDossiers)}
              onWord={() => exportRows(searchResults.map(d => ({
                [cur.tblRef]: d.reference,
                [cur.tblTitre]: d.objet,
                [cur.tblSource]: d.source,
                [cur.serviceActuel]: d.serviceActuel,
                [cur.statutAction]: d.statut,
              })), "recherche", "export word", cur.rechercheDossiers)}
            />
          </div>
          {searchResults.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400 font-bold text-xs">{cur.aucunResultatTrouve}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-sky-50 border-b border-sky-200 text-slate-700">
                  <tr>
                    <th className="p-3 text-start">{cur.tblRef}</th>
                    <th className="p-3 text-start">{cur.tblTitre}</th>
                    <th className="p-3 text-start">{cur.tblType}</th>
                    <th className="p-3 text-start">{cur.tblDate}</th>
                    <th className="p-3 text-start">{cur.tblSource}</th>
                    <th className="p-3 text-start">{cur.serviceActuel}</th>
                    <th className="p-3 text-start">{cur.statutAction}</th>
                    <th className="p-3 text-center">{cur.tblActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-600">{doc.reference}</td>
                      <td className="p-3 font-semibold text-slate-800">{doc.objet}</td>
                      <td className="p-3 text-slate-600">{doc.type === "entrant-admin" ? cur.admin : doc.type === "entrant-juridique" ? cur.juridique : doc.type}</td>
                      <td className="p-3 text-slate-500">{doc.date}</td>
                      <td className="p-3">{doc.source}</td>
                      <td className="p-3">{getServiceLabel(doc.serviceActuel, langue)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          normalizeStatus(doc.statut) === "Archive" ? "bg-slate-100 text-slate-600" :
                          normalizeStatus(doc.statut) === "EnCours" || normalizeStatus(doc.statut) === "EnInstance" ? "bg-blue-50 text-blue-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>{doc.statut}</span>
                      </td>
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => onViewDoc(doc)}
                          className="text-blue-600 hover:text-blue-800 font-bold px-2 py-1 rounded hover:bg-blue-50">
                          {cur.btnVoir}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-12 text-center">
          <p className="text-base font-bold text-slate-900">{cur.recherche_label}</p>
          <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
            {cur.recherche_description}
          </p>
        </div>
      )}

      {searchLocalFiles && searchTerm.trim() && (() => {
        const localResults = getLocalSearchResults(searchTerm);
        return localResults.length > 0 ? (
          <div className="bg-white border border-purple-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-purple-200 bg-purple-50">
              <h3 className="font-bold text-xs text-purple-800">
                {langue === "fr" ? `Fichiers locaux trouvés` : `الملفات المحلية`} ({localResults.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-purple-50 border-b border-purple-200 text-purple-700">
                  <tr>
                    <th className="p-3 text-start">{cur.nomFichier}</th>
                    <th className="p-3 text-start">{cur.tblType}</th>
                    <th className="p-3 text-start">{cur.chemin}</th>
                    <th className="p-3 text-start">{cur.extrait}</th>
                  </tr>
                </thead>
                <tbody>
                  {localResults.map((f, i) => {
                    const ext = f.name.split(".").pop()?.toLowerCase() || "";
                    const typeColors: Record<string, string> = {
                      xlsx: "bg-emerald-100 text-emerald-700",
                      xls: "bg-emerald-100 text-emerald-700",
                      docx: "bg-blue-100 text-blue-700",
                      doc: "bg-blue-100 text-blue-700",
                      pdf: "bg-red-100 text-red-700",
                      csv: "bg-amber-100 text-amber-700",
                      txt: "bg-slate-100 text-slate-700",
                    };
                    return (
                      <tr key={i} className="border-b border-purple-100 hover:bg-purple-50/30">
                        <td className="p-3 font-bold text-purple-800">{f.name}</td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${typeColors[ext] || "bg-slate-100 text-slate-700"}`}>
                            {ext}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-500 text-[10px]">{f.path}</td>
                        <td className="p-3 text-slate-600 max-w-md truncate">{f.snippet || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}
