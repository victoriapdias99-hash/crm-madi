import { ReassignLeadsPayload } from "@/lib/api/leads-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: number[];
  onConfirm: (payload: ReassignLeadsPayload) => void;
}

export function ReassignLeadsDialog({
  open,
  onOpenChange,
  selectedLeadIds,
  onConfirm,
}: Props) {

  const handleSubmit = () => {
    const payload: ReassignLeadsPayload = {
      leadIds: selectedLeadIds,
      newClientId: 1,
      newLocationId: 1,
    };
    onConfirm(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-4 rounded shadow-md space-y-4">
        <h2 className="font-semibold">Reasignar leads</h2>
        <p>Leads seleccionados: {selectedLeadIds.length}</p>

        {/* TODO: selects de cliente y zona */}
        <div className="flex justify-end gap-2">
          <button onClick={() => onOpenChange(false)}>Cancelar</button>
          <button onClick={handleSubmit}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}
