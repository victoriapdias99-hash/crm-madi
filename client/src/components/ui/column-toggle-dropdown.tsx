import { useState, useRef, useEffect } from "react";
import { Columns, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@/hooks/use-column-visibility";

interface ColumnToggleDropdownProps {
  columns: ColumnDef[];
  isVisible: (key: string) => boolean;
  toggleColumn: (key: string) => void;
  showAll: () => void;
  hiddenCount: number;
  className?: string;
}

export function ColumnToggleDropdown({
  columns,
  isVisible,
  toggleColumn,
  showAll,
  hiddenCount,
  className,
}: ColumnToggleDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 ${className || ""}`}
      >
        <Columns className="h-4 w-4" />
        Columnas
        {hiddenCount > 0 && (
          <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
            {hiddenCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-56 py-2">
          <div className="flex items-center justify-between px-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Columnas visibles
            </span>
            {hiddenCount > 0 && (
              <button
                onClick={showAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mostrar todas
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {columns.map((col) => {
              const visible = isVisible(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => toggleColumn(col.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <span className={`flex-shrink-0 ${visible ? "text-blue-600" : "text-gray-300 dark:text-gray-600"}`}>
                    {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </span>
                  <span className={visible ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500 line-through"}>
                    {col.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
