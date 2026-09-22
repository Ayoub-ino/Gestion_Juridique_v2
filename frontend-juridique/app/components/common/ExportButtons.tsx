"use client";

import { useAuth } from "@/context/AuthContext";

/**
 * Shared export buttons. Each button only renders when the matching
 * permission (export_excel / export_word) is enabled for the current user,
 * so disabled permissions hide the feature instead of only failing at click.
 *
 * A screen that is already gated on a permission of its own can name it here,
 * so its export follows the screen it belongs to rather than the global export
 * permissions — e.g. the equipment register, whose export is part of managing
 * the register and is governed by the same permission that opens the screen.
 */
export function ExportButtons({
  onExcel,
  onWord,
  excelLabel = "export excel",
  wordLabel = "export word",
  permissionKeys,
}: {
  onExcel: () => void;
  onWord: () => void;
  excelLabel?: string;
  wordLabel?: string;
  permissionKeys?: { excel?: string; word?: string };
}) {
  const { hasPermission } = useAuth();
  const canExcel = hasPermission(permissionKeys?.excel ?? "export_excel");
  const canWord = hasPermission(permissionKeys?.word ?? "export_word");

  if (!canExcel && !canWord) return null;

  return (
    <div className="flex gap-1">
      {canExcel && (
        <button
          type="button"
          data-testid="export-excel"
          onClick={onExcel}
          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 hover:bg-emerald-100"
        >
          {excelLabel}
        </button>
      )}
      {canWord && (
        <button
          type="button"
          data-testid="export-word"
          onClick={onWord}
          className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 hover:bg-blue-100"
        >
          {wordLabel}
        </button>
      )}
    </div>
  );
}
