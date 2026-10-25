// app/components/admin/GestionChampsCourrier.tsx
//
// « Gestion des champs » — the administrator's control over the three
// « Gérer les courriers » forms.
//
// One sub-tab per courrier type, listing that form's fields as they stand. Each
// change is saved immediately against the same API the forms read, so the field
// set an administrator edits is the field set the agents fill in — no redeploy,
// no separate copy of the truth. Fields can be renamed, reordered, made
// mandatory, hidden, added, and removed.

"use client";

import type { TranslationKeys } from "@/lib/translations";

import { useCallback, useEffect, useState } from "react";
import type { CourrierFieldConfig, Langue } from "@/app/types";
import { api } from "@/lib/api/client";
import { notify } from "@/lib/feedback";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
}

const TYPES = [
  { key: "administratif", fr: "Courrier administratif", ar: "رسالة إدارية" },
  { key: "juridique", fr: "Courrier juridique", ar: "رسالة قضائية" },
  { key: "sortant", fr: "Courrier sortant", ar: "رسالة صادرة" },
] as const;

const FIELD_TYPES = ["text", "number", "date", "textarea", "select", "checkbox", "file"] as const;

const FIELD_TYPE_LABELS: Record<string, { fr: string; ar: string }> = {
  text: { fr: "Texte", ar: "نص" },
  number: { fr: "Nombre", ar: "رقم" },
  date: { fr: "Date", ar: "تاريخ" },
  textarea: { fr: "Texte long", ar: "نص طويل" },
  select: { fr: "Liste", ar: "قائمة" },
  checkbox: { fr: "Case à cocher", ar: "مربع اختيار" },
  file: { fr: "Fichier", ar: "ملف" },
};

export function GestionChampsCourrier({ langue, token }: Props) {
  const [activeType, setActiveType] = useState<string>("administratif");
  const [fields, setFields] = useState<CourrierFieldConfig[]>([]);
  const [busy, setBusy] = useState(false);

  // New-field draft
  const [newLabelFr, setNewLabelFr] = useState("");
  const [newLabelAr, setNewLabelAr] = useState("");
  const [newFieldType, setNewFieldType] = useState<string>("text");
  const [newRequired, setNewRequired] = useState(false);

  const t = (fr: string, ar: string) => (langue === "fr" ? fr : ar);

  const fetchFields = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await api.get<CourrierFieldConfig[]>("/api/CourrierFields", token);
      setFields(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.warn("Chargement des champs impossible:", getErrorMessage(err));
    }
  }, [token]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const visible = fields
    .filter((f) => f.courrierType === activeType)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);

  /** Save one field, replacing it in place so the table reflects the server state. */
  const patchField = async (field: CourrierFieldConfig, changes: Partial<CourrierFieldConfig>) => {
    if (!token) return;
    setBusy(true);
    try {
      const saved = await api.put<CourrierFieldConfig>(
        `/api/CourrierFields/${field.id}`,
        changes,
        token
      );
      setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, ...saved } : f)));
    } catch (err) {
      notify(
        t("Impossible d'enregistrer ce champ : ", "تعذر حفظ هذا الحقل: ") + getErrorMessage(err)
      );
    }
    setBusy(false);
  };

  /** Swap a field with its neighbour — the whole order is sent in one call. */
  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= visible.length) return;

    const reordered = [...visible];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withOrder = reordered.map((f, i) => ({ ...f, displayOrder: i + 1 }));

    // Optimistic: the table reorders at once, then the server confirms.
    setFields((prev) => {
      const byId = new Map(withOrder.map((f) => [f.id, f]));
      return prev.map((f) => byId.get(f.id) ?? f);
    });

    if (!token) return;
    try {
      await api.post(
        "/api/CourrierFields/reorder",
        withOrder.map((f) => ({ id: f.id, displayOrder: f.displayOrder })),
        token
      );
    } catch (err) {
      notify(t("Impossible de réordonner : ", "تعذر إعادة الترتيب: ") + getErrorMessage(err));
      fetchFields();
    }
  };

  const removeField = async (field: CourrierFieldConfig) => {
    if (!token) return;
    const label = langue === "fr" ? field.labelFr : field.labelAr;
    const confirmed = window.confirm(
      t(
        `Supprimer le champ « ${label} » du formulaire ?`,
        `حذف الحقل « ${label} » من الاستمارة؟`
      )
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await api.delete(`/api/CourrierFields/${field.id}`, token);
      notify(t("Champ supprimé", "تم حذف الحقل"));
      fetchFields();
    } catch (err) {
      notify(t("Impossible de supprimer ce champ : ", "تعذر حذف هذا الحقل: ") + getErrorMessage(err));
    }
    setBusy(false);
  };

  const addField = async () => {
    if (!token) return;
    if (!newLabelFr.trim() && !newLabelAr.trim()) {
      notify(t("Veuillez saisir le libellé du champ", "يرجى إدخال تسمية الحقل"));
      return;
    }

    setBusy(true);
    try {
      await api.post(
        "/api/CourrierFields",
        {
          courrierType: activeType,
          labelFr: newLabelFr.trim() || newLabelAr.trim(),
          labelAr: newLabelAr.trim() || newLabelFr.trim(),
          fieldType: newFieldType,
          isRequired: newRequired,
          isActive: true,
        },
        token
      );
      notify(t("Champ ajouté", "تمت إضافة الحقل"));
      setNewLabelFr("");
      setNewLabelAr("");
      setNewFieldType("text");
      setNewRequired(false);
      fetchFields();
    } catch (err) {
      notify(t("Impossible d'ajouter ce champ : ", "تعذر إضافة هذا الحقل: ") + getErrorMessage(err));
    }
    setBusy(false);
  };

  const inputClass =
    "w-full border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-blue-500 bg-white";
  const labelClass = "block text-[11px] font-bold text-slate-500 mb-1";

  return (
    <div className="space-y-5" data-testid="gestion-champs">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <h3 className="font-bold text-sm text-slate-800">
          {t("Champs des formulaires de courrier", "حقول استمارات الرسائل")}
        </h3>
        <p className="text-[11px] text-slate-500 mt-1">
          {t(
            "Ces champs composent les trois onglets de « Gérer les courriers ». Toute modification est appliquée immédiatement aux formulaires des agents ; le « * » indique un champ obligatoire.",
            "تُكوّن هذه الحقول التبويبات الثلاثة لـ«إدارة الرسائل». يُطبَّق كل تغيير فوراً على استمارات الموظفين؛ و«*» تعني حقل إلزامي."
          )}
        </p>
      </div>

      {/* Sous-onglets : un par type de courrier */}
      <div className="flex gap-3 flex-wrap" role="tablist">
        {TYPES.map((type) => (
          <button
            key={type.key}
            type="button"
            role="tab"
            aria-selected={activeType === type.key}
            data-testid={`champs-tab-${type.key}`}
            onClick={() => setActiveType(type.key)}
            className={`px-6 py-3 rounded-lg text-xs font-bold border transition ${
              activeType === type.key
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
            }`}
          >
            {langue === "fr" ? type.fr : type.ar}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-start w-20">{t("Ordre", "الترتيب")}</th>
                <th className="p-3 text-start">{t("Libellé (FR)", "التسمية (فرنسية)")}</th>
                <th className="p-3 text-start">{t("Libellé (AR)", "التسمية (عربية)")}</th>
                <th className="p-3 text-start w-32">{t("Type", "النوع")}</th>
                <th className="p-3 text-center w-24">{t("Obligatoire", "إلزامي")}</th>
                <th className="p-3 text-center w-24">{t("Affiché", "معروض")}</th>
                <th className="p-3 text-center w-24">{t("Action", "إجراء")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                    {t("Aucun champ configuré", "لا يوجد أي حقل")}
                  </td>
                </tr>
              ) : (
                visible.map((field, index) => (
                  <tr
                    key={field.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                    data-testid={`champ-row-${field.fieldKey}`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={t("Monter", "أعلى")}
                          disabled={busy || index === 0}
                          onClick={() => move(index, -1)}
                          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={t("Descendre", "أسفل")}
                          disabled={busy || index === visible.length - 1}
                          onClick={() => move(index, 1)}
                          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        defaultValue={field.labelFr}
                        aria-label={t("Libellé FR", "التسمية الفرنسية")}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value && value !== field.labelFr) patchField(field, { labelFr: value });
                        }}
                        className={inputClass}
                      />
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">{field.fieldKey}</p>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        dir="rtl"
                        defaultValue={field.labelAr}
                        aria-label={t("Libellé AR", "التسمية العربية")}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value && value !== field.labelAr) patchField(field, { labelAr: value });
                        }}
                        className={inputClass}
                      />
                    </td>
                    <td className="p-2">
                      {field.isCustom ? (
                        <select
                          value={field.fieldType}
                          aria-label={t("Type du champ", "نوع الحقل")}
                          onChange={(e) => patchField(field, { fieldType: e.target.value })}
                          className={inputClass}
                        >
                          {FIELD_TYPES.map((ft) => (
                            <option key={ft} value={ft}>
                              {langue === "fr" ? FIELD_TYPE_LABELS[ft].fr : FIELD_TYPE_LABELS[ft].ar}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold">
                          {t("Standard", "قياسي")}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={field.isRequired}
                        aria-label={t("Obligatoire", "إلزامي")}
                        onChange={(e) => patchField(field, { isRequired: e.target.checked })}
                        className="w-4 h-4 text-blue-600"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={field.isActive}
                        aria-label={t("Affiché", "معروض")}
                        onChange={(e) => patchField(field, { isActive: e.target.checked })}
                        className="w-4 h-4 text-blue-600"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeField(field)}
                        className="px-3 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-bold disabled:opacity-40"
                      >
                        {t("Supprimer", "حذف")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ajout d'un champ */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-800">{t("Ajouter un champ", "إضافة حقل")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="new-field-fr" className={labelClass}>
              {t("Libellé (FR)", "التسمية (فرنسية)")}
            </label>
            <input
              id="new-field-fr"
              type="text"
              value={newLabelFr}
              onChange={(e) => setNewLabelFr(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-field-ar" className={labelClass}>
              {t("Libellé (AR)", "التسمية (عربية)")}
            </label>
            <input
              id="new-field-ar"
              type="text"
              dir="rtl"
              value={newLabelAr}
              onChange={(e) => setNewLabelAr(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-field-type" className={labelClass}>
              {t("Type", "النوع")}
            </label>
            <select
              id="new-field-type"
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value)}
              className={inputClass}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {langue === "fr" ? FIELD_TYPE_LABELS[ft].fr : FIELD_TYPE_LABELS[ft].ar}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="new-field-required" className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input
                id="new-field-required"
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              {t("Obligatoire", "إلزامي")}
            </label>
            <button
              type="button"
              data-testid="add-field"
              disabled={busy}
              onClick={addField}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40 transition"
            >
              {t("Ajouter", "إضافة")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
