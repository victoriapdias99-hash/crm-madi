import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ReassignLeadsDialog } from "@/components/leads/ReassignLeadsDialog";

// --- CONSTANTES ---
const ZONES = ["AMBA", "Córdoba", "Mendoza", "NACIONAL", "Santa Fe"];
const BRANDS = [
  "BAIC",
  "Chevrolet",
  "Citroen",
  "Fiat",
  "Ford",
  "Jeep",
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
  nombre: string;
  telefono: string;
  auto: string | null;
  localidad: string | null;
  cliente: string | null;
  comentarios: string | null;
  source: string;
  createdAt: string;
  estadoLead: string | null;
  subEstado: string | null;
  ultimoContacto: string | null;
  proximoSeguimiento: string | null;
  prioridad: string | null;
  observaciones: string | null;
  vendedorAsignado: string | null;
}

const ESTADOS_PRINCIPALES = [
  { value: "nuevo", label: "Nuevo", color: "bg-blue-100 text-blue-800" },
  { value: "en_seguimiento", label: "En seguimiento", color: "bg-yellow-100 text-yellow-800" },
  { value: "proximo_venta", label: "Próximo a venta", color: "bg-purple-100 text-purple-800" },
  { value: "vendido", label: "Vendido", color: "bg-green-100 text-green-800" },
  { value: "no_interesado", label: "No interesado", color: "bg-red-100 text-red-800" },
];

const SUB_ESTADOS = [
  { value: "llamado_no_atendio", label: "Llamado - No atendió" },
  { value: "contactado", label: "Contactado" },
  { value: "interesado", label: "Interesado" },
  { value: "turno_agendado", label: "Turno agendado" },
  { value: "presentado_concesionario", label: "Presentado en concesionario" },
  { value: "caido_perdido", label: "Caído / Perdido" },
];

const PRIORIDADES = [
  { value: "alta", label: "Alta", color: "bg-red-100 text-red-700" },
  { value: "media", label: "Media", color: "bg-yellow-100 text-yellow-700" },
  { value: "baja", label: "Baja", color: "bg-gray-100 text-gray-700" },
];

function LeadsPage() {
  const [leads, setLeads] = useState<WebhookLead[]>([]);
  const [clientsList, setClientsList] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de filtros
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedClient, setSelectedClient] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [searchNombre, setSearchNombre] = useState("");
  const [searchApellido, setSearchApellido] = useState("");
  const [searchTelefono, setSearchTelefono] = useState("");
  const [searchLocalidad, setSearchLocalidad] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  // Carga inicial - usando endpoint CRM que incluye todos los campos
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/webhook/leads-crm");
      if (!response.ok) throw new Error("Error al cargar leads");
      const result = await response.json();
      setLeads(result.data || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

      alert(`✅ Sincronización exitosa!\n${data.message}`);
      fetchLeads();
      fetchClients();
    } catch (err: any) {
      console.error("Sync error:", err);
      alert("❌ Error al sincronizar: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const updateLeadCRM = async (id: number, field: string, value: any) => {
    try {
      const response = await fetch(`/api/webhook/leads/${id}/crm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error("Error al actualizar");
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
      );
    } catch (err: any) {
      console.error("Error actualizando lead:", err);
      alert("Error al actualizar: " + err.message);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchClients();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedZone, selectedBrand, selectedClient, startDate, endDate, searchNombre, searchApellido, searchTelefono, searchLocalidad]);

  // ORDENAMIENTO FORZADO EN FRONTEND (useMemo)
  // Esto asegura que, sin importar cómo vengan del backend, se ordenen
  // por fecha descendente (más nuevo arriba) antes de filtrar.
  const sortedLeads = useMemo(() => {
    // Creamos una copia [...] para ordenar sin mutar el estado original
    return [...leads].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();

      // Protección contra fechas inválidas (las manda al final)
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;

      // Orden descendente: fecha más grande (B) menos fecha más chica (A)
      return dateB - dateA;
    });
  }, [leads]); // Se ejecuta cada vez que la lista base 'leads' cambia

  // --- LÓGICA DE FILTRADO (Ahora usa sortedLeads) ---
  const filteredLeads = useMemo(() => {
    const normalizeText = (text: string | null) => {
      if (!text) return "";
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[_-]/g, " ")
        .trim();
    };

    const EXCLUDED_FROM_NACIONAL = ["amba", "cordoba", "mendoza", "santa fe"];
    // Conversión de la lista de marcas constante a formato limpio para comparar
    const MAIN_BRANDS_NORMALIZED = BRANDS.map((b) => normalizeText(b));

    // Se usa 'sortedLeads' en lugar de 'leads'
    return sortedLeads.filter((lead) => {
      // FILTRO ZONA
      if (selectedZone !== "all") {
        // Se normalizan ambos lados: lo que viene del Lead y lo que se elige en el Select
        const leadZoneClean = normalizeText(lead.localidad);
        const selectedZoneClean = normalizeText(selectedZone);

        if (selectedZone === "NACIONAL") {
          // CASO ESPECIAL: Si es NACIONAL, se muestra todo lo que NO esté en la lista de excluidos
          if (EXCLUDED_FROM_NACIONAL.includes(leadZoneClean)) return false;
        } else {
          // CASO NORMAL: Comparamos directamente (ej: "amba" == "amba")
          if (leadZoneClean !== selectedZoneClean) return false;
        }
      }

      // Filtro Marca
      if (selectedBrand !== "all") {
        const leadAutoClean = normalizeText(lead.auto);
        const selectedBrandClean = normalizeText(selectedBrand);

        // CASO ESPECIAL: "Otras Marcas"
        if (selectedBrand === "Otras Marcas") {
          // Creamos una lista de las marcas REALES (todas menos "Otras Marcas")
          // para saber qué debemos excluir.
          const realBrandsToCheck = BRANDS.filter(
            (b) => b !== "Otras Marcas",
          ).map((b) => normalizeText(b));

          // Verificamos si el auto del lead coincide con alguna marca real
          const isMainBrand = realBrandsToCheck.some((mainBrand) =>
            leadAutoClean.includes(mainBrand),
          );

          // Si ES una marca conocida, la ocultamos (porque queremos ver "las otras")
          if (isMainBrand) return false;
        } else {
          // CASO NORMAL
          if (!leadAutoClean.includes(selectedBrandClean)) return false;
        }
      }

      // Filtro Cliente
      if (selectedClient !== "all") {
        const leadClientClean = normalizeText(lead.cliente);
        const selectedClientClean = normalizeText(selectedClient);

        // CASO ESPECIAL: "Otros Clientes"
        if (selectedClient === "Otros Clientes") {
          // Verificar si el cliente del lead coincide con ALGUNO de la lista oficial (clientsList)
          const isKnownClient = clientsList.some((clientName) => {
            const knownClientClean = normalizeText(clientName);
            // Si el nombre del lead contiene el nombre oficial
            return leadClientClean.includes(knownClientClean);
          });

          // Si es conocido, lo ocultamos (porque queremos ver los "Otros")
          if (isKnownClient) return false;
        } else {
          // Lógica normal (Búsqueda específica)
          if (
            !leadClientClean.includes(selectedClientClean) &&
            leadClientClean !== selectedClientClean
          ) {
            return false;
          }
        }
      }

      // Filtro Rango de Fechas
      if (startDate || endDate) {
        const leadDate = new Date(lead.createdAt);
        leadDate.setHours(0, 0, 0, 0);
        if (startDate) {
          const start = new Date(startDate);
          start.setMinutes(start.getMinutes() + start.getTimezoneOffset());
          if (leadDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setMinutes(end.getMinutes() + end.getTimezoneOffset());
          end.setHours(23, 59, 59, 999);
          if (leadDate > end) return false;
        }
      }

      // Filtros de búsqueda por texto
      const leadNombre = normalizeText(lead.nombre);
      
      if (searchNombre) {
        const searchTerm = normalizeText(searchNombre);
        if (!leadNombre.includes(searchTerm)) return false;
      }
      
      if (searchApellido) {
        const searchTerm = normalizeText(searchApellido);
        if (!leadNombre.includes(searchTerm)) return false;
      }
      
      if (searchTelefono) {
        const leadTel = (lead.telefono || "").replace(/\D/g, "");
        const searchTel = searchTelefono.replace(/\D/g, "");
        if (!leadTel.includes(searchTel)) return false;
      }
      
      if (searchLocalidad) {
        const leadLoc = normalizeText(lead.localidad);
        const searchTerm = normalizeText(searchLocalidad);
        if (!leadLoc.includes(searchTerm)) return false;
      }

      return true;
    });
  }, [
    sortedLeads,
    selectedZone,
    selectedBrand,
    selectedClient,
    startDate,
    endDate,
    searchNombre,
    searchApellido,
    searchTelefono,
    searchLocalidad,
  ]);

  const totalItems = filteredLeads.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLeads = filteredLeads.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  // Funciones auxiliares
  const resetFilters = () => {
    setSelectedZone("all");
    setSelectedBrand("all");
    setSelectedClient("all");
    setStartDate("");
    setEndDate("");
    setSearchNombre("");
    setSearchApellido("");
    setSearchTelefono("");
    setSearchLocalidad("");
    setCurrentPage(1);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (
      selectedIds.length === filteredLeads.length &&
      filteredLeads.length > 0
    ) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map((l) => l.id));
    }
  };

  const handleConfirmReassign = (payload: any) => {
    console.log("Reasignando:", payload);
    setDialogOpen(false);
    setSelectedIds([]);
    alert("Funcionalidad de reasignar pendiente");
  };

  const isAllSelected =
    filteredLeads.length > 0 && selectedIds.length === filteredLeads.length;

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  return (
    <div className="min-h-screen p-4 space-y-4" style={{ backgroundColor: '#5b9bd5' }}>
      {/* Encabezado */}
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
              {totalItems} registros
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Link href="/leads-kanban">
            <button className="px-3 py-1 rounded border border-purple-600 text-purple-700 bg-purple-50 hover:bg-purple-100 flex items-center gap-2">
              📊 Vista Kanban
            </button>
          </Link>

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
            className="px-3 py-1 rounded border hover:bg-gray-100 bg-white"
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

      {/* BARRA DE FILTROS */}
      <div className="flex flex-row items-end gap-3 bg-white p-4 rounded border border-gray-200 shadow-sm overflow-x-auto pb-4">
        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Zona
          </label>
          <select
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
          >
            <option value="all">Todas las zonas</option>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Marca
          </label>
          <select
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="all">Todas las marcas</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Cliente
          </label>
          <select
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[160px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="all">Todos los clientes</option>
            {clientsList.map((clientName) => (
              <option key={clientName} value={clientName}>
                {clientName}
              </option>
            ))}
            {/* Opción Nueva para descartes */}
            <option value="Otros Clientes">Otros Clientes</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Rango de Fecha
          </label>
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
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Nombre
          </label>
          <input
            type="text"
            placeholder="Buscar nombre..."
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchNombre}
            onChange={(e) => setSearchNombre(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Apellido
          </label>
          <input
            type="text"
            placeholder="Buscar apellido..."
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchApellido}
            onChange={(e) => setSearchApellido(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Teléfono
          </label>
          <input
            type="text"
            placeholder="Buscar teléfono..."
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTelefono}
            onChange={(e) => setSearchTelefono(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Localidad
          </label>
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
          ⚠️ Error: {error}
        </div>
      )}

      {/* Tabla con campos CRM */}
      <div className="border rounded overflow-x-auto bg-white shadow-sm mt-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b sticky top-0">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Fecha</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Nombre</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Teléfono</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Estado</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Sub-estado</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Prioridad</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Vendedor</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Últ. Contacto</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Próx. Seguim.</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Cliente</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Auto</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedLeads.map((lead) => {
              const estadoInfo = ESTADOS_PRINCIPALES.find(e => e.value === (lead.estadoLead || 'nuevo'));
              const prioridadInfo = PRIORIDADES.find(p => p.value === (lead.prioridad || 'media'));
              
              return (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(lead.createdAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {lead.nombre}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{lead.telefono}</td>
                  <td className="px-3 py-2">
                    <select
                      className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${estadoInfo?.color || 'bg-gray-100'}`}
                      value={lead.estadoLead || 'nuevo'}
                      onChange={(e) => updateLeadCRM(lead.id, 'estadoLead', e.target.value)}
                    >
                      {ESTADOS_PRINCIPALES.map(e => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {(lead.estadoLead === 'en_seguimiento') ? (
                      <select
                        className="text-xs px-2 py-1 rounded border border-gray-300 cursor-pointer"
                        value={lead.subEstado || ''}
                        onChange={(e) => updateLeadCRM(lead.id, 'subEstado', e.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        {SUB_ESTADOS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${prioridadInfo?.color || 'bg-gray-100'}`}
                      value={lead.prioridad || 'media'}
                      onChange={(e) => updateLeadCRM(lead.id, 'prioridad', e.target.value)}
                    >
                      {PRIORIDADES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="text-xs px-2 py-1 border border-gray-300 rounded w-24"
                      placeholder="Vendedor..."
                      value={lead.vendedorAsignado || ''}
                      onChange={(e) => updateLeadCRM(lead.id, 'vendedorAsignado', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="datetime-local"
                      className="text-xs px-1 py-1 border border-gray-300 rounded w-36"
                      value={lead.ultimoContacto ? lead.ultimoContacto.slice(0, 16) : ''}
                      onChange={(e) => updateLeadCRM(lead.id, 'ultimoContacto', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="datetime-local"
                      className="text-xs px-1 py-1 border border-gray-300 rounded w-36"
                      value={lead.proximoSeguimiento ? lead.proximoSeguimiento.slice(0, 16) : ''}
                      onChange={(e) => updateLeadCRM(lead.id, 'proximoSeguimiento', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">
                    {lead.cliente || "-"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{lead.auto || "-"}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="text-xs px-2 py-1 border border-gray-300 rounded w-32"
                      placeholder="Observaciones..."
                      value={lead.observaciones || ''}
                      onChange={(e) => updateLeadCRM(lead.id, 'observaciones', e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
            {paginatedLeads.length === 0 && !loading && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={13}>
                  No se encontraron resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
            <div className="text-xs text-gray-500">
              Mostrando <span className="font-medium">{startIndex + 1}</span> a{" "}
              <span className="font-medium">
                {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
              </span>{" "}
              de <span className="font-medium">{totalItems}</span> resultados
            </div>
            <div className="flex gap-2">
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="flex items-center px-2 text-sm font-medium text-gray-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={goToNextPage}
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
        selectedLeadIds={selectedIds}
        onConfirm={handleConfirmReassign}
      />
    </div>
  );
}

export default LeadsPage;
