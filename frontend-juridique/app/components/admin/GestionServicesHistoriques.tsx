"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback } from "react";
import { Langue } from "@/app/types";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/utils";

interface HistoricalService {
  id: number;
  nom: string;
  code: string;
  description: string;
  parentId: number | null;
  parentNom: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
}

export function GestionServicesHistoriques({ langue, cur, token }: Props) {
  const [services, setServices] = useState<HistoricalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    nom: "",
    code: "",
    description: "",
    parentId: "",
    sortOrder: 0,
    isActive: true,
  });

  const fetchServices = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setServices(await api.get<HistoricalService[]>("/api/historical-services", token));
    } catch (err) {
      console.error("Error fetching historical services:", err);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const filtered = services.filter(s =>
    s.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const body = {
      nom: form.nom,
      code: form.code,
      description: form.description,
      parentId: form.parentId ? parseInt(form.parentId) : null,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await api.put(`/api/historical-services/${editingId}`, body, token);
      } else {
        await api.post("/api/historical-services", body, token);
      }
      alert(editingId
        ? cur.serviceHistoriqueModifie
        : cur.serviceHistoriqueCree);
      setShowForm(false);
      setEditingId(null);
      setForm({ nom: "", code: "", description: "", parentId: "", sortOrder: 0, isActive: true });
      fetchServices();
    } catch (err) {
      alert(getErrorMessage(err) || "Erreur");
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    if (!confirm(cur.confirmerSuppression)) return;

    try {
      await api.delete(`/api/historical-services/${id}`, token);
      fetchServices();
    } catch (err) {
      alert(getErrorMessage(err) || "Erreur");
    }
  };

  const handleEdit = (s: HistoricalService) => {
    setEditingId(s.id);
    setForm({
      nom: s.nom,
      code: s.code,
      description: s.description || "",
      parentId: s.parentId?.toString() || "",
      sortOrder: s.sortOrder,
      isActive: s.isActive,
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm({ nom: "", code: "", description: "", parentId: "", sortOrder: 0, isActive: true });
    setShowForm(true);
  };

  const rootServices = services.filter(s => !s.parentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h3 className="font-bold text-base text-slate-800 mb-1">
              {cur.gestionServicesHistoriques}
            </h3>
            <p className="text-xs text-slate-500">{cur.serviceHistorique}</p>
          </div>
          <button type="button" onClick={handleNew}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
            + {cur.nouveauServiceHistorique}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <input
          type="text"
          placeholder={cur.recherche}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50"
        />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-4">
            {editingId
              ? cur.modifierServiceHistorique
              : cur.nouveauServiceHistorique}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{`${cur.nomService} *`}</label>
              <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{`${cur.codeService} *`}</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required
                placeholder={langue === "fr" ? "ex: recherche" : "مثال: recherche"}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">{cur.descriptionService}</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{cur.serviceParent}</label>
              <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white">
                <option value="">{cur.aucunServiceParent}</option>
                {rootServices.map(s => (
                  <option key={s.id} value={s.id.toString()}>{s.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{cur.ordreAffichage}</label>
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300" />
              <label className="text-xs text-slate-700">{cur.actif}</label>
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button type="submit" className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
                {editingId ? cur.modifierServiceHistorique : cur.ajouter}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm({ nom: "", code: "", description: "", parentId: "", sortOrder: 0, isActive: true }); }}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
                {cur.annuler}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-xs">
            {cur.servicesHistoriques} ({filtered.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-sky-50 border-b border-sky-200 text-slate-700">
              <tr>
                <th className="p-3 text-start">ID</th>
                <th className="p-3 text-start">{cur.nomService}</th>
                <th className="p-3 text-start">{cur.codeService}</th>
                <th className="p-3 text-start">{cur.descriptionService}</th>
                <th className="p-3 text-start">{cur.categorieService}</th>
                <th className="p-3 text-start">{cur.ordreAffichage}</th>
                <th className="p-3 text-center">{cur.actif}</th>
                <th className="p-3 text-center">{cur.tblActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    {cur.servicesHistoriquesVides}
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono">{s.id}</td>
                    <td className="p-3 font-bold">{s.nom}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{s.code}</td>
                    <td className="p-3 text-slate-600 max-w-xs truncate">{s.description || "-"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.parentId ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {s.parentId ? (langue === "fr" ? "Sous-service" : "خدمة فرعية") : (langue === "fr" ? "Racine" : "جذر")}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono">{s.sortOrder}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-slate-300"}`}>
                        {s.isActive ? (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => handleEdit(s)}
                          className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {cur.modifierServiceHistorique}
                        </button>
                        <button type="button" onClick={() => handleDelete(s.id)}
                          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-bold">
                          {cur.supprimerServiceHistorique}
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