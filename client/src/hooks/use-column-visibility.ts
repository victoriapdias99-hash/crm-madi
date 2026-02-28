import { useState, useCallback } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

export function useColumnVisibility(storageKey: string, columns: ColumnDef[]) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(`col-visibility-${storageKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged: Record<string, boolean> = {};
        columns.forEach((col) => {
          merged[col.key] = parsed[col.key] !== undefined ? parsed[col.key] : (col.defaultVisible !== false);
        });
        return merged;
      }
    } catch {}
    const defaults: Record<string, boolean> = {};
    columns.forEach((col) => {
      defaults[col.key] = col.defaultVisible !== false;
    });
    return defaults;
  });

  const toggleColumn = useCallback((key: string) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(`col-visibility-${storageKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [storageKey]);

  const showAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    columns.forEach((col) => { next[col.key] = true; });
    setVisibility(next);
    try {
      localStorage.setItem(`col-visibility-${storageKey}`, JSON.stringify(next));
    } catch {}
  }, [storageKey, columns]);

  const isVisible = useCallback((key: string): boolean => {
    return visibility[key] !== false;
  }, [visibility]);

  const hiddenCount = Object.values(visibility).filter((v) => !v).length;

  return { isVisible, toggleColumn, showAll, visibility, hiddenCount };
}
