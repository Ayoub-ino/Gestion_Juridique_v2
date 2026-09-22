"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";

export interface ListItem {
  id: number;
  listName: string;
  code: string;
  valueFr: string;
  valueAr: string;
  displayOrder: number;
  isActive: boolean;
}

export function useListItems(token: string | null, listName?: string) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Bumped by `reload` — lets a screen that edits the lists pull the new values
  // into its own drop-downs without a page refresh.
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const path = listName
      ? `/api/ListItems?listName=${listName}`
      : `/api/ListItems`;
    api.get<ListItem[]>(path, token)
      .then((data) => setItems(data.filter((i) => i.isActive)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token, listName, reloadKey]);

  const getLabel = (code: string, langue: "fr" | "ar") => {
    const item = items.find((i) => i.code === code);
    if (!item) return code;
    return langue === "fr" ? item.valueFr : item.valueAr;
  };

  const getOptions = (filterListName: string, langue: "fr" | "ar") => {
    return items
      .filter((i) => i.listName === filterListName)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((i) => ({
        value: i.code,
        label: langue === "fr" ? i.valueFr : i.valueAr
      }));
  };

  return { items, loading, getLabel, getOptions, reload };
}
