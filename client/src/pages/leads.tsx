import { useState, useEffect } from "react";
// Eliminamos useLeads temporalmente para conectar directo a tu nueva API
// import { useLeads, useReassignLeads } from "@/hooks/useLeads";
import { ReassignLeadsDialog } from "@/components/leads/ReassignLeadsDialog";

// 1. Definimos la forma exacta de los datos nuevos
interface WebhookLead {
  id: number;
  nombre: string;
  telefono: string;
  auto: string | null;
  localidad: string | null;
  cliente: string | null; // NUEVO
  comentarios: string | null;
  source: string;
  createdAt: string;
}

function LeadsPage() {
  // 2. Estado local para los nuevos datos
  const [leads, setLeads] = useState<WebhookLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 3. Función para cargar datos desde el nuevo endpoint
  const fetchLeads = async () => {
    setLoading(true);
    try {
      // Conexión con el endpoint /api/webhook/leads.
      const response = await fetch("/api/webhook/leads");

      if (!response.ok) throw new Error("Error al cargar leads");

      const result = await response.json();
      // La API devuelve { success: true, data: [...] }
      setLeads(result.data || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar al iniciar
  useEffect(() => {
    fetchLeads();
  }, []);

  // Lógica de selección
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

  // Mock para reasignar (ya que no se tiene el hook nuevo aún)
  const handleConfirmReassign = (payload: any) => {
    console.log("Reasignando:", payload);
    setDialogOpen(false);
    setSelectedIds([]);
    alert("Funcionalidad de reasignar pendiente de conectar al nuevo backend");
  };

  const isAllSelected = leads.length > 0 && selectedIds.length === leads.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leads</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded border hover:bg-gray-100"
            onClick={fetchLeads}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>

          <button
            className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-400"
            disabled={selectedIds.length === 0}
            onClick={() => setDialogOpen(true)}
          >
            Reasignar ({selectedIds.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">
          ⚠️ Error cargando leads: {error}
        </div>
      )}

      <div className="border rounded overflow-x-auto bg-white shadow-sm">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              {/* 4. Columnas actualizadas a tus datos reales */}
              <th className="w-[150px] px-4 py-3 text-left font-medium text-gray-600">
                Fecha
              </th>
              <th className="w-[200px] px-4 py-3 text-left font-medium text-gray-600">
                Nombre
              </th>
              <th className="w-[150px] px-4 py-3 text-left font-medium text-gray-600">
                Teléfono
              </th>
              <th className="w-[140px] px-4 py-3 text-left font-medium text-gray-600">
                Cliente
              </th>
              <th className="w-[150px] px-4 py-3 text-left font-medium text-gray-600">
                Auto
              </th>
              <th className="w-[150px] px-4 py-3 text-left font-medium text-gray-600">
                Localidad
              </th>
              <th className="w-[120px] px-4 py-3 text-left font-medium text-gray-600">
                Comentario
              </th>
              <th className="w-[120px] px-4 py-3 text-left font-medium text-gray-600">
                Origen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                  />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(lead.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {lead.nombre}
                </td>
                <td className="px-4 py-3 text-gray-600">{lead.telefono}</td>
                <td className="px-4 py-3 text-gray-800 font-medium">
                  {lead.cliente || "-"}
                </td>
                <td className="px-4 py-3 text-gray-600">{lead.auto || "-"}</td>
                <td className="px-4 py-3 text-gray-600">
                  {lead.localidad || "-"}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {lead.comentarios || "-"}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {lead.source}
                  </span>
                </td>
              </tr>
            ))}

            {leads.length === 0 && !loading && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={7}>
                  No hay leads registrados aún.
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
