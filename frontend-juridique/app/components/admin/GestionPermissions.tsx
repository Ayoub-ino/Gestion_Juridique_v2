"use client";

import type { TranslationKeys } from "@/lib/translations";
import React from "react";
import { useState, useEffect, useCallback } from "react";
import { Langue, RbacService, ServicePermission } from "@/app/types";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
}

interface MatrixData {
  services: { id: number; nom: string; code: string; permissions: string[] }[];
  allPermissions: { key: string; labelFr: string; labelAr: string; category: string }[];
}

interface AdminPerm {
  permissionKey: string;
  labelFr: string;
  labelAr: string;
  category: string;
  enabled: boolean;
}

export function GestionPermissions({ langue, cur, token }: Props) {
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [services, setServices] = useState<RbacService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [servicePerms, setServicePerms] = useState<ServicePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"matrix" | "edit">("matrix");

  // Admin-specific state
  const [adminPermissions, setAdminPermissions] = useState<AdminPerm[]>([]);
  const [adminEditPerms, setAdminEditPerms] = useState<ServicePermission[]>([]);
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);

  const fetchMatrix = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setMatrix(await api.get<MatrixData>("/api/rbac/permissions/matrix", token));
    } catch (err) {
      console.error("Error fetching matrix:", err);
    }
    setLoading(false);
  }, [token]);

  const fetchServices = useCallback(async () => {
    if (!token) return;
    try {
      setServices(await api.get<RbacService[]>("/api/rbac/services", token));
    } catch (err) {
      console.error("Error fetching services:", err);
    }
  }, [token]);

  const fetchAdminPermissions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<{ permissions: AdminPerm[] }>("/api/rbac/permissions/admin", token);
      setAdminPermissions(data.permissions || []);
    } catch (err) {
      console.error("Error fetching admin permissions:", err);
    }
  }, [token]);

  const fetchServicePermissions = useCallback(async (serviceId: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get<{ permissions: ServicePermission[] }>(`/api/rbac/permissions/service/${serviceId}`, token);
      setServicePerms(data.permissions);
    } catch (err) {
      console.error("Error fetching service permissions:", err);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchMatrix();
    fetchServices();
    fetchAdminPermissions();
  }, [fetchMatrix, fetchServices, fetchAdminPermissions]);

  useEffect(() => {
    if (selectedServiceId && view === "edit" && !isEditingAdmin) {
      fetchServicePermissions(selectedServiceId);
    }
  }, [selectedServiceId, view, isEditingAdmin, fetchServicePermissions]);

  const togglePermission = (key: string) => {
    setServicePerms(prev =>
      prev.map(p => p.key === key ? { ...p, enabled: !p.enabled } : p)
    );
  };

  const toggleAdminPermission = (permissionKey: string) => {
    setAdminEditPerms(prev =>
      prev.map(p => p.key === permissionKey ? { ...p, enabled: !p.enabled } : p)
    );
  };

  const savePermissions = async () => {
    if (!token || !selectedServiceId) return;
    setSaving(true);
    try {
      await api.put(
        `/api/rbac/permissions/service/${selectedServiceId}`,
        { permissions: servicePerms.map(p => ({ permissionKey: p.key, enabled: p.enabled })) },
        token
      );
      alert(langue === "fr" ? "Permissions sauvegardées" : "تم حفظ الصلاحيات");
      setView("matrix");
      setSelectedServiceId(null);
      fetchMatrix();
    } catch (err) {
      alert(getErrorMessage(err) || "Erreur");
    }
    setSaving(false);
  };

  const saveAdminPermissions = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await api.put(
        "/api/rbac/permissions/admin",
        { permissions: adminEditPerms.map(p => ({ permissionKey: p.key, enabled: p.enabled })) },
        token
      );
      alert(langue === "fr" ? "Permissions administrateur sauvegardées" : "تم حفظ صلاحيات المدير");
      setView("matrix");
      setIsEditingAdmin(false);
      setSelectedServiceId(null);
      fetchMatrix();
      fetchAdminPermissions();
    } catch (err) {
      alert(getErrorMessage(err) || "Erreur");
    }
    setSaving(false);
  };

  const handleEditService = (serviceId: number) => {
    setSelectedServiceId(serviceId);
    setIsEditingAdmin(false);
    setView("edit");
  };

  const handleEditAdmin = () => {
    setAdminEditPerms(
      adminPermissions.map(p => ({
        key: p.permissionKey,
        labelFr: p.labelFr,
        labelAr: p.labelAr,
        category: p.category,
        enabled: p.enabled,
      }))
    );
    setIsEditingAdmin(true);
    setSelectedServiceId(null);
    setView("edit");
  };

  const handleBackToMatrix = () => {
    setView("matrix");
    setSelectedServiceId(null);
    setIsEditingAdmin(false);
  };

  // Compute grouped permissions for whichever entity is being edited
  const editPerms = isEditingAdmin ? adminEditPerms : servicePerms;
  const groupedPerms = editPerms.reduce<Record<string, ServicePermission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const categoryLabels: Record<string, { fr: string; ar: string }> = {
    documents: { fr: "Documents", ar: "الوثائق" },
    notifications: { fr: "Notifications", ar: "الإشعارات" },
    juridique: { fr: "Juridique", ar: "قضائي" },
    recherche: { fr: "Recherche & Export", ar: "بحث وتصدير" },
    admin: { fr: "Administration", ar: "الإدارة" },
    autres: { fr: "Autres", ar: "أخرى" },
  };

  if (loading && !matrix) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-slate-500 font-medium">Loading...</div>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-600 font-medium mb-1">
            {langue === "fr" ? "Chargement des permissions" : "جارٍ تحميل الصلاحيات"}
          </p>
          <p className="text-xs text-slate-500">
            {langue === "fr" ? "Veuillez patienter" : "الرجاء الانتظار"}
          </p>
        </div>
      </div>
    );
  }

  // Build all columns: services + admin
  const allColumns = matrix ? [
    ...matrix.services.map(svc => ({
      id: svc.id,
      nom: svc.nom,
      code: svc.code,
      permissions: new Set(svc.permissions),
      isAdmin: false,
    })),
    {
      id: -1,
      nom: langue === "fr" ? "Admin" : "مدير",
      code: "admin",
      permissions: new Set(adminPermissions.filter(p => p.enabled).map(p => p.permissionKey)),
      isAdmin: true,
    },
  ] : [];

  // Group permissions by category for row rendering
  const permissionsByCategory = matrix ? matrix.allPermissions.reduce<Record<string, typeof matrix.allPermissions>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {}) : {};

  const categoryOrder = ["documents", "notifications", "juridique", "recherche", "admin", "autres"];

  return (
    <div className="w-full space-y-4">
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base text-slate-800 mb-1">
              {langue === "fr" ? "Gestion des Permissions" : "إدارة الصلاحيات"}
            </h3>
            <p className="text-xs text-slate-500">
              {langue === "fr"
                ? "Gérez les permissions pour tous les services et l'administrateur"
                : "إدارة الصلاحيات لجميع الخدمات والمدير"}
            </p>
          </div>
          {view === "edit" && (
            <button
              type="button"
              onClick={handleBackToMatrix}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-all"
            >
              {langue === "fr" ? "Retour à la matrice" : "العودة إلى المصفوفة"}
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MATRIX VIEW — Single CSS Grid, perfect alignment
          ═══════════════════════════════════════════ */}
      {view === "matrix" && matrix && (
        <div className="space-y-3">
          {/* Loading overlay */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              {langue === "fr" ? "Chargement..." : "جارٍ التحميل..."}
            </div>
          )}

          {/* Single CSS Grid — header + rows share same column widths */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <div
                className="min-w-fit"
                style={{
                  display: "grid",
                  gridTemplateColumns: `200px repeat(${allColumns.length}, minmax(80px, 1fr))`,
                }}
              >
                {/* ── HEADER ROW ── */}
                {/* Empty corner cell */}
                <div className="px-4 py-3 bg-slate-50 border-b border-r border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-end">
                  {langue === "fr" ? "Permission" : "الصلاحية"}
                </div>
                {/* Service header cells */}
                {allColumns.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => col.isAdmin ? handleEditAdmin() : handleEditService(col.id)}
                    className={`px-2 py-3 border-b border-r border-slate-200 flex flex-col items-center justify-end gap-1 cursor-pointer transition-colors duration-150 ${
                      col.isAdmin
                        ? "bg-amber-50 hover:bg-amber-100"
                        : "bg-slate-50 hover:bg-blue-50"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${col.isAdmin ? "bg-amber-400" : "bg-blue-400"}`} />
                    <span className={`text-[11px] font-bold text-center leading-tight whitespace-normal break-words ${
                      col.isAdmin ? "text-amber-800" : "text-slate-700"
                    }`}>
                      {col.nom}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {Array.from(col.permissions).length}/{matrix.allPermissions.length}
                    </span>
                  </button>
                ))}

                {/* ── DATA ROWS ── */}
                {categoryOrder.map((category, catIdx) => {
                  const perms = permissionsByCategory[category];
                  if (!perms || perms.length === 0) return null;
                  return (
                    <React.Fragment key={category}>
                      {/* Category separator — spans full width */}
                      <div
                        className={`col-span-full px-4 py-2 flex items-center gap-2 ${
                          catIdx % 2 === 0 ? "bg-indigo-50/70" : "bg-emerald-50/70"
                        }`}
                        style={{ gridColumn: `1 / -1` }}
                      >
                        <div className={`w-1.5 h-4 rounded-full flex-shrink-0 ${catIdx % 2 === 0 ? "bg-indigo-400" : "bg-emerald-400"}`} />
                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                          {categoryLabels[category]?.[langue] || category}
                        </span>
                        <span className="text-[9px] text-slate-400 bg-white/60 px-1.5 py-0.5 rounded-full">
                          {perms.length}
                        </span>
                      </div>

                      {/* Permission rows */}
                      {perms.map((p, rowIdx) => (
                        <React.Fragment key={p.key}>
                          {/* Permission label */}
                          <div className={`px-4 py-2.5 border-b border-r border-slate-100 flex items-center gap-2 ${
                            rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          }`}>
                            <span className="text-[11px] text-slate-700 font-medium leading-tight">
                              {langue === "fr" ? p.labelFr : p.labelAr}
                            </span>
                          </div>

                          {/* Checkmark cells */}
                          {allColumns.map(col => {
                            const isEnabled = col.permissions.has(p.key);
                            return (
                              <div
                                key={col.id}
                                className={`px-2 py-2.5 border-b border-r border-slate-100 flex items-center justify-center ${
                                  rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                                } ${col.isAdmin ? "!bg-amber-50/30" : ""}`}
                              >
                                {isEnabled ? (
                                  <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                ) : (
                                  <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Bottom legend */}
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center gap-5 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {langue === "fr" ? "Activée" : "مفعلة"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                  </span>
                  {langue === "fr" ? "Désactivée" : "معطلة"}
                </div>
              </div>
              <span className="text-[10px] text-slate-400">
                {allColumns.length} {langue === "fr" ? "services" : "خدمات"} · {matrix.allPermissions.length} {langue === "fr" ? "permissions" : "صلاحيات"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          EDIT VIEW — Same as before
          ═══════════════════════════════════════════ */}
      {view === "edit" && (
        <div className="space-y-4">
          {/* Service / Admin header */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-800 mb-1">
                  {isEditingAdmin
                    ? langue === "fr" ? "Administrateur" : "مدير"
                    : services.find(s => s.id === selectedServiceId)?.nom || ""}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {langue === "fr"
                    ? "Cochez les permissions à accorder"
                    : "حدد الصلاحيات الممنوحة"}
                </p>
              </div>
              {isEditingAdmin && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                  <span className="text-[10px] text-amber-700 font-medium">
                    {langue === "fr" ? "Mode édition" : "وضع التعديل"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Permission groups */}
          {Object.entries(groupedPerms).map(([category, perms]) => (
            <div key={category} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wide">
                  {categoryLabels[category]?.[langue] || category}
                </h5>
                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  {perms.length} {langue === "fr" ? "permissions" : "صلاحيات"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {perms.map(p => (
                  <label
                    key={p.key}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-xs font-medium cursor-pointer transition-all duration-200 ${
                      p.enabled
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={() =>
                        isEditingAdmin ? toggleAdminPermission(p.key) : togglePermission(p.key)
                      }
                      className="w-4 h-4 rounded border-2 border-current checked:bg-current checked:border-current"
                    />
                    <span className="flex-1 truncate">
                      {langue === "fr" ? p.labelFr : p.labelAr}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleBackToMatrix}
              className="px-5 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-all"
            >
              {cur.fermer}
            </button>
            <button
              type="button"
              onClick={isEditingAdmin ? saveAdminPermissions : savePermissions}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  {langue === "fr" ? "Sauvegarde..." : "جارٍ الحفظ..."}
                </span>
              ) : (langue === "fr" ? "Sauvegarder" : "حفظ")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
