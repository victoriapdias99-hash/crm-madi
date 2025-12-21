import { useState } from "react";
import { useLeads, useReassignLeads } from "@/hooks/useLeads";
import { Lead, ReassignLeadsPayload } from "@/lib/api/leads-types";
import { ReassignLeadsDialog } from "@/components/leads/ReassignLeadsDialog";

function LeadsPage() {
  const { leads, loading, error, reload } = useLeads();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { mutate: doReassign, loading: reassigning } = useReassignLeads(() => {
    reload();
    setSelectedIds([]);
    setDialogOpen(false);
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
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

  const isAllSelected = leads.length > 0 && selectedIds.length === leads.length;

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

      <div className="border rounded overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="w-10 px-2 py-2">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="w-[170px] px-2 py-2 text-left whitespace-nowrap">
                Fecha
              </th>
              <th className="w-[140px] px-2 py-2 text-left whitespace-nowrap">
                Nombre
              </th>
              <th className="w-[140px] px-2 py-2 text-left whitespace-nowrap">
                Apellido
              </th>
              <th className="w-[170px] px-2 py-2 text-left whitespace-nowrap">
                Teléfono
              </th>
              <th className="w-[140px] px-2 py-2 text-left whitespace-nowrap">
                Localidad
              </th>
              <th className="w-[160px] px-2 py-2 text-left whitespace-nowrap">
                Modelo
              </th>
              <th className="w-[140px] px-2 py-2 text-left whitespace-nowrap">
                Cliente
              </th>
              <th className="w-[180px] px-2 py-2 text-left whitespace-nowrap">
                Localización
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead: Lead) => (
              <tr key={lead.id} className="border-t">
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {new Date(lead.createdAt).toLocaleString()}
                </td>
                <td className="px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {lead.firstName}
                </td>
                <td className="px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {lead.lastName}
                </td>
                <td className="px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {lead.email}
                </td>
                <td className="px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {lead.phone}
                </td>
                <td className="px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {lead.campaignName}
                </td>
                <td className="px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {lead.cliente}
                </td>
                <td className="px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {lead.localizacion}
                </td>
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

export default LeadsPage;
