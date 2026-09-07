"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback } from "react";
import { Langue, RbacService } from "@/app/types";
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

export function GestionServices({ langue, cur, token, onExport }: Props) {
  const [services, setServices] = useState<RbacService[]>([]);
  const [archivedServices, setArchivedServices] = useState<RbacService[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nom: "", code: "", description: "" });
  const [showArchived, setShowArchived] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      // Only fetch active services by default
      setServices(await api.get<RbacService[]>("/api/rbac/services", token));
    } catch (err) { console.error("Erreur fetch services:", err); }
  }, [token]);

  const fetchArchivedServices = async () => {
    setLoadingArchived(true);
    try {
      const data = await api.get<(RbacService & { isActive?: boolean })[]>("/api/rbac/services?includeInactive=true", token);
      setArchivedServices(data.filter((s) => s.isActive === false));
    } catch (err) {
      console.error("Erreur lors du chargement des services archivés", err);
    } finally {
      setLoadingArchived(false);
    }
  };

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const filtered = services.filter(s =>
    !searchTerm ||
    s.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/api/rbac/services/${editingId}`, form, token);
      } else {
        await api.post("/api/rbac/services", form, token);
      }

      alert(editingId ? (langue === "fr" ? "Service modifié" : "تم تعديل المصلحة") : (langue === "fr" ? "Service créé" : "تم إنشاء المصلحة"));
      setShowForm(false);
      setEditingId(null);
      setForm({ nom: "", code: "", description: "" });
      fetchServices();
    } catch (err) {
      alert(getErrorMessage(err) || (langue === "fr" ? "Erreur" : "خطأ"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(langue === "fr" ? "Archiver ce service ?" : "هل تريد أرشفة هذه المصلحة؟")) return;
    try {
      await api.delete(`/api/rbac/services/${id}`, token);
      fetchServices();
    } catch (err) {
      alert(getErrorMessage(err) || (langue === "fr" ? "Erreur" : "خطأ"));
    }
  };

  const handleRestore = async (id: number) => {
    if (!confirm(langue === "fr" ? "Restaurer ce service ?" : "هل تريد استعادة هذه المصلحة؟")) return;
    try {
      await api.post(`/api/rbac/services/${id}/restore`, undefined, token);
      alert(langue === "fr" ? "Service restauré" : "تمت استعادة المصلحة");
      fetchArchivedServices();
      fetchServices();
    } catch (err) {
      alert(getErrorMessage(err) || (langue === "fr" ? "Erreur" : "خطأ"));
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (!confirm(langue === "fr" ? "Supprimer définitivement ce service ? Cette action est irréversible." : "هل تريد الحذف نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.")) return;
    try {
      await api.delete(`/api/rbac/services/${id}/permanent`, token);
      alert(langue === "fr" ? "Service supprimé définitivement" : "تم الحذف نهائياً");
      fetchArchivedServices();
    } catch (err) {
      alert(getErrorMessage(err) || (langue === "fr" ? "Erreur" : "خطأ"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder={langue === "fr" ? "Rechercher nom/code/description" : "بحث بالاسم/الكود/الوصف"}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-64 p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50"
          />
          <button type="button" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ nom: "", code: "", description: "" }); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
            + {cur.ajouter}
          </button>
          <button
            onClick={() => { setShowArchived(true); fetchArchivedServices(); }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-xs"
          >
            🗂️ {cur.voirArchives}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-4">
            {editingId ? (langue === "fr" ? "Modifier le service" : "تعديل المصلحة") : (langue === "fr" ? "Ajouter un service" : "إضافة مصلحة")}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{langue === "fr" ? "Nom *" : "الاسم *"}</label>
              <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{langue === "fr" ? "Code *" : "الكود *"}</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required
                placeholder={langue === "fr" ? "ex: bureauordre" : "مثال: bureauordre"}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{langue === "fr" ? "Description" : "الوصف"}</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div className="flex items-end gap-2 md:col-span-3">
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
            {langue === "fr" ? "Services RBAC" : "مصالح RBAC"}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {filtered.length} {langue === "fr" ? "service(s)" : "مصلحة"}
            </span>
            {onExport && (
              <ExportButtons onExcel={() => onExport("export excel")} onWord={() => onExport("export word")} />
            )}
          </div>
        </div>
        {showArchived ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-sky-50 border-b border-sky-200 text-slate-700">
                <tr>
                  <th className="p-3 text-start">ID</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Nom" : "الاسم"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Code" : "الكود"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Description" : "الوصف"}</th>
                  <th className="p-3 text-center">{langue === "fr" ? "Utilisateurs" : "المستخدمون"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Date archivage" : "تاريخ الأرشفة"}</th>
                  <th className="p-3 text-center">{cur.tblActions}</th>
                </tr>
              </thead>
              <tbody>
                {loadingArchived ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">{cur.loadingText}</td></tr>
                ) : archivedServices.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">{cur.aucunArchive}</td></tr>
                ) : (
                  archivedServices.map(s => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-mono">{s.id}</td>
                      <td className="p-3 font-bold">{s.nom}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{s.code}</td>
                      <td className="p-3">{s.description}</td>
                      <td className="p-3 text-center font-medium">{s.userCount}</td>
                      <td className="p-3 text-slate-500">{(s as RbacService & { deletedAt?: string }).deletedAt ? new Date((s as RbacService & { deletedAt?: string }).deletedAt!).toLocaleDateString() : "-"}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button type="button" onClick={() => handleRestore(s.id)}
                            className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            {cur.restaurer}
                          </button>
                          <button type="button" onClick={() => handlePermanentDelete(s.id)}
                            className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-bold">
                            {langue === "fr" ? "Supprimer" : "حذف"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-sky-50 border-b border-sky-200 text-slate-700">
                <tr>
                  <th className="p-3 text-start">ID</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Nom" : "الاسم"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Code" : "الكود"}</th>
                  <th className="p-3 text-start">{langue === "fr" ? "Description" : "الوصف"}</th>
                  <th className="p-3 text-center">{langue === "fr" ? "Utilisateurs" : "المستخدمون"}</th>
                  <th className="p-3 text-center">{cur.tblActions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">{cur.aucunDoc}</td></tr>
                ) : (
                  filtered.map(s => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-mono">{s.id}</td>
                      <td className="p-3 font-bold">{s.nom}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{s.code}</td>
                      <td className="p-3">{s.description}</td>
                      <td className="p-3 text-center font-medium">{s.userCount}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button type="button" onClick={() => { setEditingId(s.id); setForm({ nom: s.nom, code: s.code, description: s.description || "" }); setShowForm(true); }}
                            className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold">
                            {langue === "fr" ? "Modifier" : "تعديل"}
                          </button>
                          <button type="button" onClick={() => handleDelete(s.id)}
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
        )}
      </div>
    </div>
  );
}
