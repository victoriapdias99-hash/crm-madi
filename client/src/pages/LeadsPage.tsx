import { useState } from "react";
import { useLeads, useReassignLeads } from "@/hooks/useLeads";
import { Lead, ReassignLeadsPayload } from "@/lib/api/leads-types";
import { ReassignLeadsDialog } from "@/components/leads/ReassignLeadsDialog";

export function LeadsPage() {
  const { leads, loading, error, reload } = useLeads();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { mutate: doReassign, loading: reassigning } = useReassignLeads(() => {
    // al terminar la reasignación recargo y limpio selección
    reload();
    setSelectedIds([]);
    setDialogOpen(false);
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map((l) => l.id));
    }
  };

  const handleConfirmReassign = (payload: ReassignLeadsPayload) => {
    doReassign(payload);
  };

  const isAllSelected =
    leads.length > 0 && selectedIds.length === leads.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leads</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded border"
            onClick={() => reload()}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Refrescar"}
          </button>

          <button
            className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-400"
            disabled={selectedIds.length === 0 || reassigning}
            onClick={() => setDialogOpen(true)}
          >
            {reassigning
              ? "Reasignando..."
              : `Reasignar (${selectedIds.length})`}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600">
          Error cargando leads: {error}
        </div>
      )}

      <div className="border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-2 py-1 text-left">Fecha</th>
              <th className="px-2 py-1 text-left">Nombre</th>
              <th className="px-2 py-1 text-left">Teléfono</th>
              <th className="px-2 py-1 text-left">Localidad</th>
              <th className="px-2 py-1 text-left">Modelo</th>
              <th className="px-2 py-1 text-left">Cliente</th>
              <th className="px-2 py-1 text-left">Localización</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead: Lead) => (
              <tr key={lead.id} className="border-t">
                <td className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                  />
                </td>
                <td className="px-2 py-1">
                  {new Date(lead.fecha).toLocaleString()}
                </td>
                <td className="px-2 py-1">{lead.nombre}</td>
                <td className="px-2 py-1">{lead.telefono}</td>
                <td className="px-2 py-1">{lead.localidad}</td>
                <td className="px-2 py-1">{lead.modelo}</td>
                <td className="px-2 py-1">{lead.cliente}</td>
                <td className="px-2 py-1">{lead.localizacion}</td>
              </tr>
            ))}

            {leads.length === 0 && !loading && (
              <tr>
                <td className="px-2 py-4 text-center" colSpan={8}>
                  No hay leads para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReassignLeadsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedLeadIds={selectedIds}
        onConfirm={handleConfirmReassign}
      />
    </div>
  );
}
