import { Lead } from "@/lib/api/leads";

interface Props {
  leads: Lead[];
  isLoading: boolean;
  error: unknown;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onOpenReassign: () => void;
}

export function LeadsTable({
  leads,
  isLoading,
  error,
  selectedIds,
  onSelectionChange,
  onOpenReassign,
}: Props) {
  // TODO: usar componentes de tabla de tu UI (shadcn, etc.)
  if (isLoading) return <div>Cargando leads...</div>;
  if (error) return <div>Error cargando leads</div>;

  const toggleRow = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div>
        <button
        disabled={selectedIds.length === 0}
        onClick={onOpenReassign}
        className="mb-2"
      >
        Reasignar seleccionados
      </button>

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>
              {/* TODO: checkbox general */}
            </th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Marca</th>
            <th>Zona</th>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Comentario</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(lead.id)}
                  onChange={() => toggleRow(lead.id)}
                />
              </td>
              <td>{new Date(lead.createdAt).toLocaleString()}</td>
              <td>{lead.clientName ?? "-"}</td>
              <td>{lead.brandName ?? "-"}</td>
              <td>{lead.locationName ?? "-"}</td>
              <td>{lead.firstName} {lead.lastName}</td>
              <td>{lead.phone}</td>
              <td>{lead.comment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
