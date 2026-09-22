"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useMemo, useRef, useState } from "react";
import { Langue } from "@/app/types";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/utils";
import { notify } from "@/lib/feedback";
import { downloadSheet, readSheetRows } from "@/lib/exportImport";

export interface Option {
  value: string;
  label: string;
}

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
  typeOptions: Option[];
  etatOptions: Option[];
  serviceOptions: Option[];
  /** Called after a run that created at least one row, so the register refreshes. */
  onImported: () => void;
  onClose: () => void;
}

type Target = "serial" | "additionalInfo" | "type" | "etat" | "service";

const TARGETS: Target[] = ["serial", "additionalInfo", "type", "etat", "service"];

/** Accent- and case-insensitive, so « Série » matches « serie ». */
const normalise = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[«»"']/g, "")
    .trim();

/** Loose per-field hints, in both languages — the sheet can be either. */
const HINTS: Record<Target, string[]> = {
  serial: ["serie", "الرقم التسلسلي", "تسلسلي"],
  additionalInfo: ["information", "info", "معلومات إضافية", "إضافية"],
  type: ["type", "النوع"],
  etat: ["etat", "حالة", "الحالة"],
  service: ["service", "مصلحة", "المصلحة"],
};

const matches = (header: string, target: Target) => {
  const h = normalise(header);
  return h.length > 0 && HINTS[target].some((hint) => h.includes(normalise(hint)));
};

/**
 * Locates the header row and maps its columns onto the five entry fields.
 *
 * A sheet's header is not always on row 1: our own export carries the
 * institutional preamble, while the downloadable template starts immediately.
 * Rather than privilege one shape, the best-scoring row in the first stretch of
 * the sheet wins, and the user can override both it and the mapping.
 */
function detect(grid: string[][]): { headerRow: number; mapping: Record<Target, string> } {
  let bestRow = 0;
  let bestScore = 0;

  grid.slice(0, 15).forEach((row, i) => {
    const score = TARGETS.filter((t) => row.some((cell) => matches(cell, t))).length;
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  });

  // A single coincidental match is not a header — fall back to the first row.
  const headerRow = bestScore >= 2 ? bestRow : 0;
  const headers = grid[headerRow] ?? [];
  const mapping = {} as Record<Target, string>;
  TARGETS.forEach((t) => {
    mapping[t] = headers.find((h) => matches(h, t)) ?? "";
  });

  return { headerRow, mapping };
}

export function EquipmentImport({
  langue, cur, token, typeOptions, etatOptions, serviceOptions, onImported, onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<Record<Target, string>>({
    serial: "", additionalInfo: "", type: "", etat: "", service: "",
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState("");

  const headers = useMemo(() => grid[headerRow - 1] ?? [], [grid, headerRow]);
  const dataRows = useMemo(
    () => grid.slice(headerRow).filter((r) => r.some((c) => c.trim() !== "")),
    [grid, headerRow],
  );

  /**
   * Resolves a cell to one of the list codes. Accepts the label (either
   * language, case-insensitively) or the code itself, so a file built from the
   * template — which carries labels — and a file built from our export both work.
   */
  const resolve = (options: Option[], value: string): string | null => {
    const v = value.trim();
    if (!v) return null;
    const lower = v.toLowerCase();
    return (
      options.find((o) => o.value === v)?.value ??
      options.find((o) => o.value.toLowerCase() === lower)?.value ??
      options.find((o) => o.label.toLowerCase() === lower)?.value ??
      null
    );
  };

  const onFileSelected = async (file: File) => {
    setSummary("");
    setErrors([]);
    setFileName(file.name);
    try {
      const loaded = await readSheetRows(file);
      if (loaded.length === 0) {
        setGrid([]);
        notify(cur.fichierIllisible);
        return;
      }
      const detected = detect(loaded);
      setGrid(loaded);
      setHeaderRow(detected.headerRow + 1);
      setMapping(detected.mapping);
    } catch {
      setGrid([]);
      notify(cur.fichierIllisible);
    }
  };

  const columnOptions = useMemo(
    () => headers.filter((h) => h !== ""),
    [headers],
  );

  const downloadTemplate = () =>
    downloadSheet(
      [
        [cur.serie, cur.informationsSupplementaires, cur.tblType, cur.etat, cur.service],
        [
          "ABC123",
          "",
          typeOptions[0]?.label ?? "",
          etatOptions[0]?.label ?? "",
          serviceOptions[0]?.label ?? "",
        ],
        ...Array.from({ length: 10 }, () => ["", "", "", "", ""]),
      ],
      langue === "fr" ? "Modele_Equipements" : "نموذج_المعدات",
    );

  const cellOf = (row: string[], target: Target) => {
    const column = mapping[target];
    if (!column) return "";
    const index = headers.indexOf(column);
    return index >= 0 ? (row[index] ?? "") : "";
  };

  const runImport = async () => {
    if (dataRows.length === 0) return;
    setBusy(true);
    setErrors([]);
    setSummary("");

    const problems: string[] = [];
    const seenSerials = new Set<string>();
    let imported = 0;

    // Sequential on purpose: the register's uniqueness rule is enforced by the
    // backend, and firing rows in parallel would race it on duplicate serials.
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const line = headerRow + 1 + i;
      const serial = cellOf(row, "serial").trim();
      const rawType = cellOf(row, "type");
      const rawEtat = cellOf(row, "etat");
      const rawService = cellOf(row, "service");

      const lineErrors: string[] = [];
      if (!serial) lineErrors.push(langue === "fr" ? "Série vide" : "الرقم التسلسلي فارغ");
      else if (seenSerials.has(serial.toLowerCase())) {
        lineErrors.push(langue === "fr" ? `Série « ${serial} » répétée dans le fichier` : `الرقم التسلسلي « ${serial} » مكرر في الملف`);
      } else seenSerials.add(serial.toLowerCase());

      const typeCode = resolve(typeOptions, rawType);
      if (!typeCode) lineErrors.push(langue === "fr" ? `Type « ${rawType} » inconnu` : `النوع « ${rawType} » غير معروف`);

      const etatCode = resolve(etatOptions, rawEtat);
      if (!etatCode) lineErrors.push(langue === "fr" ? `État « ${rawEtat} » inconnu` : `الحالة « ${rawEtat} » غير معروفة`);

      const serviceCode = resolve(serviceOptions, rawService);
      if (!serviceCode) lineErrors.push(langue === "fr" ? `Service « ${rawService} » inconnu` : `المصلحة « ${rawService} » غير معروفة`);

      if (lineErrors.length > 0) {
        problems.push(`Ligne ${line} : ${lineErrors.join(" | ")}`);
        continue;
      }

      try {
        await api.post("/api/Equipment", {
          serial,
          type: typeCode,
          etat: etatCode,
          service: serviceCode,
          additionalInfo: cellOf(row, "additionalInfo").trim() || null,
        }, token);
        imported++;
      } catch (err) {
        problems.push(`Ligne ${line} : ${getErrorMessage(err)}`);
      }
    }

    setBusy(false);
    setErrors(problems);
    setSummary(cur.importTermine(imported, problems.length));
    if (imported > 0) onImported();
    if (problems.length === 0) onClose();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-sm text-slate-800">{cur.importerExcel}</h3>
        <div className="flex gap-2">
          <button type="button" data-testid="equip-template" onClick={downloadTemplate}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
            {cur.telechargerModele}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
            {cur.fermer}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" data-testid="equip-import-file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); }} />
        <button type="button" data-testid="equip-import-choose" onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition">
          {langue === "fr" ? "Choisir un fichier" : "اختيار ملف"}
        </button>
        <span data-testid="equip-import-name" className="text-xs text-slate-500 font-mono">{fileName || "—"}</span>
      </div>

      {grid.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="equip-header-row" className="text-xs font-bold text-slate-700">
              {cur.ligneEnTete}
            </label>
            <input id="equip-header-row" data-testid="equip-header-row" type="number" min={1}
              max={grid.length} value={headerRow}
              onChange={(e) => setHeaderRow(Math.max(1, Math.min(grid.length, parseInt(e.target.value, 10) || 1)))}
              className="w-20 border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-blue-500" />
            <span className="text-xs text-slate-500">
              {dataRows.length} {langue === "fr" ? "ligne(s) à importer" : "سطراً للاستيراد"}
            </span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">{cur.associerColonnes}</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {TARGETS.map((target) => (
                <div key={target}>
                  <label htmlFor={`equip-map-${target}`} className="block text-[11px] font-bold text-slate-600 mb-1">
                    {target === "serial" ? cur.colonneSerie
                      : target === "additionalInfo" ? cur.colonneInfos
                      : target === "type" ? cur.colonneType
                      : target === "etat" ? cur.colonneEtat
                      : cur.colonneService}
                    {target !== "additionalInfo" && <span className="text-red-500"> *</span>}
                  </label>
                  <select id={`equip-map-${target}`} data-testid={`equip-map-${target}`}
                    value={mapping[target]}
                    onChange={(e) => setMapping({ ...mapping, [target]: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-blue-500 bg-white">
                    <option value="">—</option>
                    {columnOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" data-testid="equip-import-run" onClick={runImport} disabled={busy}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50">
              {cur.importer}
            </button>
          </div>
        </>
      )}

      {summary && (
        <p data-testid="equip-import-summary" className="text-xs font-bold text-emerald-700">{summary}</p>
      )}

      {errors.length > 0 && (
        <div data-testid="equip-import-errors" className="border border-amber-200 bg-amber-50 rounded-lg p-3">
          <h4 className="text-xs font-bold text-amber-800 mb-1">{cur.erreursImport}</h4>
          <ul className="text-[11px] text-amber-800 space-y-0.5 max-h-40 overflow-y-auto">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
