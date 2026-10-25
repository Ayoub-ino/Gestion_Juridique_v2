// app/components/forms/CustomFieldInputs.tsx
//
// Renders the fields the administrator added from « Gestion des champs ».
//
// The three seeded forms keep their own richer widgets; a custom field has only
// its widget hint, so this is deliberately generic — one labelled input per field,
// stored in the folder's JSON bag. It shares the surrounding form's `onSubmit`,
// so validation (`required`) is the browser's plus the API's.

"use client";

import type { CourrierFieldConfig } from "@/app/types";

interface CustomFieldInputsProps {
  fields: CourrierFieldConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  langue: "fr" | "ar";
}

const fieldClass =
  "w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white";
const labelClass = "block text-xs font-bold text-slate-700 mb-2";

export function CustomFieldInputs({ fields, values, onChange, langue }: CustomFieldInputsProps) {
  if (fields.length === 0) return null;

  return (
    <div
      className="bg-white p-6 rounded-xl border border-slate-200 space-y-4"
      data-testid="custom-fields"
    >
      <h3 className="font-bold text-sm text-slate-800">
        {langue === "fr" ? "Champs complémentaires" : "حقول إضافية"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {fields.map((field) => {
          const label = (langue === "fr" ? field.labelFr : field.labelAr) || field.labelFr;
          const value = values[field.fieldKey] ?? "";
          const id = `custom-field-${field.fieldKey}`;

          return (
            <div key={field.id} className={field.fieldType === "textarea" ? "md:col-span-2 xl:col-span-3" : ""}>
              <label htmlFor={id} className={labelClass}>
                {label} {field.isRequired && <span className="text-red-500">*</span>}
              </label>

              {field.fieldType === "textarea" ? (
                <textarea
                  id={id}
                  rows={3}
                  value={value}
                  required={field.isRequired}
                  onChange={(e) => onChange(field.fieldKey, e.target.value)}
                  className={fieldClass}
                />
              ) : field.fieldType === "checkbox" ? (
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    id={id}
                    type="checkbox"
                    checked={value === "true"}
                    onChange={(e) => onChange(field.fieldKey, e.target.checked ? "true" : "false")}
                    className="w-4 h-4 text-blue-600"
                  />
                  {langue === "fr" ? "Oui" : "نعم"}
                </label>
              ) : (
                <input
                  id={id}
                  type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                  value={value}
                  required={field.isRequired}
                  onChange={(e) => onChange(field.fieldKey, e.target.value)}
                  className={fieldClass}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
