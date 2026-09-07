"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback } from "react";
import { Langue, UserItem, RbacService } from "@/app/types";
import { ExportFormat } from "@/lib/exportImport";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { api, ApiError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
  onExport?: (format: ExportFormat) => void;
}

export function GestionUtilisateurs({ langue, cur, token, onExport }: Props) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rbacServices, setRbacServices] = useState<RbacService[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterService, setFilterService] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nom: "", login: "", password: "", serviceId: 0 });
  const [showArchived, setShowArchived] = useState(false);
  const [archivedUsers, setArchivedUsers] = useState<UserItem[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setUsers(await api.get<UserItem[]>("/api/Users", token));
    } catch (err) { console.error("Erreur fetch users:", err); }
  }, [token]);

  const fetchServices = useCallback(async () => {
    try {
      setRbacServices(await api.get<RbacService[]>("/api/rbac/services", token));
    } catch (err) { console.error("Erreur fetch services:", err); }
  }, [token]);

  const fetchArchivedUsers = async () => {
    setLoadingArchived(true);
    try {
      const data = await api.get<(UserItem & { isActive?: boolean })[]>("/api/Users?includeInactive=true", token);
      setArchivedUsers(data.filter((u) => u.isActive === false));
    } catch (err) {
      console.error("Erreur lors du chargement des utilisateurs archivés", err);
    } finally {
      setLoadingArchived(false);
    }
  };

  useEffect(() => { fetchUsers(); fetchServices(); }, [fetchUsers, fetchServices]);

  const filtered = users.filter(u => {
    const matchSearch = !searchTerm || u.nom.toLowerCase().includes(searchTerm.toLowerCase()) || u.login.toLowerCase().includes(searchTerm.toLowerCase());
    const matchService = !filterService || u.serviceId?.toString() === filterService;
    return matchSearch && matchService;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const svc = rbacServices.find(s => s.id === form.serviceId);
      const body = {
        nom: form.nom,
        login: form.login,
        serviceId: form.serviceId,
        service: svc?.code || "",
        ...(form.password ? { password: form.password } : {}),
      };

      if (editingId) {
        await api.put(`/api/Users/${editingId}`, body, token);
      } else {
        await api.post("/api/Users", body, token);
      }

      alert(editingId ? (langue === "fr" ? "Utilisateur modifié" : "تم تعديل المستخدم") : (langue === "fr" ? "Utilisateur créé" : "تم إنشاء المستخدم"));
      setShowForm(false);
      setEditingId(null);
      setForm({ nom: "", login: "", password: "", serviceId: 0 });
      fetchUsers();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        alert(langue === "fr" ? "Accès refusé. Votre session a peut-être expiré. Reconnectez-vous." : "تم رفض الوصول. ربما انتهت جلسته. أعد تسجيل الدخول.");
      } else {
        alert(getErrorMessage(err) || (langue === "fr" ? "Erreur" : "خطأ"));
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(langue === "fr" ? "Supprimer cet utilisateur ?" : "هل تريد حذف هذا المستخدم؟")) return;
    try {
      await api.delete(`/api/Users/${id}`, token);
      fetchUsers();
    } catch (err) {
      alert(getErrorMessage(err) || (langue === "fr" ? "Erreur" : "خطأ"));
    }
  };

  const handleRestoreUser = async (id: number) => {
    if (!confirm("Restaurer cet utilisateur ?")) return;
    try {
      await api.post(`/api/Users/${id}/restore`, undefined, token);
      alert("Utilisateur restauré avec succès");
      fetchArchivedUsers();
    } catch (err) {
      console.error("Erreur lors de la restauration", err);
    }
  };

  const startEdit = (u: UserItem) => {
    setEditingId(u.id);
    setForm({ nom: u.nom, login: u.login, password: "", serviceId: u.serviceId || 0 });
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder={cur.recherche}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-64 p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50"
          />
          <select
            value={filterService}
            onChange={(e) => setFilterService(e.target.value)}
            className="p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
          >
            <option value="">{cur.tousLesServices}</option>
            {rbacServices.map(svc => (
              <option key={svc.id} value={svc.id}>{svc.nom}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ nom: "", login: "", password: "", serviceId: 0 }); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
          >
            + {cur.ajouter}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-4">
            {editingId ? cur.modifierUtilisateur : cur.ajouterUtilisateur}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{`${cur.nomComplet} *`}</label>
              <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{cur.login} *</label>
              <input type="text" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{`${cur.motDePasse} *`}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingId ? (langue === "fr" ? "Laisser vide pour ne pas changer" : "اتركه فارغاً لعدم التغيير") : ""}
                required={!editingId}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{`${cur.service} *`}</label>
              <select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: parseInt(e.target.value) })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500">
                <option value={0}>{cur.selectionnerService}</option>
                {rbacServices.map(svc => (
                  <option key={svc.id} value={svc.id}>{svc.nom}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4 flex gap-2">
              <button type="submit" className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
                {editingId ? cur.editer : cur.ajouter}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
                {cur.fermer}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-xs">
            {cur.utilisateurs}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {filtered.length} {cur.utilisateurs}
            </span>
            <button
              onClick={() => { setShowArchived(true); fetchArchivedUsers(); }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-xs"
            >
              🗂️ {cur.voirArchives}
            </button>
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
                  <th className="p-3 text-start">{cur.nomComplet}</th>
                  <th className="p-3 text-start">{cur.login}</th>
                  <th className="p-3 text-start">{cur.service}</th>
                  <th className="p-3 text-start">{cur.dateSuppression}</th>
                  <th className="p-3 text-center">{cur.tblActions}</th>
                </tr>
              </thead>
              <tbody>
                {loadingArchived ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">{cur.loadingText}</td></tr>
                ) : archivedUsers.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">{cur.aucunArchive}</td></tr>
                ) : (
                  archivedUsers.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-mono">{u.id}</td>
                      <td className="p-3 font-bold">{u.nom}</td>
                      <td className="p-3 font-mono">{u.login}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                          {u.serviceNom || u.service || "-"}
                        </span>
                      </td>
                      <td className="p-3">{u.deletedAt ? new Date(u.deletedAt).toLocaleDateString() : "-"}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleRestoreUser(u.id)}
                            className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold"
                          >
                            {cur.restaurer}
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
                  <th className="p-3 text-start">{cur.nomComplet}</th>
                  <th className="p-3 text-start">{cur.login}</th>
                  <th className="p-3 text-start">{cur.service}</th>
                  <th className="p-3 text-center">{cur.tblActions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">{cur.aucunDoc}</td></tr>
                ) : (
                  filtered.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-mono">{u.id}</td>
                      <td className="p-3 font-bold">{u.nom}</td>
                      <td className="p-3 font-mono">{u.login}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                          {u.serviceNom || u.service || "-"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button type="button" onClick={() => startEdit(u)}
                            className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold">
                            {cur.editer}
                          </button>
                          <button type="button" onClick={() => handleDelete(u.id)}
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
