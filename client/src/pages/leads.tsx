import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "wouter";
import { ReassignLeadsDialog } from "@/components/leads/ReassignLeadsDialog";
import { buildClientDisplayMap, getClientDisplayName } from "@shared/utils/client-normalization";

const ZONES = ["AMBA", "Córdoba", "Mendoza", "NACIONAL", "Santa Fe"];
const BRANDS = [
  "BAIC",
  "BYD",
  "Chery",
  "Chevrolet",
  "Citroen",
  "DFSK",
  "Fiat",
  "Ford",
  "Haval",
  "JAC",
  "Jeep",
  "JMEV",
  "Leapmotor",
  "MG",
  "Maxus",
  "Forthing",
  "Nissan",
  "Peugeot",
  "Renault",
  "Toyota",
  "Volkswagen",
  "Otras Marcas",
];
const ITEMS_PER_PAGE = 100;

interface WebhookLead {
  id: number;
  tabla: string;
  nombre: string;
  telefono: string;
  auto: string | null;
  localidad: string | null;
  cliente: string | null;
  comentarios: string | null;
  source: string;
  createdAt: string;
  fechaCreacion?: string;
}

interface PaginatedResponse {
  success: boolean;
  count: number;
  page: number;
  limit: number;
  totalPages: number;
  data: WebhookLead[];
}

function LeadsPage() {
  const [leads, setLeads] = useState<WebhookLead[]>([]);
  const [clientsList, setClientsList] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedLeads, setSelectedLeads] = useState<{id: number; tabla: string}[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedClient, setSelectedClient] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [searchNombre, setSearchNombre] = useState("");
  const [searchTelefono, setSearchTelefono] = useState("");
  const [searchLocalidad, setSearchLocalidad] = useState("");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const buildQueryString = useCallback((page: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(ITEMS_PER_PAGE));
    if (selectedZone !== "all") params.set("zone", selectedZone);
    if (selectedBrand !== "all") params.set("brand", selectedBrand);
    if (selectedClient !== "all") params.set("client", selectedClient);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (searchNombre) params.set("searchNombre", searchNombre);
    if (searchTelefono) params.set("searchTelefono", searchTelefono);
    if (searchLocalidad) params.set("searchLocalidad", searchLocalidad);
    return params.toString();
  }, [selectedZone, selectedBrand, selectedClient, startDate, endDate, searchNombre, searchTelefono, searchLocalidad]);

  const fetchLeads = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const qs = buildQueryString(page);
      const response = await fetch(`/api/webhook/leads-paginated?${qs}`);
      if (!response.ok) throw new Error("Error al cargar leads");
      const result: PaginatedResponse = await response.json();
      setLeads(result.data || []);
      setTotalCount(result.count);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/clients");
      if (response.ok) {
        const data = await response.json();
        setClientsList(data);
      }
    } catch (err) {
      console.error("Error cargando clientes:", err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/sync/sheets", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error en sync");
      alert(`Sincronización exitosa!\n${data.message}`);
      fetchLeads(1);
      fetchClients();
    } catch (err: any) {
      console.error("Sync error:", err);
      alert("Error al sincronizar: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchLeads(1);
    fetchClients();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchLeads(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selectedZone, selectedBrand, selectedClient, startDate, endDate, searchNombre, searchTelefono, searchLocalidad]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    fetchLeads(page);
  };

  const resetFilters = () => {
    setSelectedZone("all");
    setSelectedBrand("all");
    setSelectedClient("all");
    setStartDate("");
    setEndDate("");
    setSearchNombre("");
    setSearchTelefono("");
    setSearchLocalidad("");
  };

  const selectedIds = selectedLeads.map(l => l.id);

  const toggleSelect = (lead: WebhookLead) => {
    setSelectedLeads((prev) => {
      const exists = prev.some(s => s.id === lead.id && s.tabla === lead.tabla);
      if (exists) return prev.filter((s) => !(s.id === lead.id && s.tabla === lead.tabla));
      return [...prev, { id: lead.id, tabla: lead.tabla }];
    });
  };

  const isSelected = (lead: WebhookLead) => {
    return selectedLeads.some(s => s.id === lead.id && s.tabla === lead.tabla);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length && leads.length > 0) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map((l) => ({ id: l.id, tabla: l.tabla })));
    }
  };

  const handleConfirmReassign = async (clienteNuevo: string): Promise<void> => {
    try {
      const response = await fetch("/api/webhook/leads/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: selectedLeads, clienteNuevo }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error al reasignar leads");
      alert(`${data.message}`);
      setSelectedLeads([]);
      setDialogOpen(false);
      await fetchLeads(currentPage);
    } catch (err: any) {
      console.error("Error reasignando leads:", err);
      throw new Error(err.message || "Error al reasignar los leads");
    }
  };

  const clientDisplayMap = useMemo(() => buildClientDisplayMap(clientsList), [clientsList]);

  const isAllSelected = leads.length > 0 && selectedLeads.length === leads.length;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const renderPageButtons = () => {
    const buttons: JSX.Element[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(
          <button
            key={i}
            onClick={() => goToPage(i)}
            className={`px-3 py-1 text-sm border rounded ${currentPage === i ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"}`}
          >
            {i}
          </button>
        );
      }
    } else {
      buttons.push(
        <button key={1} onClick={() => goToPage(1)} className={`px-3 py-1 text-sm border rounded ${currentPage === 1 ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"}`}>1</button>
      );

      if (currentPage > 3) {
        buttons.push(<span key="dots1" className="px-2 py-1 text-gray-400">...</span>);
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        buttons.push(
          <button
            key={i}
            onClick={() => goToPage(i)}
            className={`px-3 py-1 text-sm border rounded ${currentPage === i ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"}`}
          >
            {i}
          </button>
        );
      }

      if (currentPage < totalPages - 2) {
        buttons.push(<span key="dots2" className="px-2 py-1 text-gray-400">...</span>);
      }

      buttons.push(
        <button key={totalPages} onClick={() => goToPage(totalPages)} className={`px-3 py-1 text-sm border rounded ${currentPage === totalPages ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"}`}>{totalPages}</button>
      );
    }

    return buttons;
  };

  return (
    <div
      className="min-h-screen p-4 space-y-4"
      style={{ backgroundColor: "#5b9bd5" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link href="/">
            <button className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 flex items-center gap-1 text-gray-600">
              <span>←</span> Atrás
            </button>
          </Link>
          <h1 className="text-xl font-semibold">Leads</h1>
          {!loading && (
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full border font-medium">
              {totalCount.toLocaleString()} registros
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded border border-green-600 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 flex items-center gap-2"
            onClick={handleSync}
            disabled={syncing || loading}
          >
            {syncing ? (
              <>
                <span className="animate-spin h-3 w-3 border-2 border-green-600 rounded-full border-t-transparent"></span>
                Sincronizando...
              </>
            ) : (
              "Sincronizar Sheets"
            )}
          </button>

          <button
            className="px-3 py-1 rounded border hover:bg-gray-100"
            onClick={() => fetchLeads(currentPage)}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>

          <button
            className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-400"
            disabled={selectedLeads.length === 0}
            onClick={() => setDialogOpen(true)}
          >
            Reasignar ({selectedLeads.length})
          </button>
        </div>
      </div>

      <div className="flex flex-row items-end gap-3 bg-white p-4 rounded border border-gray-200 shadow-sm overflow-x-auto pb-4">
        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">Zona</label>
          <select
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
          >
            <option value="all">Todas las zonas</option>
            {ZONES.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">Marca</label>
          <select
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="all">Todas las marcas</option>
            {BRANDS.filter(b => b !== "Otras Marcas").map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">Cliente</label>
          <select
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[160px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="all">Todos los clientes</option>
            {clientsList.map((clientName) => (
              <option key={clientName} value={clientName}>{clientName}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">Rango de Fecha</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-[130px]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-[130px]"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="h-8 w-px bg-gray-300 mx-2 shrink-0"></div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">Nombre</label>
          <input
            type="text"
            placeholder="Buscar nombre..."
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchNombre}
            onChange={(e) => setSearchNombre(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">Teléfono</label>
          <input
            type="text"
            placeholder="Buscar teléfono..."
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTelefono}
            onChange={(e) => setSearchTelefono(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">Localidad</label>
          <input
            type="text"
            placeholder="Buscar localidad..."
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchLocalidad}
            onChange={(e) => setSearchLocalidad(e.target.value)}
          />
        </div>

        <div className="flex pb-1 shrink-0">
          <button
            onClick={resetFilters}
            className="text-gray-500 hover:text-blue-600 text-sm font-medium px-3 py-2 border border-transparent hover:bg-blue-50 rounded transition"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">
          Error: {error}
        </div>
      )}

      <div className="border rounded overflow-x-auto bg-white shadow-sm mt-4">
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
              <th className="w-[150px] px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
              <th className="w-[200px] px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
              <th className="w-[150px] px-4 py-3 text-left font-medium text-gray-600">Teléfono</th>
              <th className="w-[140px] px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
              <th className="w-[150px] px-4 py-3 text-left font-medium text-gray-600">Auto</th>
              <th className="w-[150px] px-4 py-3 text-left font-medium text-gray-600">Localidad</th>
              <th className="w-[250px] px-4 py-3 text-left font-medium text-gray-600">Comentario</th>
              <th className="w-[120px] px-4 py-3 text-left font-medium text-gray-600">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={9}>
                  <div className="flex items-center justify-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-blue-600 rounded-full border-t-transparent"></span>
                    Cargando leads...
                  </div>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={9}>
                  No se encontraron resultados.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={`${lead.tabla}-${lead.id}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected(lead)}
                      onChange={() => toggleSelect(lead)}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {(lead.fechaCreacion || lead.createdAt)
                      ? new Date(lead.fechaCreacion || lead.createdAt).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{lead.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.telefono}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{lead.cliente ? getClientDisplayName(lead.cliente, clientDisplayMap) : "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.auto || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.localidad || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="whitespace-normal break-words text-xs leading-snug max-h-[80px] overflow-y-auto">
                      {lead.comentarios || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {lead.source}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalCount > 0 && !loading && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
            <div className="text-xs text-gray-500">
              Mostrando <span className="font-medium">{startIndex + 1}</span> a{" "}
              <span className="font-medium">
                {Math.min(startIndex + ITEMS_PER_PAGE, totalCount)}
              </span>{" "}
              de <span className="font-medium">{totalCount.toLocaleString()}</span> resultados
            </div>
            <div className="flex gap-1 items-center">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              {renderPageButtons()}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <ReassignLeadsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedLeadIds={selectedLeads.map(l => l.id)}
        onConfirm={handleConfirmReassign}
      />
    </div>
  );
}

export default LeadsPage;
