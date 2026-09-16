// lib/feedback.ts
//
// Non-blocking replacement for `window.alert()` / `window.confirm()`.
//
// Native dialogs freeze the JS event loop for as long as they are open and
// browsers stop honouring them after a page has opened a few in a row, which is
// why a repeated action (delete / accept / refuse) silently stopped working.
// These helpers push feedback into a React-rendered host instead
// (<FeedbackHost />, mounted once in the root layout).
//
// The store is deliberately module level so it can be called from plain async
// handlers without threading a hook through every component.

export type FeedbackType = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  type: FeedbackType;
}

interface ConfirmRequest {
  id: number;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (accepted: boolean) => void;
}

interface FeedbackState {
  toasts: Toast[];
  confirm: ConfirmRequest | null;
}

const EMPTY_STATE: FeedbackState = { toasts: [], confirm: null };

let state: FeedbackState = EMPTY_STATE;
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: FeedbackState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Identical reference until something changes, so React can bail out cheaply. */
export function getSnapshot(): FeedbackState {
  return state;
}

/** Server render always starts empty — keeps hydration deterministic. */
export function getServerSnapshot(): FeedbackState {
  return EMPTY_STATE;
}

const ERROR_HINTS = /erreur|impossible|invalide|refus|échou|introuvable|déjà|خطأ|تعذّر|تعذر|غير صالح|مرفوض|موجود مسبقا/iu;
const SUCCESS_HINTS = /succès|enregistr|ajout|supprim|restaur|envoy|accept|mis à jour|sauveg|تم |تمّ|بنجاح|مقبول/iu;

/**
 * Guess the severity of a message so the 100+ existing call sites keep their
 * meaning without being rewritten one by one. Callers that know better pass an
 * explicit type.
 */
function inferToastType(message: string): FeedbackType {
  if (ERROR_HINTS.test(message)) return "error";
  if (SUCCESS_HINTS.test(message)) return "success";
  return "info";
}

/** Show a transient message. Never blocks the caller. */
export function notify(message: string, type?: FeedbackType, timeoutMs = 5000): void {
  const text = (message ?? "").toString().trim();
  if (!text) return;
  const toast: Toast = { id: nextId++, message: text, type: type ?? inferToastType(text) };
  publish({ ...state, toasts: [...state.toasts, toast] });
  if (timeoutMs > 0) {
    setTimeout(() => dismissToast(toast.id), timeoutMs);
  }
}

export function dismissToast(id: number): void {
  if (!state.toasts.some((toast) => toast.id === id)) return;
  publish({ ...state, toasts: state.toasts.filter((toast) => toast.id !== id) });
}

/** Current UI language, read from the same key the sidebar writes. */
function currentLangue(): "fr" | "ar" {
  try {
    return localStorage.getItem("langue") === "fr" ? "fr" : "ar";
  } catch {
    return "ar";
  }
}

/** Ask the user to accept an action. Resolves to false when cancelled. */
export function confirmAction(
  message: string,
  options: { confirmLabel?: string; cancelLabel?: string } = {}
): Promise<boolean> {
  // Never stack dialogs: an unanswered one is resolved as cancelled.
  if (state.confirm) state.confirm.resolve(false);

  const french = currentLangue() === "fr";
  return new Promise<boolean>((resolve) => {
    const request: ConfirmRequest = {
      id: nextId++,
      message: String(message ?? ""),
      confirmLabel: options.confirmLabel ?? (french ? "Confirmer" : "تأكيد"),
      cancelLabel: options.cancelLabel ?? (french ? "Annuler" : "إلغاء"),
      resolve,
    };
    publish({ ...state, confirm: request });
  });
}

/** Called by the host when the user answers (or dismisses) the dialog. */
export function resolveConfirm(accepted: boolean): void {
  const request = state.confirm;
  if (!request) return;
  publish({ ...state, confirm: null });
  request.resolve(accepted);
}
