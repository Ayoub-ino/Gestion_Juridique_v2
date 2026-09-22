"use client";

import type { TranslationKeys } from "@/lib/translations";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Langue, EquipmentItem } from "@/app/types";
import { useServiceLabels } from "@/app/hooks/useServiceLabels";
import { useListItems } from "@/app/hooks/useListItems";
import { ExportFormat, exportRows } from "@/lib/exportImport";
import { ExportButtons } from "@/app/components/common/ExportButtons";
import { GestionListes } from "@/app/components/admin/GestionListes";
import { EquipmentImport, type Option } from "@/app/components/admin/EquipmentImport";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/utils";
import { confirmAction, notify } from "@/lib/feedback";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
}

/** Managed lists backing the register's two coded fields. */
const TYPE_LIST = "types_equipement";
const ETAT_LIST = "etats_equipement";

/**
 * The two lists this screen embeds. They are the register's own configuration —
 * you cannot enter an item without them — so they are edited here, next to the
 * data they describe, rather than on a separate administration page.
 */
const EQUIPMENT_LISTS = [
  { key: TYPE_LIST, fr: "Types d'équipement", ar: "أنواع المعدات" },
  { key: ETAT_LIST, fr: "États d'équipement", ar: "حالات المعدات" },
];

const emptyForm = { serial: "", type: "", etat: "", service: "", additionalInfo: "" };

export function GestionEquipements({ langue, cur, token }: Props) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterEtat, setFilterEtat] = useState("");
  const [onlyDischarged, setOnlyDischarged] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLists, setShowLists] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchItems = useCallback(async () => {
    try {
      setItems(await api.get<EquipmentItem[]>("/api/Equipment", token));
    } catch (err) { console.warn("Erreur fetch equipment:", err); }
  }, [token]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const { items: listItems, reload: reloadLists } = useListItems(token);
  const { getServiceLabel, rbacMap } = useServiceLabels(token, langue);

  /**
   * Type/État choices. Both lists number their rows "1", "2", … so a lookup by
   * code alone would be ambiguous — every resolution here is scoped to its list.
   */
  const optionsFor = useCallback((listName: string): Option[] =>
    listItems
      .filter(i => i.listName === listName)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(i => ({ value: i.code, label: langue === "fr" ? i.valueFr : i.valueAr })),
    [listItems, langue]);

  /** Falls back to the raw stored code so records predating a list change still read. */
  const labelFor = useCallback((listName: string, code: string): string => {
    const item = listItems.find(i => i.listName === listName && i.code === code);
    if (!item) return code;
    return langue === "fr" ? item.valueFr : item.valueAr;
  }, [listItems, langue]);

  const typeOptions = useMemo(() => optionsFor(TYPE_LIST), [optionsFor]);
  const etatOptions = useMemo(() => optionsFor(ETAT_LIST), [optionsFor]);

  /** Live service catalogue — never a hardcoded list. */
  const serviceOptions = useMemo<Option[]>(() =>
    Object.entries(rbacMap)
      .map(([code, labels]) => ({ value: code, label: langue === "fr" ? labels.fr : labels.ar }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [rbacMap, langue]);

  /**
   * A select can only show a value it has an option for. Records carried over
   * from before Type/État became lists (or pointing at a since-deactivated
   * entry) keep their value visible instead of silently blanking on edit.
   */
  const withCurrent = (options: Option[], current: string): Option[] =>
    current && !options.some(o => o.value === current)
      ? [{ value: current, label: current }, ...options]
      : options;

  const filtered = items.filter(i => {
    const haystack = [
      i.serial,
      i.additionalInfo ?? "",
      labelFor(TYPE_LIST, i.type),
      labelFor(ETAT_LIST, i.etat),
      getServiceLabel(i.service),
    ].join(" ").toLowerCase();
    const matchSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
    const matchType = !filterType || i.type === filterType;
    const matchEtat = !filterEtat || i.etat === filterEtat;
    const matchCharge = !onlyDischarged || !i.estCharge;
    return matchSearch && matchType && matchEtat && matchCharge;
  });

  const resetFilters = () => {
    setSearchTerm("");
    setFilterType("");
    setFilterEtat("");
    setOnlyDischarged(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serial.trim() || !form.type || !form.etat || !form.service) {
      notify(cur.erreurPrefix + cur.erreur);
      return;
    }
    try {
      const body = {
        serial: form.serial.trim(),
        type: form.type,
        etat: form.etat,
        service: form.service,
        additionalInfo: form.additionalInfo.trim() || null,
      };
      if (editingId) {
        await api.put(`/api/Equipment/${editingId}`, body, token);
      } else {
        await api.post("/api/Equipment", body, token);
      }

      notify(editingId ? cur.equipementModifie : cur.equipementCree);
      closeForm();
      fetchItems();
    } catch (err) {
      notify(cur.erreurPrefix + getErrorMessage(err));
    }
  };

  const handleDelete = async (id: number) => {
    if (!await confirmAction(cur.supprimerEquipement)) return;
    try {
      await api.delete(`/api/Equipment/${id}`, token);
      fetchItems();
    } catch (err) { notify(cur.erreurPrefix + getErrorMessage(err)); }
  };

  /** Charger / décharger — the register's only state transition. */
  const setCharge = async (id: number, charge: boolean) => {
    try {
      // An explicit `{}` body: the discharge endpoint accepts an optional date,
      // and an empty body would be rejected before it could default to now.
      await api.post(`/api/Equipment/${id}/${charge ? "charger" : "decharger"}`, {}, token);
      notify(charge ? cur.equipementCharge : cur.equipementDecharge);
      fetchItems();
    } catch (err) { notify(cur.erreurPrefix + getErrorMessage(err)); }
  };

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleString(langue === "fr" ? "fr-FR" : "ar-MA") : "—";

  /**
   * Export resolves the coded fields to their labels, so the sheet reads the way
   * the screen does — a bare "1" or "bureauordre" means nothing outside the app.
   * It exports what the filters currently select, so clearing them exports all.
   */
  const handleExport = async (format: ExportFormat) => {
    if (filtered.length === 0) {
      notify(cur.aucuneDonneeExport);
      return;
    }
    const rows = filtered.map((item) => ({
      [cur.serie]: item.serial,
      [cur.informationsSupplementaires]: item.additionalInfo ?? "",
      [cur.tblType]: labelFor(TYPE_LIST, item.type),
      [cur.etat]: labelFor(ETAT_LIST, item.etat),
      [cur.service]: getServiceLabel(item.service),
      [cur.charge]: item.estCharge ? cur.charge : cur.decharge,
      [cur.dateDecharge]: formatDate(item.dateDechargement),
    }));
    if (!await exportRows(rows, "equipements", format, cur.equipements)) {
      notify(cur.aucuneDonneeExport);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <input type="text" placeholder={cur.recherche}
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-64 p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white">
            <option value="">{cur.tousLesTypes}</option>
            {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterEtat} onChange={(e) => setFilterEtat(e.target.value)}
            className="p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white">
            <option value="">{cur.tousEtats}</option>
            {etatOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={onlyDischarged} onChange={(e) => setOnlyDischarged(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600" />
            {cur.uniquementDecharges}
          </label>
          <button type="button" onClick={resetFilters}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
            {cur.reinitialiser}
          </button>
          <button type="button" data-testid="equip-import-toggle"
            onClick={() => { setShowImport(!showImport); setShowLists(false); }}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
            {cur.importerExcel}
          </button>
          <button type="button" data-testid="equip-lists-toggle"
            onClick={() => { setShowLists(!showLists); setShowImport(false); }}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
            {cur.gererLesListes}
          </button>
          <button type="button" data-testid="equip-add" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
            + {cur.ajouter}
          </button>
        </div>
      </div>

      {showImport && (
        <EquipmentImport
          langue={langue}
          cur={cur}
          token={token}
          typeOptions={typeOptions}
          etatOptions={etatOptions}
          serviceOptions={serviceOptions}
          onImported={fetchItems}
          onClose={() => setShowImport(false)}
        />
      )}

      {showLists && (
        <div data-testid="equip-lists-panel" className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800">{cur.gererLesListes}</h3>
          </div>
          <GestionListes
            langue={langue}
            cur={cur}
            token={token}
            categories={EQUIPMENT_LISTS}
            onListsChanged={reloadLists}
          />
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-4">
            {editingId ? cur.editer : cur.ajouter}
          </h3>
          <form data-testid="equip-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label htmlFor="equip-serial" className="block text-xs font-bold text-slate-700 mb-1">{cur.serie} *</label>
              <input id="equip-serial" data-testid="equip-serial" type="text" value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="equip-additional-info" className="block text-xs font-bold text-slate-700 mb-1">{cur.informationsSupplementaires}</label>
              <input id="equip-additional-info" data-testid="equip-additional-info" type="text" value={form.additionalInfo} onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })}
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="equip-type" className="block text-xs font-bold text-slate-700 mb-1">{`${cur.tblType} *`}</label>
              <select id="equip-type" data-testid="equip-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white">
                <option value="">{cur.tblType}</option>
                {withCurrent(typeOptions, form.type).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="equip-etat" className="block text-xs font-bold text-slate-700 mb-1">{`${cur.etat} *`}</label>
              <select id="equip-etat" data-testid="equip-etat" value={form.etat} onChange={(e) => setForm({ ...form, etat: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white">
                <option value="">{cur.etat}</option>
                {withCurrent(etatOptions, form.etat).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="equip-service" className="block text-xs font-bold text-slate-700 mb-1">{`${cur.service} *`}</label>
              <select id="equip-service" data-testid="equip-service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} required
                className="w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white">
                <option value="">{cur.choisirService}</option>
                {withCurrent(serviceOptions, form.service).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-5 flex gap-2">
              <button type="submit" data-testid="equip-submit" className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
                {editingId ? cur.editer : cur.ajouter}
              </button>
              <button type="button" onClick={closeForm}
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
            {cur.equipements}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {filtered.length} {cur.equipements}
            </span>
            {/*
              * Gated on the permission that opens this register, not on the global
              * export permissions: exporting the stock list is part of managing it.
              */}
            <ExportButtons
              onExcel={() => handleExport("export excel")}
              onWord={() => handleExport("export word")}
              permissionKeys={{ excel: "gerer_equipements", word: "gerer_equipements" }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-sky-50 border-b border-sky-200 text-slate-700">
              <tr>
                <th className="p-3 text-start">ID</th>
                <th className="p-3 text-start">{cur.serie}</th>
                <th className="p-3 text-start">{cur.informationsSupplementaires}</th>
                <th className="p-3 text-start">{cur.tblType}</th>
                <th className="p-3 text-start">{cur.etat}</th>
                <th className="p-3 text-start">{cur.service}</th>
                <th className="p-3 text-center">{cur.charge}</th>
                <th className="p-3 text-start">{cur.dateDecharge}</th>

                <th className="p-3 text-center">{cur.tblActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400 font-bold">{cur.aucunDoc}</td></tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono">{item.id}</td>
                    <td className="p-3 font-mono">{item.serial}</td>
                    <td className="p-3">{item.additionalInfo || "—"}</td>
                    <td className="p-3">{labelFor(TYPE_LIST, item.type)}</td>
                    <td className="p-3">{labelFor(ETAT_LIST, item.etat)}</td>
                    <td className="p-3">{getServiceLabel(item.service)}</td>
                    <td className="p-3 text-center">
                      <span data-testid="equip-charge-badge" className={`px-2 py-1 rounded text-[10px] font-bold ${item.estCharge ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.estCharge ? cur.charge : cur.decharge}
                      </span>
                    </td>
                    <td className="p-3">{formatDate(item.dateDechargement)}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-1">
                        <button type="button" data-testid="equip-edit" onClick={() => { setEditingId(item.id); setForm({ serial: item.serial, type: item.type, etat: item.etat, service: item.service, additionalInfo: item.additionalInfo || "" }); setShowForm(true); }}
                          className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {cur.editer}
                        </button>
                        {item.estCharge ? (
                          <button type="button" data-testid="equip-decharger" onClick={() => setCharge(item.id, false)}
                            className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold">
                            {cur.decharger}
                          </button>
                        ) : (
                          <button type="button" data-testid="equip-charger" onClick={() => setCharge(item.id, true)}
                            className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            {cur.charger}
                          </button>
                        )}
                        <button type="button" data-testid="equip-delete" onClick={() => handleDelete(item.id)}
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
