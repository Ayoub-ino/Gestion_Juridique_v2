import * as XLSX from "xlsx";
import mammoth from "mammoth";

export type ExportFormat = "export excel" | "export word";

export interface ExportRow {
  [key: string]: string | number | boolean | undefined;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 500);
}

function downloadBuffer(buffer: ArrayBuffer, name: string, mime: string) {
  const blob = new Blob([buffer], { type: mime });
  downloadBlob(blob, name);
}

function getNowFR(): string {
  return new Date().toLocaleDateString("fr-FR") + " " + new Date().toLocaleTimeString("fr-FR");
}

export function exportRows(rows: ExportRow[], filename: string, format: ExportFormat, label?: string): boolean {
  if (rows.length === 0) {
    return false;
  }
  const headers = Object.keys(rows[0]);

  switch (format) {
    case "export excel":
      exportExcel(rows, headers, filename, label);
      break;
    case "export word":
      exportWord(rows, headers, filename, label);
      break;
  }
  return true;
}

function buildHeaderLines(label?: string): string[] {
  const lines = [
    "ROYAUME DU MAROC",
    "Cour d'Appel Administrative de Fes",
  ];
  if (label) {
    lines.push(label);
  }
  return lines;
}

function exportExcel(rows: ExportRow[], headers: string[], filename: string, label?: string) {
  try {
    const dateStr = getNowFR();
    const hdr = buildHeaderLines(label);

    const wsData: (string | number)[][] = [
      ...hdr.map((h) => [h]),
      [],
      [`Date : ${dateStr}   |   Enregistrements : ${rows.length}`],
      [],
      headers,
      ...rows.map((row) => headers.map((h) => String(row[h] ?? ""))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = headers.map(() => ({ wch: 24 }));

    const numCols = headers.length;
    ws["!merges"] = hdr.map((_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: numCols - 1 } }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donnees");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const name = filename.endsWith(".xlsx") ? filename : filename + ".xlsx";
    downloadBuffer(wbout, name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  } catch (err) {
    console.error("Excel export error:", err);
    throw err;
  }
}

function exportWord(rows: ExportRow[], headers: string[], filename: string, label?: string) {
  try {
    const dateStr = getNowFR();
    const hdr = buildHeaderLines(label);

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8">
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 11px; margin: 25px 30px; color: #000; }
      .header { margin-bottom: 18px; }
      .header p { margin: 1px 0; }
      .h1 { font-size: 13px; }
      .h2 { font-size: 11px; }
      .meta { font-size: 9px; color: #555; margin: 10px 0 14px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #bbb; padding: 4px 7px; text-align: left; font-size: 10px; }
      th { background: #f2f2f2; font-weight: bold; }
    </style></head><body>

    <div class="header">
      <p class="h1">${hdr[0]}</p>
      <p class="h1">${hdr[1]}</p>
      ${hdr[2] ? `<p class="h2">${hdr[2]}</p>` : ""}
    </div>

    <p class="meta">Date : ${dateStr} &nbsp;|&nbsp; ${rows.length} enregistrement(s)</p>

    <table><thead><tr>`;
    headers.forEach((h) => (html += `<th>${h}</th>`));
    html += `</tr></thead><tbody>`;
    rows.forEach((row) => {
      html += `<tr>`;
      headers.forEach((h) => (html += `<td>${String(row[h] ?? "").replace(/</g, "&lt;")}</td>`));
      html += `</tr>`;
    });
    html += `</tbody></table></body></html>`;

    const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
    downloadBlob(blob, filename.endsWith(".doc") ? filename : filename + ".doc");
  } catch (err) {
    console.error("Word export error:", err);
    throw err;
  }
}

export function downloadExcelTemplate(langue: "fr" | "ar" = "fr") {
  const dateStr = getNowFR();
  const hdr = buildHeaderLines();
  
  const templateHeaders = langue === "fr"
    ? ["Titre / Objet", "Numéro de référence", "Type", "Date", "Source", "Service actuel", "Statut"]
    : ["العنوان", "المرجع", "النوع", "التاريخ", "المصدر", "المصلحة", "الحالة"];

  const wsData: (string | number)[][] = [
    ...hdr.map((h) => [h]),
    [],
    [`Date : ${dateStr}   |   Enregistrements : 0`],
    [],
    templateHeaders,
    // 10 empty rows for user to fill
    ...Array.from({ length: 10 }, () => templateHeaders.map(() => "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = templateHeaders.map(() => ({ wch: 24 }));

  const numCols = templateHeaders.length;
  ws["!merges"] = hdr.map((_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: numCols - 1 } }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modele");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const name = langue === "fr" ? "Modele_Import_Excel.xlsx" : "نموذج_استيراد_Excel.xlsx";
  downloadBuffer(wbout, name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

export function parseCSV(text: string): ExportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = parseCSVLine(lines[0], sep);

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line, sep);
    const row: ExportRow = {};
    headers.forEach((h, i) => (row[h] = values[i] || ""));
    return row;
  });
}

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export interface ImportResult {
  columns: string[];
  data: ExportRow[];
}

export function importFromFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        resolve({ columns, data: rows });
      };
      reader.onerror = () => reject(new Error());
      reader.readAsText(file, "UTF-8");
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

          // Skip first 6 administrative rows (0-5), read headers from row 6 (7th row)
          const HEADER_ROW_INDEX = 6; // 0-indexed = row 7 in the sheet
          const DATA_START_INDEX = 7; // 0-indexed = row 8 in the sheet

          // Read headers from row 7 (index 6)
          const headers: string[] = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r: HEADER_ROW_INDEX, c })];
            const val = cell ? String(cell.v ?? "").trim() : "";
            if (val) headers.push(val);
          }

          if (headers.length === 0) {
            // Fallback: try to find headers by scanning rows 0-10
            let foundRow = -1;
            for (let r = 0; r <= Math.min(10, range.e.r); r++) {
              for (let c = range.s.c; c <= range.e.c; c++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c })];
                if (cell && cell.v && String(cell.v).trim().length > 1) {
                  foundRow = r;
                  break;
                }
              }
              if (foundRow >= 0) break;
            }
            if (foundRow >= 0) {
              for (let c = range.s.c; c <= range.e.c; c++) {
                const cell = ws[XLSX.utils.encode_cell({ r: foundRow, c })];
                const val = cell ? String(cell.v ?? "").trim() : "";
                if (val) headers.push(val);
              }
            }
          }

          // Read data rows starting from row 8 (index 7)
          const jsonData: ExportRow[] = [];
          for (let r = DATA_START_INDEX; r <= range.e.r; r++) {
            const row: ExportRow = {};
            let hasData = false;
            for (let c = range.s.c; c < range.s.c + headers.length; c++) {
              const cell = ws[XLSX.utils.encode_cell({ r, c })];
              const val = cell ? String(cell.v ?? "").trim() : "";
              if (val) hasData = true;
              row[headers[c - range.s.c]] = val;
            }
            if (hasData) jsonData.push(row);
          }

          resolve({ columns: headers, data: jsonData });
        } catch {
          reject(new Error());
        }
      };
      reader.onerror = () => reject(new Error());
      reader.readAsArrayBuffer(file);
    } else if (ext === "doc" || ext === "docx") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = result.value;
          if (!text.trim()) { resolve({ columns: [], data: [] }); return; }
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          if (lines.length === 0) { resolve({ columns: [], data: [] }); return; }
          const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : lines[0].includes(",") ? "," : null;
          if (sep) {
            const rows = parseCSV(lines.join("\n"));
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            resolve({ columns, data: rows });
          } else {
            const rows = lines.map((line, i) => ({ Ligne: i + 1, Contenu: line.trim() }));
            resolve({ columns: ["Ligne", "Contenu"], data: rows });
          }
        } catch {
          reject(new Error());
        }
      };
      reader.onerror = () => reject(new Error());
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error("UNSUPPORTED_FORMAT"));
    }
  });
}
