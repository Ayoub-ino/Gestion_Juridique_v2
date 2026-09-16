"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  dismissToast,
  getServerSnapshot,
  getSnapshot,
  resolveConfirm,
  subscribe,
  type FeedbackType,
} from "@/lib/feedback";

const TOAST_STYLES: Record<FeedbackType, string> = {
  info: "border-slate-300 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50 dark:border-emerald-700",
  error:
    "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-900/40 dark:text-rose-50 dark:border-rose-700",
};

const TOAST_ICONS: Record<FeedbackType, string> = {
  info: "ℹ️",
  success: "✅",
  error: "⚠️",
};

/**
 * Single mount point for user feedback: transient messages and the
 * confirmation dialog that replaced `window.alert()` / `window.confirm()`.
 */
export function FeedbackHost() {
  const { toasts, confirm } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Escape cancels the pending confirmation, like the native dialog did.
  useEffect(() => {
    if (!confirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") resolveConfirm(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm]);

  return (
    <>
      {/* Toast stack — pointer-events none on the container so it never blocks the UI */}
      <div
        className="fixed top-4 end-4 z-[1000] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            data-testid="toast"
            data-toast-type={toast.type}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg text-xs font-semibold ${TOAST_STYLES[toast.type]}`}
          >
            <span aria-hidden="true">{TOAST_ICONS[toast.type]}</span>
            <span className="flex-1 break-words leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Fermer"
              className="shrink-0 text-base leading-none opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {confirm && (
        <div
          role="presentation"
          className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4"
          onClick={() => resolveConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-message"
            data-testid="confirm-dialog"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:bg-slate-800 dark:border-slate-600"
          >
            <p
              id="confirm-dialog-message"
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-5 whitespace-pre-line"
            >
              {confirm.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="confirm-cancel"
                onClick={() => resolveConfirm(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500"
              >
                {confirm.cancelLabel}
              </button>
              <button
                type="button"
                data-testid="confirm-accept"
                autoFocus
                onClick={() => resolveConfirm(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
