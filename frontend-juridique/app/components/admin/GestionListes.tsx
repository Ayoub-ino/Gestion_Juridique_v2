"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback } from "react";
import { Langue } from "@/app/types";
import { ExportFormat } from "@/lib/exportImport";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
  onExport?: (format: ExportFormat) => void;
}

interface ListItemData {
  id: number;
  listName: string;
  code: string;
  valueFr: string;
  valueAr: string;
  displayOrder: number;
  isActive: boolean;
}

const LIST_CATEGORIES = [
  { key: "types_equipement", fr: "Types d'équipement", ar: "أنواع المعدات" },
  { key: "etats_equipement", fr: "États d'équipement", ar: "حالات المعدات" },
  { key: "types_juridique", fr: "Types judiciaires", ar: "الأنواع القضائية" },
  { key: "types_tribunal", fr: "Types de tribunal", ar: "أنواع المحاكم" },
  { key: "etats_document", fr: "États de document", ar: "حالات الوثيقة" },
  { key: "direction", fr: "Direction", ar: "الاتجاه" },
  { key: "type_correspondance", fr: "Type de correspondance", ar: "نوع المراسلة" },
  { key: "sources_courrier", fr: "Sources de courrier", ar: "مصادر المراسلات" },
  { key: "sources_doc_lie", fr: "Sources de documents liés", ar: "مصادر الوثائق المرتبطة" },
];

export function GestionListes({ langue, cur, token, onExport }: Props) {
  const [items, setItems] = useState<ListItemData[]>([]);
  const [activeCategory, setActiveCategory] = useState("types_equipement");
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", valueFr: "", valueAr: "", displayOrder: 1, isActive: true });

  const fetchItems = useCallback(async () => {
    try {
      setItems(await api.get<ListItemData[]>(`/api/ListItems?listName=${activeCategory}`, token));
    } catch (err) { console.error("Erreur fetch list items:", err); }
  }, [activeCategory, token]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = items.filter(i =>
    !searchTerm || i.valueFr.toLowerCase().includes(searchTerm.toLowerCase()) || i.valueAr.includes(searchTerm) || i.code.includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = { ...form, listName: activeCategory };
      if (editingId) {
        await api.put(`/api/ListItems/${editingId}`, body, token);
      } else {
        await api.post("/api/ListItems", body, token);
      }

      alert(editingId ? (langue === "fr" ? "Élément modifié" : "تم تعديل العنصر") : (langue === "fr" ? "Élément créé" : "تم إنشاء العنصر"));
      setShowForm(false);
      setEditingId(null);
      setForm({ code: "", valueFr: "", valueAr: "", displayOrder: 1, isActive: true });
      fetchItems();
    } catch (err) {
      alert(getErrorMessage(err) || (langue === "fr" ? "Erreur" : "خطأ"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(langue === "fr" ? "Supprimer cet élément ?" : "هل تريد حذف هذا العنصر؟")) return;
    try {
      await api.delete(`/api/ListItems/${id}`, token);
      fetchItems();
    } catch (err) { console.error(err); }
  };

  const toggleActive = async (item: ListItemData) => {
    try {
      await api.put(`/api/ListItems/${item.id}`, { ...item, isActive: !item.isActive }, token);
      fetchItems();
    } catch (err) { console.error(err); }
  };

  const currentCategory = LIST_CATEGORIES.find(c => c.key === activeCategory);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {LIST_CATEGORIES.map(cat => (
            <button key={cat.key} type="button" onClick={() => { setActiveCategory(cat.key); setShowForm(false); setEditingId(null); }}
              className={`px-3 py-2 rounded-lg border text-[11px] font-bold transition ${
                activeCategory === cat.key ? "bg-blue-700 text-white border-blue-700" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}>
              {langue === "fr" ? cat.fr : cat.ar}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <input type="text" placeholder={langue === "fr" ? "Rechercher (document, service)" : "بحث"} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-64 p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50" />
          <button type="button" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ code: "", valueFr: "", valueAr: "", displayOrder: items.length + 1, isActive: true }); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
            + {cur.ajouter}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-4">
            {editingId ? (langue === "fr" ? "Modifier l'élément" : "تعديل العنصر") : (langue === "fr" ? "Ajouter un élément" : "إضافة عنصر")}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{cur.code} *</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{cur.valeurFr} *</label>
              <input type="text" value={form.valueFr} onChange={(e) => setForm({ ...form, valueFr: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{cur.valeurAr} *</label>
              <input type="text" value={form.valueAr} onChange={(e) => setForm({ ...form, valueAr: e.target.value })} required dir="rtl"
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{langue === "fr" ? "Ordre" : "الترتيب"}</label>
              <input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 1 })}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
                {editingId ? (langue === "fr" ? "Modifier" : "تعديل") : cur.ajouter}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
                {cur.fermer}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-xs">
            {currentCategory ? (langue === "fr" ? currentCategory.fr : currentCategory.ar) : ""}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {filtered.length} {langue === "fr" ? "éléments" : "عناصر"}
            </span>
            {onExport && (
              <ExportButtons onExcel={() => onExport("export excel")} onWord={() => onExport("export word")} />
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-sky-50 border-b border-sky-200 text-slate-700">
              <tr>
                <th className="p-3 text-start">{cur.code}</th>
                <th className="p-3 text-start">{cur.valeurFr}</th>
                <th className="p-3 text-start">{cur.valeurAr}</th>
                <th className="p-3 text-start">{langue === "fr" ? "Ordre" : "الترتيب"}</th>
                <th className="p-3 text-start">{cur.actif}</th>
                <th className="p-3 text-center">{cur.tblActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">{cur.aucunDoc}</td></tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono">{item.code}</td>
                    <td className="p-3">{item.valueFr}</td>
                    <td className="p-3" dir="rtl">{item.valueAr}</td>
                    <td className="p-3">{item.displayOrder}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {item.isActive ? cur.oui : cur.non}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center gap-1">
                        <button type="button" onClick={() => toggleActive(item)}
                          className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {langue === "fr" ? "Activer/Désactiver" : "تفعيل/تعطيل"}
                        </button>
                        <button type="button" onClick={() => { setEditingId(item.id); setForm({ code: item.code, valueFr: item.valueFr, valueAr: item.valueAr, displayOrder: item.displayOrder, isActive: item.isActive }); setShowForm(true); }}
                          className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {langue === "fr" ? "Modifier" : "تعديل"}
                        </button>
                        <button type="button" onClick={() => handleDelete(item.id)}
                          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-bold">
                          {cur.btnSupprimer}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
