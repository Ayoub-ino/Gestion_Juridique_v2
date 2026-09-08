"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { CourrierSimule, Langue } from "@/app/types";
import { api } from "@/lib/api/client";

// Dynamic service type from RBAC API
interface RbacService {
  id: number;
  nom: string;
  code: string;
  description?: string;
  parentId?: number | null;
  parentNom?: string | null;
  isActive: boolean;
  userCount: number;
}

interface TransferModalProps {
  doc: CourrierSimule | null;
  onClose: () => void;
  onConfirm: (selectedServices: string[]) => void;
  selectedServices: string[];
  setSelectedServices: (services: string[]) => void;
  transferMessage: string;
  setTransferMessage: (s: string) => void;
  transferMustReturn: boolean;
  setTransferMustReturn: (b: boolean) => void;
  langue: Langue;
  cur: TranslationKeys;
  setTargetUserId: (id: number | null) => void;
  selectedUserIds: number[];
  setSelectedUserIds: (ids: number[]) => void;
  userService?: string;
}

export function TransferModal({
  doc,
  onClose,
  onConfirm,
  selectedServices,
  setSelectedServices,
  transferMessage,
  setTransferMessage,
  transferMustReturn,
  setTransferMustReturn,
  langue,
  cur,
  setTargetUserId,
  selectedUserIds,
  setSelectedUserIds,
  userService
}: TransferModalProps) {
  // Determine the user's own service to exclude from destination list
  const ownService = userService || doc?.serviceActuelKey || "";
  const { token } = useAuth();
  const [serviceUsers, setServiceUsers] = useState<{ id: number; nom: string }[]>([]);
  const [historicalServices, setHistoricalServices] = useState<{ id: number; code: string; nom: string; isActive?: boolean }[]>([]);
  const [activeServices, setActiveServices] = useState<RbacService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Fetch active services and historical services on mount
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [services, historical] = await Promise.all([
          api.get<RbacService[]>("/api/rbac/services", token),
          api.get<{ id: number; code: string; nom: string; isActive: boolean }[]>(
            "/api/historical-services",
            token
          ).catch(() => []),
        ]);
        // Filter out the user's own service and inactive services
        setActiveServices(services.filter(s => s.code !== ownService && s.isActive && s.userCount > 0));
        setHistoricalServices(historical.filter((s) => s.isActive));
      } catch {
        setActiveServices([]);
        setHistoricalServices([]);
      } finally {
        setLoadingServices(false);
      }
    };
    fetchAll();
  }, [token, ownService]);

  // When selected services change, fetch users for each selected service
  useEffect(() => {
    if (selectedServices.length === 0) {
      setServiceUsers([]);
      setTargetUserId(null);
      return;
    }
    const fetchUsers = async () => {
      try {
        // Fetch users for all selected services in parallel
        const promises = selectedServices.map(async (svc) => {
          try {
            return await api.get<{ id: number; nom: string }[]>(
              `/api/Users/by-service/${encodeURIComponent(svc)}`,
              token
            );
          } catch {
            return [];
          }
        });
        const results = await Promise.all(promises);
        // Merge and deduplicate by user ID
        const allUsers = results.flat();
        const seen = new Set<number>();
        const unique = allUsers.filter((u) => {
          if (seen.has(u.id)) return false;
          seen.add(u.id);
          return true;
        });
        setServiceUsers(unique);
      } catch {
        setServiceUsers([]);
      }
    };
    fetchUsers();
  }, [selectedServices, token, setTargetUserId]);

  const toggleService = (value: string) => {
    setSelectedServices(
      selectedServices.includes(value)
        ? selectedServices.filter((s) => s !== value)
        : [...selectedServices, value]
    );
  };

  if (!doc) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {langue === "fr" ? "Transférer le dossier" : "تحويل الملف"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{doc.reference} - {doc.objet}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          {selectedServices.length > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
              <span className="text-[11px] font-bold text-blue-700">
                {selectedServices.length} {langue === "fr" ? "service(s) sélectionné(s)" : "مصلحة محددة"}
              </span>
              <button
                type="button"
                onClick={() => setSelectedServices([])}
                className="text-[10px] text-blue-500 underline font-bold"
              >
                {langue === "fr" ? "Effacer" : "مسح"}
              </button>
            </div>
          )}

          <div className="space-y-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={activeServices.length > 0 && activeServices.every(s => selectedServices.includes(s.code))}
                ref={(el) => {
                  if (el) el.indeterminate = selectedServices.length > 0 && !activeServices.every(s => selectedServices.includes(s.code));
                }}
                onChange={() => {
                  if (activeServices.every(s => selectedServices.includes(s.code))) {
                    setSelectedServices([]);
                  } else {
                    setSelectedServices(activeServices.map(s => s.code));
                  }
                }}
                className="w-3.5 h-3.5 text-blue-600"
              />
              <p className="text-[11px] font-bold text-slate-500">
                {langue === "fr" ? "Tout sélectionner" : "تحديد الكل"}
              </p>
            </div>
            {loadingServices ? (
              <p className="text-xs text-slate-400 text-center py-4">
                {langue === "fr" ? "Chargement des services..." : "جاري تحميل الخدمات..."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {activeServices.map((svc) => (
                  <label
                    key={svc.code}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold cursor-pointer transition ${
                      selectedServices.includes(svc.code)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(svc.code)}
                      onChange={() => toggleService(svc.code)}
                      className="w-3.5 h-3.5"
                    />
                    <span>{svc.nom}</span>
                    <span className="text-[9px] opacity-60 ml-auto">({svc.userCount})</span>
                  </label>
                ))}
                {activeServices.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2 col-span-2">
                    {langue === "fr" ? "Aucun service disponible" : "لا توجد خدمات متاحة"}
                  </p>
                )}
              </div>
            )}

            {/* Historique services section */}
            {historicalServices.length > 0 && (
              <div className="mt-3 border border-slate-200 rounded-lg p-2 bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-slate-500">
                    {langue === "fr" ? "Services historiques (enregistrement uniquement)" : "الخدمات التاريخية (للتسجيل فقط)"}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 mb-2">
                  {langue === "fr"
                    ? "Ces services n'ont pas d'utilisateurs actifs. Le transfert est automatiquement enregistré."
                    : "هذه الخدمات ليس لها مستخدمون نشطون. يتم تسجيل التحويل تلقائياً."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ps-1">
                  {historicalServices.map((svc) => (
                    <label
                      key={svc.code}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold cursor-pointer transition ${
                        selectedServices.includes(svc.code)
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(svc.code)}
                        onChange={() => toggleService(svc.code)}
                        className="w-3.5 h-3.5"
                      />
                      {svc.nom}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {langue === "fr" ? "Attribuer à des utilisateurs (optionnel)" : "تخصيص لمستخدمين (اختياري)"}
            </label>
            {selectedServices.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg border border-slate-200">
                {langue === "fr" ? "Sélectionner d'abord un service" : "حدد مصلحة أولاً"}
              </p>
            ) : serviceUsers.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg border border-slate-200">
                {langue === "fr" ? "Aucun utilisateur actif dans ce service" : "لا يوجد مستخدمون نشطون في هذه المصلحة"}
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                <label className="flex items-center gap-2 p-2.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.length === serviceUsers.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedUserIds.length > 0 && selectedUserIds.length < serviceUsers.length;
                    }}
                    onChange={() => {
                      if (selectedUserIds.length === serviceUsers.length) {
                        setSelectedUserIds([]);
                        setTargetUserId(null);
                      } else {
                        setSelectedUserIds(serviceUsers.map((u) => u.id));
                        setTargetUserId(serviceUsers[0]?.id ?? null);
                      }
                    }}
                    className="w-3.5 h-3.5 text-blue-600"
                  />
                  <span className="text-[10px] font-bold text-slate-500">
                    {langue === "fr" ? "Sélectionner tous" : "تحديد الكل"}
                  </span>
                </label>
                {serviceUsers.map((u) => (
                  <label
                    key={u.id}
                    className={`flex items-center gap-2 p-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition ${
                      selectedUserIds.includes(u.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => {
                        const next = selectedUserIds.includes(u.id)
                          ? selectedUserIds.filter((id) => id !== u.id)
                          : [...selectedUserIds, u.id];
                        setSelectedUserIds(next);
                        setTargetUserId(next.length > 0 ? next[0] : null);
                      }}
                      className="w-3.5 h-3.5 text-blue-600"
                    />
                    <span className="text-xs font-bold text-slate-700">{u.nom}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedUserIds.length > 0 && (
              <p className="text-[10px] text-blue-600 font-bold mt-1">
                {selectedUserIds.length} {langue === "fr" ? "utilisateur(s) sélectionné(s)" : "مستخدم(ين) محدد(ين)"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">{cur.commentaire}</label>
            <textarea
              rows={3}
              value={transferMessage}
              onChange={(e) => setTransferMessage(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              placeholder={langue === "fr" ? "Message ou remarque..." : "رسالة أو ملاحظة..."}
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={transferMustReturn}
              onChange={(e) => setTransferMustReturn(e.target.checked)}
            />
            {cur.docsRetourner}
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
              {cur.fermer}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selectedServices)}
              disabled={selectedServices.length === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {langue === "fr"
                ? `Transférer (${selectedServices.length})`
                : `تحويل (${selectedServices.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
