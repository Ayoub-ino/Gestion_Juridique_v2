"use client";

import { useState, useMemo } from "react";
import { Langue } from "@/app/types";
import { ExportRow } from "@/lib/exportImport";

const DB_FIELDS = [
  { value: "objet", fr: "Titre / Objet", ar: "الموضوع" },
  { value: "reference", fr: "Numéro de référence", ar: "رقم المرجع" },
  { value: "date", fr: "Date", ar: "التاريخ" },
  { value: "source", fr: "Source", ar: "المصدر" },
  { value: "expediteur", fr: "Expéditeur", ar: "المرسل" },
  { value: "destinataire", fr: "Destinataire", ar: "المستلم" },
  { value: "serviceActuel", fr: "Service actuel", ar: "المصلحة الحالية" },
  { value: "statut", fr: "Statut", ar: "الحالة" },
  { value: "description", fr: "Description", ar: "الوصف" },
  { value: "typeCircuit", fr: "Type de circuit", ar: "نوع الدائرة" },
];

const IGNORE_VALUE = "_ignore";

// Simple similarity: check if the excel column name contains or matches a DB field label
function autoMatch(excelCol: string): string {
  const lower = excelCol.toLowerCase().trim();

  // Direct match on DB field value
  for (const field of DB_FIELDS) {
    if (lower === field.value.toLowerCase()) return field.value;
  }

  // Alias map for common variations
  const aliases: Record<string, string> = {
    titre: "objet",
    title: "objet",
    obj: "objet",
    ref: "reference",
    reference: "reference",
    num: "reference",
    numero: "reference",
    numéro: "reference",
    "n°": "reference",
    "n° de référence": "reference",
    date: "date",
    "date de réception": "date",
    "date réception": "date",
    source: "source",
    expediteur: "expediteur",
    expéditeur: "expediteur",
    from: "expediteur",
    destinataire: "destinataire",
    to: "destinataire",
    service: "serviceActuel",
    "service actuel": "serviceActuel",
    statut: "statut",
    status: "statut",
    etat: "statut",
    état: "statut",
    description: "description",
    desc: "description",
    "type circuit": "typeCircuit",
    typecircuit: "typeCircuit",
    type: "typeCircuit",
  };

  if (aliases[lower]) return aliases[lower];

  // Fuzzy: check if lower starts with or contains a DB field value
  for (const field of DB_FIELDS) {
    if (lower.includes(field.value.toLowerCase()) || field.value.toLowerCase().includes(lower)) {
      return field.value;
    }
  }

  return IGNORE_VALUE;
}

interface ImportMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mapping: Record<string, string>) => void;
  excelColumns: string[];
  langue: Langue;
  previewData?: ExportRow[];
}

export function ImportMappingModal({
  isOpen,
  onClose,
  onConfirm,
  excelColumns,
  langue,
  previewData,
}: ImportMappingModalProps) {
  const colsKey = excelColumns.join(",");

  // Initialise mapping with auto-match on mount / when columns change
  const initialMapping = useMemo(() => {
    const m: Record<string, string> = {};
    for (const col of excelColumns) {
      m[col] = autoMatch(col);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colsKey]);

  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

  // Reset mapping when columns change — adjust state during render (guarded by
  // a change check), the React-recommended alternative to an effect-based reset.
  const [prevCols, setPrevCols] = useState(colsKey);
  if (prevCols !== colsKey) {
    setPrevCols(colsKey);
    setMapping(initialMapping);
  }

  const setField = (excelCol: string, dbField: string) => {
    setMapping((prev) => ({ ...prev, [excelCol]: dbField }));
  };

  const handleConfirm = () => {
    // Build final mapping only for mapped (non-ignored) columns
    const finalMapping: Record<string, string> = {};
    for (const col of excelColumns) {
      if (mapping[col] && mapping[col] !== IGNORE_VALUE) {
        finalMapping[col] = mapping[col];
      }
    }
    onConfirm(finalMapping);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {langue === "fr" ? "Mapper les colonnes" : "مطابقة الأعمدة"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {langue === "fr"
                ? `${excelColumns.length} colonne(s) détectée(s) dans le fichier Excel`
                : `تم اكتشاف ${excelColumns.length} عمود (أعمدة) في ملف Excel`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 font-bold text-slate-600">
                    {langue === "fr" ? "Colonne Excel" : "عمود Excel"}
                  </th>
                  <th className="text-left p-3 font-bold text-slate-600">
                    {langue === "fr" ? "Champ de la base" : "حقل قاعدة البيانات"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {excelColumns.map((col) => (
                  <tr key={col} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-700">{col}</td>
                    <td className="p-3">
                      <select
                        value={mapping[col] || IGNORE_VALUE}
                        onChange={(e) => setField(col, e.target.value)}
                        className={`w-full p-2 border rounded-lg text-xs outline-none focus:border-blue-500 bg-white ${
                          mapping[col] === IGNORE_VALUE
                            ? "border-slate-200 text-slate-400"
                            : "border-blue-200 text-slate-700 font-medium"
                        }`}
                      >
                        <option value={IGNORE_VALUE}>
                          {langue === "fr" ? "— Ignorer —" : "— تجاهل —"}
                        </option>
                        {DB_FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {langue === "fr" ? field.fr : field.ar}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview */}
        {previewData && previewData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-600 mb-2">
              {langue === "fr" ? "Aperçu des données" : "معاينة البيانات"}
              <span className="font-normal text-slate-400 ml-2">
                ({previewData.length} {langue === "fr" ? "lignes" : "صفوف"})
              </span>
            </h4>
            <div className="max-h-32 overflow-y-auto rounded border border-slate-100">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-slate-50">
                    {excelColumns.map((col) => {
                      const mapped = mapping[col];
                      return mapped && mapped !== IGNORE_VALUE ? (
                        <th key={col} className="px-2 py-1 text-left font-bold text-blue-700 border-b">
                          {col} → {mapped}
                        </th>
                      ) : (
                        <th key={col} className="px-2 py-1 text-left font-bold text-slate-400 border-b line-through">
                          {col}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {excelColumns.map((col) => {
                        const mapped = mapping[col];
                        const isIgnored = !mapped || mapped === IGNORE_VALUE;
                        return (
                          <td key={col} className={`px-2 py-1 ${isIgnored ? "text-slate-300 line-through" : "text-slate-600"}`}>
                            {String(row[col] ?? "").substring(0, 30)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
          >
            {langue === "fr" ? "Annuler" : "إلغاء"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
          >
            {langue === "fr" ? "Importer" : "استيراد"}
          </button>
        </div>
      </div>
    </div>
  );
}
