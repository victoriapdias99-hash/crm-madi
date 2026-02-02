import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: number[];
  onConfirm: (clienteSeleccionado: string) => Promise<void>;
}

export function ReassignLeadsDialog({
  open,
  onOpenChange,
  selectedLeadIds,
  onConfirm,
}: Props) {
  const [clientes, setClientes] = useState<string[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de clientes cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      fetchClientes();
      setClienteSeleccionado("");
      setError(null);
    }
  }, [open]);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Error al cargar clientes");
      const data = await response.json();
      setClientes(data || []);
    } catch (err: any) {
      console.error("Error cargando clientes:", err);
      setError("Error al cargar la lista de clientes");
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!clienteSeleccionado) {
      setError("Por favor selecciona un cliente");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onConfirm(clienteSeleccionado);
      // Si llega aquí, fue exitoso
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Error al reasignar leads");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setClienteSeleccionado("");
    setError(null);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md mx-4">
        {/* Header */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Reasignar leads
        </h2>

        <div className="space-y-4">
          {/* Contador de leads seleccionados */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              Leads seleccionados:{" "}
              <span className="font-bold text-blue-700 text-lg">
                {selectedLeadIds.length}
              </span>
            </p>
          </div>

          {/* Selector de cliente */}
          <div>
            <label
              htmlFor="cliente-select"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Reasignar a cliente: <span className="text-red-500">*</span>
            </label>
            <select
              id="cliente-select"
              value={clienteSeleccionado}
              onChange={(e) => {
                setClienteSeleccionado(e.target.value);
                setError(null);
              }}
              disabled={loading || submitting}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            >
              <option value="">
                {loading ? "Cargando clientes..." : "Selecciona un cliente"}
              </option>
              {clientes.map((cliente) => (
                <option key={cliente} value={cliente}>
                  {cliente}
                </option>
              ))}
            </select>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 animate-shake">
              <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
            </div>
          )}

          {/* Info adicional */}
          {clientes.length > 0 && !loading && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-2">
                📋 Clientes disponibles:{" "}
                <span className="font-semibold">{clientes.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {clientes.slice(0, 6).map((cliente) => (
                  <span
                    key={cliente}
                    className="inline-block px-2 py-1 bg-white border border-gray-200 text-gray-700 text-xs rounded-md shadow-sm"
                  >
                    {cliente}
                  </span>
                ))}
                {clientes.length > 6 && (
                  <span className="inline-block px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-md font-medium">
                    +{clientes.length - 6} más
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleCancel}
            disabled={submitting}
            className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!clienteSeleccionado || loading || submitting}
            className="px-5 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></span>
                Reasignando...
              </>
            ) : (
              "Confirmar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
