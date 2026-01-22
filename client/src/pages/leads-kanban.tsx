import { useState, useEffect } from "react";
import { Link } from "wouter";

interface Lead {
  id: number;
  nombre: string;
  telefono: string;
  auto: string | null;
  cliente: string | null;
  estadoLead: string | null;
  subEstado: string | null;
  prioridad: string | null;
  vendedorAsignado: string | null;
  ultimoContacto: string | null;
  proximoSeguimiento: string | null;
  createdAt: string;
}

interface KanbanData {
  nuevo: Lead[];
  en_seguimiento: Lead[];
  proximo_venta: Lead[];
  vendido: Lead[];
  no_interesado: Lead[];
}

const COLUMNAS = [
  { id: "nuevo", titulo: "Nuevo", color: "bg-blue-500", bgCard: "bg-blue-50" },
  { id: "en_seguimiento", titulo: "En Seguimiento", color: "bg-yellow-500", bgCard: "bg-yellow-50" },
  { id: "proximo_venta", titulo: "Próximo a Venta", color: "bg-purple-500", bgCard: "bg-purple-50" },
  { id: "vendido", titulo: "Vendido", color: "bg-green-500", bgCard: "bg-green-50" },
  { id: "no_interesado", titulo: "No Interesado", color: "bg-red-500", bgCard: "bg-red-50" },
];

const SUB_ESTADOS = [
  { value: "llamado_no_atendio", label: "Llamado - No atendió", icon: "📞" },
  { value: "contactado", label: "Contactado", icon: "✅" },
  { value: "interesado", label: "Interesado", icon: "⭐" },
  { value: "turno_agendado", label: "Turno agendado", icon: "📅" },
  { value: "presentado_concesionario", label: "En concesionario", icon: "🏢" },
  { value: "caido_perdido", label: "Caído / Perdido", icon: "❌" },
];

const PRIORIDADES: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "bg-red-200 text-red-800" },
  media: { label: "Media", color: "bg-yellow-200 text-yellow-800" },
  baja: { label: "Baja", color: "bg-gray-200 text-gray-700" },
};

function LeadsKanban() {
  const [kanbanData, setKanbanData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSeguimiento, setExpandedSeguimiento] = useState<string | null>(null);

  const fetchKanbanData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/webhook/leads-kanban");
      if (!response.ok) throw new Error("Error al cargar datos");
      const result = await response.json();
      setKanbanData(result.data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKanbanData();
  }, []);

  const updateLeadEstado = async (leadId: number, nuevoEstado: string, subEstado?: string) => {
    try {
      const response = await fetch(`/api/webhook/leads/${leadId}/crm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          estadoLead: nuevoEstado,
          subEstado: subEstado || null 
        }),
      });
      if (!response.ok) throw new Error("Error al actualizar");
      fetchKanbanData();
    } catch (err: any) {
      console.error("Error actualizando lead:", err);
      alert("Error al actualizar: " + err.message);
    }
  };

  const getSubEstadoInfo = (subEstado: string | null) => {
    return SUB_ESTADOS.find(s => s.value === subEstado);
  };

  const agruparPorSubEstado = (leads: Lead[]) => {
    const grouped: Record<string, Lead[]> = {};
    SUB_ESTADOS.forEach(s => {
      grouped[s.value] = leads.filter(l => l.subEstado === s.value);
    });
    grouped["sin_subestado"] = leads.filter(l => !l.subEstado);
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-xl mb-2">Error</p>
          <p>{error}</p>
          <button 
            onClick={fetchKanbanData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const seguimientoAgrupado = kanbanData ? agruparPorSubEstado(kanbanData.en_seguimiento) : {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/leads">
            <button className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 flex items-center gap-1 text-gray-600 shadow-sm">
              <span>←</span> Volver a Leads
            </button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard de Leads - Vista Kanban</h1>
        </div>
        <button 
          onClick={fetchKanbanData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2 shadow-sm"
        >
          <span className="text-lg">🔄</span> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {COLUMNAS.map((col) => {
          const leads = kanbanData?.[col.id as keyof KanbanData] || [];
          const isEnSeguimiento = col.id === "en_seguimiento";
          
          return (
            <div key={col.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className={`${col.color} px-4 py-3 text-white font-semibold flex justify-between items-center`}>
                <span>{col.titulo}</span>
                <span className="bg-white/30 px-2 py-0.5 rounded-full text-sm">
                  {leads.length}
                </span>
              </div>
              
              <div className="p-3 max-h-[70vh] overflow-y-auto space-y-2">
                {isEnSeguimiento ? (
                  <>
                    {SUB_ESTADOS.map((subEstado) => {
                      const subLeads = seguimientoAgrupado[subEstado.value] || [];
                      const isExpanded = expandedSeguimiento === subEstado.value;
                      
                      return (
                        <div key={subEstado.value} className="border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedSeguimiento(isExpanded ? null : subEstado.value)}
                            className={`w-full px-3 py-2 flex justify-between items-center text-sm font-medium ${col.bgCard} hover:bg-yellow-100`}
                          >
                            <span>{subEstado.icon} {subEstado.label}</span>
                            <span className="text-xs bg-yellow-200 px-2 py-0.5 rounded-full">
                              {subLeads.length}
                            </span>
                          </button>
                          
                          {isExpanded && (
                            <div className="p-2 space-y-2 bg-white">
                              {subLeads.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2">Sin leads</p>
                              ) : (
                                subLeads.map((lead) => (
                                  <LeadCard 
                                    key={lead.id} 
                                    lead={lead} 
                                    bgColor={col.bgCard}
                                    onChangeEstado={updateLeadEstado}
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {(seguimientoAgrupado["sin_subestado"] || []).length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedSeguimiento(expandedSeguimiento === "sin_subestado" ? null : "sin_subestado")}
                          className={`w-full px-3 py-2 flex justify-between items-center text-sm font-medium bg-gray-100 hover:bg-gray-200`}
                        >
                          <span>📋 Sin clasificar</span>
                          <span className="text-xs bg-gray-300 px-2 py-0.5 rounded-full">
                            {seguimientoAgrupado["sin_subestado"]?.length || 0}
                          </span>
                        </button>
                        
                        {expandedSeguimiento === "sin_subestado" && (
                          <div className="p-2 space-y-2 bg-white">
                            {seguimientoAgrupado["sin_subestado"]?.map((lead) => (
                              <LeadCard 
                                key={lead.id} 
                                lead={lead} 
                                bgColor="bg-gray-50"
                                onChangeEstado={updateLeadEstado}
                                showSubEstadoSelect
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  leads.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Sin leads</p>
                  ) : (
                    leads.map((lead) => (
                      <LeadCard 
                        key={lead.id} 
                        lead={lead} 
                        bgColor={col.bgCard}
                        onChangeEstado={updateLeadEstado}
                      />
                    ))
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Resumen</h2>
        <div className="grid grid-cols-5 gap-4">
          {COLUMNAS.map((col) => {
            const leads = kanbanData?.[col.id as keyof KanbanData] || [];
            return (
              <div key={col.id} className={`${col.bgCard} rounded-lg p-4 text-center`}>
                <p className="text-3xl font-bold text-gray-800">{leads.length}</p>
                <p className="text-sm text-gray-600">{col.titulo}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LeadCard({ 
  lead, 
  bgColor, 
  onChangeEstado,
  showSubEstadoSelect = false
}: { 
  lead: Lead; 
  bgColor: string;
  onChangeEstado: (id: number, estado: string, subEstado?: string) => void;
  showSubEstadoSelect?: boolean;
}) {
  const prioridadInfo = PRIORIDADES[lead.prioridad || "media"];
  
  return (
    <div className={`${bgColor} rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start mb-2">
        <p className="font-medium text-gray-900 text-sm">{lead.nombre}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded ${prioridadInfo.color}`}>
          {prioridadInfo.label}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-1">📞 {lead.telefono}</p>
      {lead.cliente && (
        <p className="text-xs text-gray-500 mb-1">🏢 {lead.cliente}</p>
      )}
      {lead.vendedorAsignado && (
        <p className="text-xs text-gray-500 mb-1">👤 {lead.vendedorAsignado}</p>
      )}
      {lead.proximoSeguimiento && (
        <p className="text-xs text-orange-600 mb-1">
          📅 Seguimiento: {new Date(lead.proximoSeguimiento).toLocaleDateString('es-AR')}
        </p>
      )}
      
      {showSubEstadoSelect && (
        <select
          className="mt-2 w-full text-xs px-2 py-1 border rounded"
          onChange={(e) => onChangeEstado(lead.id, 'en_seguimiento', e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>Asignar sub-estado...</option>
          {SUB_ESTADOS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      )}
      
      <div className="mt-2 flex flex-wrap gap-1">
        {lead.estadoLead !== 'vendido' && (
          <button 
            onClick={() => onChangeEstado(lead.id, 'vendido')}
            className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            ✓ Vendido
          </button>
        )}
        {lead.estadoLead !== 'no_interesado' && (
          <button 
            onClick={() => onChangeEstado(lead.id, 'no_interesado')}
            className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            ✗ No interesado
          </button>
        )}
        {lead.estadoLead !== 'en_seguimiento' && (
          <button 
            onClick={() => onChangeEstado(lead.id, 'en_seguimiento')}
            className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
          >
            → Seguimiento
          </button>
        )}
      </div>
    </div>
  );
}

export default LeadsKanban;
