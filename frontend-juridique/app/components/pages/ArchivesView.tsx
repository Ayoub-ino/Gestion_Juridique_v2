"use client";

import type { TranslationKeys } from "@/lib/translations";
import { CourrierSimule, Langue } from "@/app/types";
import { exportRows } from "@/lib/exportImport";
import { normalizeStatus } from "@/lib/utils";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { useAuth } from "@/context/AuthContext";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  showCorbeille: boolean;
  setShowCorbeille: (b: boolean) => void;
  corbeilleDocs: { id: number; reference: string; objet: string; serviceActuel: string }[];
  onFetchCorbeille: () => void;
  onRestoreDocument: (id: number) => void;
  filteredGeneral: CourrierSimule[];
  docsArchives: number;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  onRegisterRetrait: (doc: { id: number; reference: string; objet: string }) => void;
  canSeeCorbeille: boolean;
  getServiceLabel: (service: string, langue: Langue) => string;
}

export function ArchivesView({
  langue,
  cur,
  showCorbeille,
  setShowCorbeille,
  corbeilleDocs,
  onFetchCorbeille,
  onRestoreDocument,
  filteredGeneral,
  docsArchives,
  searchTerm,
  setSearchTerm,
  onRegisterRetrait,
  canSeeCorbeille,
  getServiceLabel,
}: Props) {
  const { hasPermission } = useAuth();
  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setShowCorbeille(false); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${!showCorbeille ? "bg-blue-600 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
        >
          {cur.archivesJuridiques}
        </button>
        {canSeeCorbeille && (
          <button
            type="button"
            onClick={() => { setShowCorbeille(true); onFetchCorbeille(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${showCorbeille ? "bg-red-600 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
          >
            {cur.corbeille} ({corbeilleDocs.length})
          </button>
        )}
      </div>

      {!showCorbeille ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm">{cur.archivesJuridiques}</h3>
              <p className="text-xs text-slate-500 mt-1">{cur.retraitSection}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm">{cur.tousRetraits}</h3>
              <p className="text-2xl font-bold text-slate-900 mt-2">{docsArchives}</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <input
                type="text"
                placeholder={cur.recherche}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-md p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50"
              />
              <ExportButtons
                onExcel={() => {
                  const rows = filteredGeneral.slice(0, 5).map((doc, index) => ({
                    reference: doc.reference,
                    objet: doc.objet,
                    service: doc.serviceActuel,
                    retrait: index % 2 === 0 ? cur.nonCommence : cur.enCours
                  }));
                  exportRows(rows, "archives", "export excel", cur.archivesJuridiques);
                }}
                onWord={() => {
                  const rows = filteredGeneral.slice(0, 5).map((doc) => ({
                    reference: doc.reference,
                    objet: doc.objet,
                    service: doc.serviceActuel,
                    statut: doc.statut
                  }));
                  exportRows(rows, "archives", "export word", cur.archivesJuridiques);
                }}
                excelLabel="export excel"
                wordLabel="export word"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-sky-50 text-slate-700 border-b border-sky-200">
                  <tr>
                    <th className="p-3 text-start">{cur.tblRef}</th>
                    <th className="p-3 text-start">{cur.tblTitre}</th>
                    <th className="p-3 text-start">{cur.serviceActuel}</th>
                    <th className="p-3 text-start">{cur.statutAction}</th>
                    <th className="p-3 text-center">{cur.tblActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGeneral.slice(0, 10).map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-mono">{doc.reference}</td>
                      <td className="p-3 font-bold">{doc.objet}</td>
                      <td className="p-3">{getServiceLabel(doc.serviceActuel, langue)}</td>
                      <td className="p-3">
                        {normalizeStatus(doc.statut) === "Archive" ? cur.archiveDef : cur.enCours}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => onRegisterRetrait({
                            id: doc.id,
                            reference: doc.reference,
                            objet: doc.objet
                          })}
                          className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold"
                        >
                          {cur.btnEnregistrer}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">{cur.documentsSupprimes}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-red-50 text-slate-700 border-b border-red-200">
                <tr>
                  <th className="p-3 text-start">{cur.tblRef}</th>
                  <th className="p-3 text-start">{cur.tblTitre}</th>
                  <th className="p-3 text-start">{cur.serviceActuel}</th>
                  <th className="p-3 text-center">{cur.tblActions}</th>
                </tr>
              </thead>
              <tbody>
                {corbeilleDocs.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">{cur.aucunSupprime}</td></tr>
                ) : (
                  corbeilleDocs.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-100 hover:bg-red-50/30">
                      <td className="p-3 font-mono">{doc.reference}</td>
                      <td className="p-3 font-bold">{doc.objet}</td>
                      <td className="p-3">{getServiceLabel(doc.serviceActuel, langue)}</td>
                      <td className="p-3 text-center">
                        {hasPermission("restaurer") && (
                          <button
                            type="button"
                            onClick={() => onRestoreDocument(doc.id)}
                            className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold"
                          >
                            {cur.restaurer}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
