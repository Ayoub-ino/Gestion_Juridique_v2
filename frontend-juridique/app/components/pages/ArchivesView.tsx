"use client";

import type { TranslationKeys } from "@/lib/translations";
import { CourrierSimule, Langue } from "@/app/types";
import { exportRows } from "@/lib/exportImport";
import { normalizeStatus } from "@/lib/utils";
import { ExportButtons } from "@/app/components/common/ExportButtons";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  filteredGeneral: CourrierSimule[];
  docsArchives: number;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  onRegisterRetrait: (doc: { id: number; reference: string; objet: string }) => void;
  getServiceLabel: (service: string, langue: Langue) => string;
}

export function ArchivesView({
  langue,
  cur,
  filteredGeneral,
  docsArchives,
  searchTerm,
  setSearchTerm,
  onRegisterRetrait,
  getServiceLabel,
}: Props) {
  return (
    <div className="space-y-5">
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
    </div>
  );
}
