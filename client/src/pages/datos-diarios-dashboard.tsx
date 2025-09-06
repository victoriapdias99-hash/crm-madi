import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Save, RefreshCw, Download, Filter, Power, Edit, Eye, X, RotateCcw, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { CPLStorage } from "@/lib/cpl-storage";
import { debounce, memoize, measurePerformance } from "@/lib/performance";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  insertCampanaComercialSchema, 
  type CampanaComercial, 
  type InsertCampanaComercial,
  type Cliente,
  MARCAS_DISPONIBLES,
  ZONAS_DISPONIBLES
} from "@shared/schema";

interface DatosDiariosData {
  cliente: string;
  clienteNombre: string;
  marca: string;
  zona: string;
  diasData: number[];
  enviados: number | string;
  entregadosPorDia: number | string;
  pedidosPorDia: number;
  pedidosTotal: number;
  numeroCampana: number;
  porcentajeDesvio: number;
  porcentajeDatosEnviados: number;
  faltantesAEnviar: number;
  cpl: number;
  ventaPorCampana: number;
  inversionRealizada: number | string;
  inversionPendiente: number | string;
  fechaCampana: string;
  fechaFinReal: string | null;
  fechaFin?: string | null;
  cantidadSolicitada: number;
  cantidadDatosSolicitados?: number;
  diasProcesados: number;
  estadoCampana: string;
  duplicados?: number | string;
  faltantes?: number | string;
  esSuperior100?: boolean;
}

// Función helper para manejar valores que pueden ser números o "-"
const formatNumber = (value: number | string | undefined | null, decimals: number = 2): string => {
  if (value === "-" || value === null || value === undefined) return "-";
  if (typeof value === "string" && value !== "-") {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? "-" : numValue.toFixed(decimals);
  }
  if (typeof value === "number") {
    return value.toFixed(decimals);
  }
  return "-";
};

// Función utilitaria para formatear fechas con hora exacta
const formatDateTimeExact = (dateStr: string | null): string => {
  if (!dateStr || dateStr === 'null') return 'Pendiente';
  
  try {
    // Detectar si ya tiene formato de hora (YYYY-MM-DD HH:mm:ss)
    if (dateStr.includes(' ') && dateStr.length === 19) {
      // Ya tiene formato completo, solo formatear para mostrar
      const [fecha, hora] = dateStr.split(' ');
      const [year, month, day] = fecha.split('-');
      const [hours, minutes] = hora.split(':');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
    
    // Solo fecha (YYYY-MM-DD), estimaremos fin de día
    if (dateStr.length === 10) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year} 23:59`;
    }
    
    return dateStr; // Fallback
  } catch (error) {
    return dateStr || 'Error';
  }
};

// Función para determinar si una campaña tiene conteo activo (números reales vs "-")
const hasActiveCounting = (campaign: DatosDiariosData): boolean => {
  // Una campaña tiene conteo activo si tiene datos numéricos reales
  const enviados = campaign.enviados;
  const entregados = campaign.entregadosPorDia;
  
  // Verificar que enviados sea un número real mayor que 0
  const enviadosActive = (
    enviados !== "-" && 
    enviados !== null && 
    enviados !== undefined && 
    typeof enviados === "number" && 
    enviados > 0
  );
  
  // Verificar que entregados por día sea un número real
  const entregadosActive = (
    entregados !== "-" && 
    entregados !== null && 
    entregados !== undefined && 
    (typeof entregados === "number" || (typeof entregados === "string" && !isNaN(parseFloat(entregados))))
  );
  
  // La campaña tiene conteo activo si al menos uno de estos campos tiene datos reales
  return enviadosActive || entregadosActive;
};

export default function DatosDiariosDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cplValues, setCplValues] = useState<Record<number, number>>({});

  const [forceShowContent, setForceShowContent] = useState(false);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [sortByDate, setSortByDate] = useState<'desc' | 'asc'>('desc'); // Por defecto más reciente primero
  
  // Estados para filtros de Campañas en Proceso
  const [filtroProcesoZona, setFiltroProcesoZona] = useState<string>('');
  const [filtroProcesoMarca, setFiltroProcesoMarca] = useState<string>('');
  const [filtroProcesoCliente, setFiltroProcesoCliente] = useState<string>('');
  const [filtroProcesoFechaInicio, setFiltroProcesoFechaInicio] = useState<string>('');
  const [filtroProcesoFechaFin, setFiltroProcesoFechaFin] = useState<string>('');
  
  // Estados para filtros de Campañas Finalizadas
  const [filtroFinalizadasZona, setFiltroFinalizadasZona] = useState<string>('');
  const [filtroFinalizadasMarca, setFiltroFinalizadasMarca] = useState<string>('');
  const [filtroFinalizadasCliente, setFiltroFinalizadasCliente] = useState<string>('');
  const [filtroFinalizadasFechaInicio, setFiltroFinalizadasFechaInicio] = useState<string>('');
  const [filtroFinalizadasFechaFin, setFiltroFinalizadasFechaFin] = useState<string>('');
  const [filtroMesFinalizadas, setFiltroMesFinalizadas] = useState<string>('all');
  
  // Estados para modal de detalles y acciones
  const [selectedCampaign, setSelectedCampaign] = useState<DatosDiariosData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isClosingCampaign, setIsClosingCampaign] = useState(false);
  const [isReopeningCampaign, setIsReopeningCampaign] = useState(false);
  
  // Estados para loading individual por campaña
  const [closingCampaigns, setClosingCampaigns] = useState<Set<string>>(new Set());
  const [campaignProgress, setCampaignProgress] = useState<Record<string, number>>({});
  const [campaignMessages, setCampaignMessages] = useState<Record<string, string>>({});
  const [websocketConnections, setWebsocketConnections] = useState<Record<string, WebSocket>>({});
  const [isRestoringProgress, setIsRestoringProgress] = useState(false);
  
  // Estado global para controlar si hay alguna campaña procesándose
  const isAnyProcessing = closingCampaigns.size > 0;
  const [showReopenConfirmModal, setShowReopenConfirmModal] = useState(false);
  const [campaignToReopen, setCampaignToReopen] = useState<DatosDiariosData | null>(null);
  const [showCloseCampaignDialog, setShowCloseCampaignDialog] = useState(false);
  const [campaignToClose, setCampaignToClose] = useState<DatosDiariosData | null>(null);
  const [reopenedCampaignIds, setReopenedCampaignIds] = useState<Set<string>>(new Set());
  const [, setLocation] = useLocation();

  // Estados para formulario de edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCampana, setEditingCampana] = useState<CampanaComercial | null>(null);

  // Configurar useForm igual que campanas-management
  const form = useForm<Omit<InsertCampanaComercial, 'fechaFin' | 'numeroCampana'>>({
    resolver: zodResolver(insertCampanaComercialSchema.omit({ fechaFin: true, numeroCampana: true })),
    defaultValues: {
      clienteId: 0,
      cantidadDatosSolicitados: 0,
      marca: "",
      zona: "",
      fechaCampana: "",
      pedidosPorDia: 0,
      facturacionBruta: 0,
    },
  });

  // Fetch clientes para el dropdown - igual que campanas-management
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  // updateMutation exactamente igual que campanas-management
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CampanaComercial> }) => {
      await apiRequest(`/api/campanas-comerciales/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      // Invalidar múltiples queries para actualización inmediata en todos los dashboards
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/finanzas'] });
      setIsEditModalOpen(false);
      setEditingCampana(null);
      toast({ 
        title: "Campaña actualizada exitosamente", 
        description: "Los cambios se reflejarán inmediatamente en Datos Diarios" 
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Error desconocido al actualizar campaña";
      toast({ 
        title: "Error al actualizar campaña", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  });

  // Función onSubmit igual que campanas-management
  const onSubmit = (data: Omit<InsertCampanaComercial, 'fechaFin' | 'numeroCampana'>) => {
    if (editingCampana) {
      updateMutation.mutate({ id: editingCampana.id, data });
    }
  };

  // Función para exportar una campaña individual a CSV
  const handleExportCampanaCSV = async (campana: DatosDiariosData) => {
    const campaignKey = `${campana.cliente}-export`;
    setExportingCSV(true);
    
    try {
      const response = await apiRequest(`/api/export/campana-leads/${encodeURIComponent(campana.cliente)}`, 'GET');
      
      const data = await response.json();
      
      const leads = data.leads || [];
      
      // Generar CSV para esta campaña específica
      const csvContent = generateCSVFromSingleCampana(campana, leads);
      
      // Crear blob y descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // Nombre de archivo específico para la campaña
      const fileName = `${campana.cliente.replace(/\s+/g, '_')}_leads_${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);

      toast({
        title: "Exportación completada",
        description: `${campana.cliente}: ${leads.length} leads exportados correctamente`,
      });

    } catch (error) {
      toast({
        title: "Error en exportación",
        description: `No se pudo exportar CSV para ${campana.cliente}`,
        variant: "destructive",
      });
    } finally {
      setExportingCSV(false);
    }
  };

  // Función para generar contenido CSV de una campaña individual
  const generateCSVFromSingleCampana = (campana: DatosDiariosData, leads: any[]) => {
    const headers = [
      'Campaña',
      'Zona',
      'Fecha Inicio',
      'Fecha Fin',
      'Estado',
      'Total Enviados',
      'Nombre Completo',
      'Teléfono',
      'Email',
      'Ciudad',
      'Marca',
      'Origen',
      'Localización',
      'Cliente Lead',
      'Fecha Lead'
    ];

    let csvContent = headers.join(',') + '\n';

    if (leads.length === 0) {
      // Si no hay leads, agregar una fila con información de la campaña
      csvContent += [
        `"${campana.cliente}"`,
        `"${campana.zona}"`,
        `"${campana.fechaCampana}"`,
        `"${campana.fechaFinReal || 'En proceso'}"`,
        `"${campana.estadoCampana || 'Activa'}"`,
        campana.enviados,
        '"Sin leads disponibles"',
        '""', '""', '""', '""', '""', '""', '""', '""'
      ].join(',') + '\n';
    } else {
      leads.forEach((lead: any) => {
        const nombreCompleto = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Sin nombre';
        const fechaLead = lead.leadDate ? new Date(lead.leadDate).toISOString().split('T')[0] : '';
        
        csvContent += [
          `"${campana.cliente}"`,
          `"${campana.zona}"`,
          `"${campana.fechaCampana}"`,
          `"${campana.fechaFinReal || 'En proceso'}"`,
          `"${campana.estadoCampana || 'Activa'}"`,
          campana.enviados,
          `"${nombreCompleto}"`,
          `"${lead.phone || ''}"`,
          `"${lead.email || ''}"`,
          `"${lead.city || ''}"`,
          `"${lead.campaignName || ''}"`,
          `"${lead.origen || ''}"`,
          `"${lead.localizacion || ''}"`,
          `"${lead.cliente || ''}"`,
          `"${fechaLead}"`
        ].join(',') + '\n';
      });
    }

    return csvContent;
  };

  
  // Función para conectar WebSocket y recibir progreso real
  const connectCampaignWebSocket = useCallback((campaignKey: string): WebSocket => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    // Timeout para cerrar la conexión si no hay respuesta en 2 minutos
    const timeoutId = setTimeout(() => {
      console.warn(`⚠️ WebSocket timeout para ${campaignKey} - cerrando conexión`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, 120000); // 2 minutos

    ws.onopen = () => {
      console.log(`🔗 WebSocket conectado para campaña: ${campaignKey}`);
      // Registrar para recibir eventos de progreso de esta campaña
      ws.send(JSON.stringify({
        type: 'register_campaign_progress',
        campaignKey
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'campaign-progress' && data.campaignKey === campaignKey) {
        console.log(`📡 Progreso recibido: ${data.progress}% - ${data.message}`);
        
        // Actualizar progreso y mensaje desde backend
        setCampaignProgress(prev => ({
          ...prev,
          [campaignKey]: data.progress
        }));
        setCampaignMessages(prev => ({
          ...prev,
          [campaignKey]: data.message
        }));
        
        // Si completó al 100%, limpiar después de mostrar
        if (data.progress >= 100) {
          clearTimeout(timeoutId); // Limpiar timeout ya que completó
          setTimeout(() => {
            setClosingCampaigns(prev => {
              const newSet = new Set(prev);
              newSet.delete(campaignKey);
              return newSet;
            });
            setCampaignProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[campaignKey];
              return newProgress;
            });
            setCampaignMessages(prev => {
              const newMessages = { ...prev };
              delete newMessages[campaignKey];
              return newMessages;
            });
            
            // Cerrar WebSocket
            ws.close();
            setWebsocketConnections(prev => {
              const newConnections = { ...prev };
              delete newConnections[campaignKey];
              return newConnections;
            });
            
            // Refrescar datos automáticamente al completar el proceso
            console.log('🔄 Refrescando datos automáticamente tras completar cierre de campaña');
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
            
            // Refrescar múltiples veces para asegurar actualización
            setTimeout(async () => {
              console.log('🔄 Segundo refrescado - invalidando queries');
              await queryClient.refetchQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
              refetch();
            }, 1000);
            
            setTimeout(async () => {
              console.log('🔄 Tercer refrescado - forzado');
              await queryClient.refetchQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
              refetch();
            }, 3000);
          }, 2000);
        }
      }
    };

    ws.onerror = (error) => {
      console.error(`❌ Error en WebSocket para ${campaignKey}:`, error);
    };

    ws.onclose = () => {
      clearTimeout(timeoutId); // Limpiar timeout al cerrar
      console.log(`🔗 WebSocket desconectado para ${campaignKey}`);
    };

    return ws;
  }, []);

  // Función para recuperar el progreso de campañas al cargar la página
  const restoreProcessingCampaigns = useCallback(async () => {
    try {
      setIsRestoringProgress(true);
      const response = await apiRequest('/api/campaign-closure/processing-status');
      const result = await response.json();
      
      if (result.success && Object.keys(result.processingCampaigns).length > 0) {
        console.log('🔄 Restaurando progreso de campañas:', result.processingCampaigns);
        
        // Restaurar estados de progreso
        const newClosingCampaigns = new Set<string>();
        const newCampaignProgress: Record<string, number> = {};
        const newCampaignMessages: Record<string, string> = {};
        const newConnections: Record<string, WebSocket> = {};
        
        Object.entries(result.processingCampaigns).forEach(([campaignKey, status]: [string, any]) => {
          newClosingCampaigns.add(campaignKey);
          newCampaignProgress[campaignKey] = status.progress;
          newCampaignMessages[campaignKey] = status.message || 'Procesando...';
          
          // Reconectar WebSocket para esta campaña
          const ws = connectCampaignWebSocket(campaignKey);
          newConnections[campaignKey] = ws;
        });
        
        setClosingCampaigns(newClosingCampaigns);
        setCampaignProgress(newCampaignProgress);
        setCampaignMessages(newCampaignMessages);
        setWebsocketConnections(prev => ({ ...prev, ...newConnections }));
      }
    } catch (error) {
      console.error('Error restaurando progreso:', error);
    } finally {
      setIsRestoringProgress(false);
    }
  }, [connectCampaignWebSocket]);

  // Ejecutar al cargar la página
  useEffect(() => {
    restoreProcessingCampaigns();
  }, [restoreProcessingCampaigns]);

  // PostgreSQL optimized query for fast data updates (3s vs 15s)
  const { data: datosDiarios, isLoading, error, refetch } = useQuery<DatosDiariosData[]>({
    queryKey: ['/api/dashboard/datos-diarios-db'],
    refetchInterval: 30 * 1000, // Refresh every 30 seconds (PostgreSQL is fast enough)
    staleTime: 10 * 1000, // Cache for 10 seconds for better performance
    gcTime: 60 * 1000, // Keep in cache for 1 minute
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true, // Refresh when window gets focus
    refetchOnMount: true,
    enabled: true,
    refetchOnReconnect: true,
  });

  // Limpiar actualizaciones optimistas cuando lleguen los datos reales
  useEffect(() => {
    if (datosDiarios && !isLoading) {
      setReopenedCampaignIds(new Set());
    }
  }, [datosDiarios, isLoading]);

  // Mutation para sincronizar todas las pestañas con Smart Sync
  const syncAllSheetsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/sync/smart', 'POST');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sincronización inteligente completada",
        description: data.message || "Sincronización smart ejecutada correctamente",
      });
      // Invalidar queries para refrescar datos (ahora usando PostgreSQL)
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error en sincronización inteligente",
        description: error.message || "No se pudo ejecutar la sincronización smart",
        variant: "destructive",
      });
    }
  });





  // Extraer valores únicos para filtros
  const opcionesZona = useMemo(() => {
    if (!datosDiarios || !Array.isArray(datosDiarios)) return [];
    const zonasSet = new Set(datosDiarios.map((data: DatosDiariosData) => data.zona).filter(Boolean));
    const zonas = Array.from(zonasSet);
    return zonas.sort();
  }, [datosDiarios]);

  const opcionesMarca = useMemo(() => {
    if (!datosDiarios || !Array.isArray(datosDiarios)) return [];
    const marcasSet = new Set(datosDiarios.map((data: DatosDiariosData) => {
      // Extraer marca del nombre del cliente (ej: "JEEP 1" -> "JEEP")
      const match = data.cliente.match(/^([A-Z]+)/);
      return match ? match[1] : data.cliente.split(' ')[0];
    }).filter(Boolean));
    const marcas = Array.from(marcasSet);
    return marcas.sort();
  }, [datosDiarios]);

  const opcionesCliente = useMemo(() => {
    if (!datosDiarios || !Array.isArray(datosDiarios)) return [];
    const clientesSet = new Set(datosDiarios.map((data: DatosDiariosData) => data.clienteNombre).filter(Boolean));
    const clientes = Array.from(clientesSet);
    return clientes.sort();
  }, [datosDiarios]);

  // Memoize filtered and sorted data for performance
  const campanasData = useMemo(() => {
    // Verificar que datosDiarios existe y es un array
    if (!datosDiarios || !Array.isArray(datosDiarios)) {
      return { campanasEnProceso: [], campanasFinalizadas: [] };
    }
    
    measurePerformance('Data filtering and sorting', () => {
      // Performance optimization complete
    });
    
    // Función segura para parsear fechas
    const parseDate = (dateStr: string) => {
      if (!dateStr || dateStr === 'null') return new Date(0); // Fecha por defecto muy antigua
      
      try {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? new Date(0) : date;
      } catch (error) {
        return new Date(0);
      }
    };
    
    // Separar datos iniciales por estado
    const sortedData = datosDiarios.sort((a, b) => {
      // Ordenar por fecha de campaña según el estado sortByDate
      const dateA = parseDate(a.fechaCampana);
      const dateB = parseDate(b.fechaCampana);
      return sortByDate === 'desc' 
        ? dateB.getTime() - dateA.getTime() // Descendente (más reciente primero)
        : dateA.getTime() - dateB.getTime(); // Ascendente (más antigua primero)
    });

    // Separar campañas en proceso y finalizadas SIN filtros
    // Aplicar actualización optimista para campañas reabertas
    const dataWithOptimisticUpdates = sortedData.map(data => {
      const campaignKey = `${data.cliente}-${data.numeroCampana}-${data.marca}-${data.zona}`;
      if (reopenedCampaignIds.has(campaignKey)) {
        return { ...data, fechaFin: null };
      }
      return data;
    });

    const todasEnProceso = dataWithOptimisticUpdates.filter(data => !data.fechaFin);
    const todasFinalizadas = dataWithOptimisticUpdates.filter(data => data.fechaFin);
    
    // FILTRAR CAMPAÑAS EN PROCESO INDEPENDIENTEMENTE
    let campanasEnProcesoFiltradas = todasEnProceso;
    
    if (filtroProcesoZona) {
      campanasEnProcesoFiltradas = campanasEnProcesoFiltradas.filter((data: DatosDiariosData) => data.zona === filtroProcesoZona);
    }
    
    if (filtroProcesoMarca) {
      campanasEnProcesoFiltradas = campanasEnProcesoFiltradas.filter((data: DatosDiariosData) => {
        const marca = data.cliente.match(/^([A-Z]+)/)?.[1] || data.cliente.split(' ')[0];
        return marca === filtroProcesoMarca;
      });
    }
    
    if (filtroProcesoCliente) {
      campanasEnProcesoFiltradas = campanasEnProcesoFiltradas.filter((data: DatosDiariosData) => data.clienteNombre === filtroProcesoCliente);
    }
    
    if (filtroProcesoFechaInicio) {
      campanasEnProcesoFiltradas = campanasEnProcesoFiltradas.filter((data: DatosDiariosData) => 
        data.fechaCampana && data.fechaCampana >= filtroProcesoFechaInicio
      );
    }
    
    if (filtroProcesoFechaFin) {
      campanasEnProcesoFiltradas = campanasEnProcesoFiltradas.filter((data: DatosDiariosData) => 
        data.fechaCampana && data.fechaCampana <= filtroProcesoFechaFin
      );
    }
    
    // Aplicar filtro de duplicados solo a campañas en proceso
    if (showDuplicatesOnly) {
      campanasEnProcesoFiltradas = campanasEnProcesoFiltradas.filter((data: DatosDiariosData) => {
        return (data.duplicados || 0) > 0;
      });
    }
    
    // FILTRAR CAMPAÑAS FINALIZADAS INDEPENDIENTEMENTE
    let campanasFinalizadasFiltradas = todasFinalizadas;
    
    if (filtroFinalizadasZona) {
      campanasFinalizadasFiltradas = campanasFinalizadasFiltradas.filter((data: DatosDiariosData) => data.zona === filtroFinalizadasZona);
    }
    
    if (filtroFinalizadasMarca) {
      campanasFinalizadasFiltradas = campanasFinalizadasFiltradas.filter((data: DatosDiariosData) => {
        const marca = data.cliente.match(/^([A-Z]+)/)?.[1] || data.cliente.split(' ')[0];
        return marca === filtroFinalizadasMarca;
      });
    }
    
    if (filtroFinalizadasCliente) {
      campanasFinalizadasFiltradas = campanasFinalizadasFiltradas.filter((data: DatosDiariosData) => data.clienteNombre === filtroFinalizadasCliente);
    }
    
    if (filtroFinalizadasFechaInicio) {
      campanasFinalizadasFiltradas = campanasFinalizadasFiltradas.filter((data: DatosDiariosData) => 
        data.fechaCampana && data.fechaCampana >= filtroFinalizadasFechaInicio
      );
    }
    
    if (filtroFinalizadasFechaFin) {
      campanasFinalizadasFiltradas = campanasFinalizadasFiltradas.filter((data: DatosDiariosData) => 
        data.fechaCampana && data.fechaCampana <= filtroFinalizadasFechaFin
      );
    }
    
    // Aplicar filtro de mes a finalizadas
    if (filtroMesFinalizadas && filtroMesFinalizadas !== 'all') {
      campanasFinalizadasFiltradas = campanasFinalizadasFiltradas.filter((data: DatosDiariosData) => {
        if (!data.fechaCampana) return false;
        const fechaMes = data.fechaCampana.substring(0, 7); // YYYY-MM
        return fechaMes === filtroMesFinalizadas;
      });
    }
    
    return { campanasEnProceso: campanasEnProcesoFiltradas, campanasFinalizadas: campanasFinalizadasFiltradas };
  }, [datosDiarios, showDuplicatesOnly, sortByDate, filtroProcesoZona, filtroProcesoMarca, filtroProcesoCliente, filtroProcesoFechaInicio, filtroProcesoFechaFin, filtroFinalizadasZona, filtroFinalizadasMarca, filtroFinalizadasCliente, filtroFinalizadasFechaInicio, filtroFinalizadasFechaFin, filtroMesFinalizadas]);

  const { campanasEnProceso, campanasFinalizadas } = campanasData;

  // Lógica para identificar qué campañas finalizadas deben mostrar el botón de reabrir
  // Solo la última campaña cerrada por cada combinación cliente-marca-zona
  const campaignsWithReopenButton = useMemo(() => {
    const campaignGroups = new Map<string, DatosDiariosData[]>();
    
    // Agrupar campañas finalizadas por cliente-marca-zona
    campanasFinalizadas.forEach(campaign => {
      const marca = campaign.cliente.match(/^([A-Z]+)/)?.[1] || campaign.cliente.split(' ')[0];
      const groupKey = `${campaign.clienteNombre}-${marca}-${campaign.zona}`;
      
      if (!campaignGroups.has(groupKey)) {
        campaignGroups.set(groupKey, []);
      }
      campaignGroups.get(groupKey)!.push(campaign);
    });
    
    // Para cada grupo, encontrar la campaña más reciente (última cerrada)
    const latestCampaignIds = new Set<string>();
    
    campaignGroups.forEach((campaigns, groupKey) => {
      if (campaigns.length === 0) return;
      
      // Ordenar por fecha de fin (fechaFin o fechaFinReal) - más reciente primero
      const sortedCampaigns = campaigns.sort((a, b) => {
        const fechaA = a.fechaFin || a.fechaFinReal || '1970-01-01';
        const fechaB = b.fechaFin || b.fechaFinReal || '1970-01-01';
        
        // Si tienen fecha y hora completa, comparar directamente
        if (fechaA.includes(' ') && fechaB.includes(' ')) {
          return new Date(fechaB).getTime() - new Date(fechaA).getTime();
        }
        
        // Si solo tienen fecha (YYYY-MM-DD), añadir hora para comparar
        const dateA = fechaA.includes(' ') ? new Date(fechaA) : new Date(fechaA + ' 23:59:59');
        const dateB = fechaB.includes(' ') ? new Date(fechaB) : new Date(fechaB + ' 23:59:59');
        
        return dateB.getTime() - dateA.getTime();
      });
      
      // La primera campaña en el array ordenado es la más reciente
      const latestCampaign = sortedCampaigns[0];
      const campaignId = `${latestCampaign.cliente}-${latestCampaign.numeroCampana}-${latestCampaign.zona}`;
      latestCampaignIds.add(campaignId);
    });
    
    return latestCampaignIds;
  }, [campanasFinalizadas]);

  const finalData: DatosDiariosData[] = Array.isArray(datosDiarios) ? datosDiarios : [];
  const finalIsLoading = isLoading;

  // Loading state and performance data tracking
  
  // Component state tracking
  useEffect(() => {
    // State updates handled internally
  }, [isLoading, datosDiarios, error]);

  // Cargar duplicados automáticamente cuando se cargan los datos

  // Forzar mostrar contenido después de 8 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceShowContent(true);
    }, 8000);
    
    return () => clearTimeout(timer);
  }, []);

  // Obtener datos de Meta Ads para CPL Real (con manejo de errores)
  const { data: metaCampaigns } = useQuery({
    queryKey: ['/api/meta-ads/campaigns'],
    refetchInterval: 300000, // Refetch every 5 minutes
    retry: false, // No retry Meta Ads if it fails
    enabled: true, // Enable Meta Ads query to show when available
  });

  // Mutación para actualizar todos los datos y mapeos
  const refreshAllDataMutation = useMutation({
    mutationFn: async () => {
      console.log('Iniciando actualización completa de datos...');
      await apiRequest('/api/dashboard/refresh-all-data', 'POST', {});
    },
    onSuccess: () => {
      // Invalidar todas las queries relevantes
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
      
      toast({
        title: "Datos actualizados completamente",
        description: "Se actualizaron todos los datos desde Google Sheets y se remapearon los campos",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar datos",
        description: error?.message || "No se pudieron actualizar los datos",
        variant: "destructive"
      });
    }
  });

  // Mutation para forzar actualización inmediata tras cambios de campañas
  const forceRefreshMutation = useMutation({
    mutationFn: () => apiRequest('/api/dashboard/force-refresh', 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.removeQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      refetch();
      toast({
        title: "🚀 Actualización inmediata completada",
        description: "Los datos se han actualizado reflejando cambios de campañas",
      });
    },
    onError: () => {
      toast({
        title: "Error al forzar actualización",
        description: "Intenta nuevamente en unos segundos",
        variant: "destructive",
      });
    },
  });

  // Mutation para ejecutar cierre de campañas
  const closeCampaignsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/campaign-closure/execute', 'POST');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cierre de campañas completado",
        description: data.message || "Proceso de cierre ejecutado correctamente",
      });
      // Refrescar datos para mostrar campañas cerradas
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
    },
    onError: (error: any) => {
      console.error('Error en cierre de campañas:', error);
      toast({
        title: "Error en cierre de campañas",
        description: error.message || "No se pudo ejecutar el proceso de cierre",
        variant: "destructive",
      });
    }
  });

  const updateCplMutation = useMutation({
    mutationFn: async ({ clienteIndex, cpl, clienteNombre, numeroCampana }: { 
      clienteIndex: number; 
      cpl: number; 
      clienteNombre?: string; 
      numeroCampana?: string; 
    }) => {
      console.log('Updating CPL:', { clienteIndex, cpl, clienteNombre, numeroCampana });
      const response = await apiRequest('/api/dashboard/update-cpl', 'POST', { 
        clienteIndex, 
        cpl, 
        clienteNombre, 
        numeroCampana 
      });
      console.log('CPL update response:', response);
      return { ...response, clienteIndex, cpl };
    },
    onSuccess: (data) => {
      console.log('CPL update successful:', data);
      
      // Actualizar cache localmente para respuesta inmediata
      queryClient.setQueryData(['/api/dashboard/datos-diarios-db'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((item: any, index: number) => {
          if (index === data.clienteIndex) {
            return { ...item, cpl: data.cpl };
          }
          return item;
        });
      });
      
      toast({
        title: "CPL Actualizado",
        description: `CPL actualizado a ARS $${data.cpl.toLocaleString('es-AR')}`,
      });
      
      // Invalidar queries para sincronización completa (PostgreSQL primero)
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
    },
    onError: (error) => {
      console.error('CPL update error:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el CPL",
        variant: "destructive",
      });
    }
  });



  // Función para calcular CPL Real basado en Meta Ads
  const calculateCPLReal = (data: DatosDiariosData) => {
    if (!metaCampaigns || !Array.isArray(metaCampaigns) || data.enviados === 0 || data.enviados === "-") {
      return 0;
    }

    // Mapear marcas para encontrar campaña correspondiente
    const brandMap: Record<string, string[]> = {
      'Fiat': ['fiat'],
      'Peugeot': ['peugeot'],
      'Toyota': ['toyota'], 
      'Chevrolet': ['chevrolet'],
      'Renault': ['renault'],
      'Citroen': ['citroen', 'citroën']
    };

    // Extraer marca del nombre del cliente (con validación de seguridad)
    let detectedBrand = '';
    for (const [brand, keywords] of Object.entries(brandMap)) {
      if (keywords.some(keyword => 
        (data.cliente && data.cliente.toLowerCase().includes(keyword)) || 
        (data.clienteNombre && data.clienteNombre.toLowerCase().includes(keyword))
      )) {
        detectedBrand = brand;
        break;
      }
    }

    if (!detectedBrand) return 0;

    // Encontrar campaña Meta Ads que coincida con la marca
    const matchingCampaign = metaCampaigns.find((campaign: any) => 
      brandMap[detectedBrand].some(keyword => 
        campaign.campaignName?.toLowerCase().includes(keyword)
      )
    );

    if (matchingCampaign && matchingCampaign.spend > 0) {
      // CPL Real = Gasto total Meta Ads / Datos enviados
      return matchingCampaign.spend / (typeof data.enviados === 'number' ? data.enviados : 0);
    }

    return 0;
  };

  const mapearCampanasMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/dashboard/mapear-campanas', 'POST');
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Mapeo Exitoso",
        description: `Se mapearon ${data.mapped || 0} campañas con datos diarios`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
    },
    onError: (error) => {
      console.error('Mapeo error:', error);
      toast({
        title: "Error",
        description: "No se pudo realizar el mapeo de campañas",
        variant: "destructive",
      });
    }
  });

  // Memoized calculation for inversions - Performance Optimization with NaN protection
  const calculateInversions = useMemo(() => memoize((data: DatosDiariosData, cpl: number) => {
    const safeCpl = isNaN(cpl) || !cpl ? 0 : cpl;
    const safeEnviados = isNaN(data.enviados) || !data.enviados || data.enviados === "-" ? 0 : data.enviados;
    const safePedidosTotal = isNaN(data.pedidosTotal) || !data.pedidosTotal ? 0 : data.pedidosTotal;
    const safePorcentaje = isNaN(data.porcentajeDatosEnviados) || !data.porcentajeDatosEnviados ? 0 : data.porcentajeDatosEnviados;
    
    const inversionRealizada = safeEnviados * safeCpl * 1.02; // +2% impuestos
    const faltantes = Math.max(0, safePedidosTotal - safeEnviados);
    const inversionPendiente = safePorcentaje >= 100 ? 0 : faltantes * safeCpl * 1.02;
    
    // Corregir porcentaje de desvío: (Pedidos Total - Enviados) / Enviados × 100
    const porcentajeDesvio = safeEnviados > 0 ? ((safePedidosTotal - safeEnviados) / safeEnviados) * 100 : 0;
    
    return {
      inversionRealizada: isNaN(inversionRealizada) ? 0 : inversionRealizada,
      inversionPendiente: isNaN(inversionPendiente) ? 0 : inversionPendiente,
      faltantes: isNaN(faltantes) ? 0 : faltantes,
      porcentajeDesvio: isNaN(porcentajeDesvio) ? 0 : porcentajeDesvio
    };
  }), []);

  // Función para extraer marca del nombre del cliente
  const extractMarca = (clienteNombre: string): string => {
    const marcaMap: Record<string, string> = {
      'PEUGEOT': 'Peugeot',
      'TOYOTA': 'Toyota',
      'VW': 'Volkswagen',
      'FIAT': 'Fiat',
      'FORD': 'Ford',
      'JEEP': 'Jeep',
      'CHEVROLET': 'Chevrolet',
      'CITROEN': 'Citroën',
      'RENAULT': 'Renault'
    };
    
    // Buscar marcas conocidas en cualquier parte del nombre (case insensitive)
    const nombreUpper = clienteNombre.toUpperCase();
    for (const [key, value] of Object.entries(marcaMap)) {
      if (nombreUpper.includes(key)) {
        return value;
      }
    }
    
    // Si no encuentra marca conocida, usar la primera palabra
    const match = clienteNombre.match(/^([A-Z]+)/);
    const marcaKey = match ? match[1] : clienteNombre.split(' ')[0].toUpperCase();
    return marcaMap[marcaKey] || marcaKey;
  };

  // Debounced CPL input handling for better performance
  const handleCplChange = useCallback(
    debounce((index: number, value: string) => {
      const numValue = parseFloat(value) || 0;
      setCplValues(prev => ({ ...prev, [index]: numValue }));
    }, 300),
    []
  );



  const handleSaveCpl = (index: number) => {
    const cpl = cplValues[index];
    const data = datosDiarios?.[index];
    
    console.log('Attempting to save CPL:', { index, cpl, data });
    if (cpl && cpl > 0 && data) {
      updateCplMutation.mutate({ 
        clienteIndex: index, 
        cpl,
        clienteNombre: data.cliente,
        numeroCampana: data.numeroCampana.toString()
      });
      // Clear the input after saving
      setCplValues(prev => {
        const newValues = { ...prev };
        delete newValues[index];
        return newValues;
      });
    } else {
      toast({
        title: "Error",
        description: "Por favor ingrese un CPL válido",
        variant: "destructive",
      });
    }
  };



  const clearAllManualValues = () => {
    setCplValues({});
    toast({
      title: "Valores restablecidos",
      description: "Todos los valores manuales han sido eliminados",
    });
  };

  // Mutation unificada que ejecuta todas las acciones de actualización
  const unifiedUpdateMutation = useMutation({
    mutationFn: async () => {
      console.log('Iniciando actualización unificada completa...');
      
      // Secuencia de actualizaciones:
      // 1. Forzar actualización inmediata
      await apiRequest('/api/dashboard/force-refresh', 'POST', {});
      
      // 2. Mapear campañas
      await apiRequest('/api/dashboard/mapear-campanas', 'POST');
      
      // 3. Actualizar todos los datos (incluye recálculo automático de enviados)
      await apiRequest('/api/dashboard/refresh-all-data', 'POST', {});
      
      return { success: true };
    },
    onSuccess: () => {
      // Invalidar todas las queries relevantes para recargar datos frescos (PostgreSQL primero)
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
      
      // Forzar recarga manual
      queryClient.removeQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      queryClient.removeQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      refetch();
      
      toast({
        title: "🚀 Actualización completa exitosa",
        description: "Todos los datos han sido actualizados: Google Sheets, campañas mapeadas y sincronización completa",
      });
    },
    onError: (error: any) => {
      console.error('Error en actualización unificada:', error);
      toast({
        title: "Error en actualización",
        description: error?.message || "No se pudieron actualizar todos los datos. Algunos cambios pueden haberse aplicado.",
        variant: "destructive"
      });
    }
  });

  // Función handler para el botón unificado
  const handleUnifiedUpdate = () => {
    unifiedUpdateMutation.mutate();
  };

  // Funciones para manejar las acciones de campañas
  const handleViewDetails = (campaign: DatosDiariosData) => {
    setSelectedCampaign(campaign);
    setIsDetailsModalOpen(true);
  };

  const handleCloseCampaign = (campaign: DatosDiariosData) => {
    setCampaignToClose(campaign);
    setShowCloseCampaignDialog(true);
  };


  const handleCloseCampaignInline = async (campaign: DatosDiariosData) => {
    const campaignKey = `${campaign.cliente}-${campaign.numeroCampana}`;
    
    // Inicializar estado de cierre
    setClosingCampaigns(prev => new Set(prev).add(campaignKey));
    setCampaignProgress(prev => ({ ...prev, [campaignKey]: 0 }));
    setCampaignMessages(prev => ({ ...prev, [campaignKey]: 'Iniciando...' }));
    
    // Conectar WebSocket para progreso en tiempo real
    const ws = connectCampaignWebSocket(campaignKey);
    setWebsocketConnections(prev => ({
      ...prev,
      [campaignKey]: ws
    }));
    
    try {
      // Usar el nombre técnico del cliente (clienteNombre en minúsculas)
      const technicalClientName = campaign.clienteNombre.toLowerCase();
      
      // Hacer la llamada API con campaignKey para tracking y número de campaña específico
      const response = await apiRequest('/api/campaign-closure/execute', 'POST', {
        clients: technicalClientName,  // Nombre técnico en minúsculas
        campaignKey: campaignKey,  // Backend usará esto para emitir progreso
        campaignNumber: campaign.numeroCampana.toString(), // Número específico de campaña
        dryRun: false
      });
      
      
      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: "Campaña cerrada exitosamente",
          description: `${result.campaignsClosed || 0} campañas cerradas, ${result.leadsAssigned || 0} leads asignados`,
        });
        
        // Refrescar datos
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al cerrar la campaña');
      }
    } catch (error) {
      console.error('Error closing campaign:', error);
      
      // Mostrar error y limpiar estados
      setCampaignProgress(prev => ({ ...prev, [campaignKey]: 100 }));
      setCampaignMessages(prev => ({ ...prev, [campaignKey]: 'Error al procesar' }));
      
      toast({
        title: "Error al cerrar campaña",
        description: error.message || "No se pudo cerrar la campaña. Intenta nuevamente.",
        variant: "destructive",
      });
      
      // Cerrar WebSocket en caso de error
      ws.close();
      setWebsocketConnections(prev => {
        const newConnections = { ...prev };
        delete newConnections[campaignKey];
        return newConnections;
      });
      
      // Limpiar estados después de mostrar error
      setTimeout(() => {
        setClosingCampaigns(prev => {
          const newSet = new Set(prev);
          newSet.delete(campaignKey);
          return newSet;
        });
        setCampaignProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[campaignKey];
          return newProgress;
        });
        setCampaignMessages(prev => {
          const newMessages = { ...prev };
          delete newMessages[campaignKey];
          return newMessages;
        });
        
        // Refrescar datos automáticamente al completar el proceso con error
        console.log('🔄 Refrescando datos tras error en cierre de campaña');
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
        refetch();
      }, 2000);
    }
  };

  const confirmCloseCampaign = async () => {
    if (!campaignToClose) return;
    
    // Cerrar el dialog inmediatamente
    setShowCloseCampaignDialog(false);
    
    // Usar la función handleCloseCampaignInline que ya tiene toda la lógica del WebSocket y progress
    await handleCloseCampaignInline(campaignToClose);
    
    // Limpiar estados
    setCampaignToClose(null);
    setIsClosingCampaign(false);
  };

  const handleEditCampaign = (campaign: DatosDiariosData) => {
    // Abrir modal de edición inline en lugar de navegar
    setSelectedCampaign(campaign);
    setIsDetailsModalOpen(true);
  };

  const handleReopenCampaign = async (campaign: DatosDiariosData) => {
    setIsReopeningCampaign(true);
    console.log('🚀 Iniciando reapertura de campaña:', campaign);
    try {
      // Buscar la campaña por numeroCampana en campanas-comerciales
      const campanasResponse = await apiRequest('/api/campanas-comerciales', 'GET');
      if (!campanasResponse.ok) {
        throw new Error('No se pudieron cargar las campañas');
      }
      
      const campanas = await campanasResponse.json();
      // Función para normalizar zonas (eliminar acentos, convertir a minúsculas, etc.)
      const normalizarZona = (zona: string) => {
        return zona
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
          .replace(/\s+/g, '') // Eliminar espacios
          .trim();
      };

      // Mapeo específico para casos conocidos
      const normalizarZonaEspecial = (zona: string) => {
        const zonaLower = zona.toLowerCase();
        if (zonaLower === 'nacional' || zonaLower === 'pais') return 'nacional';
        if (zonaLower === 'amba') return 'amba';
        return normalizarZona(zona);
      };

      const campanaEncontrada = campanas.find((c: any) => 
        c.numeroCampana === campaign.numeroCampana.toString() && 
        c.marca.toLowerCase() === campaign.marca.toLowerCase() &&
        normalizarZonaEspecial(c.zona) === normalizarZonaEspecial(campaign.zona)
      );
      
      if (!campanaEncontrada) {
        throw new Error('No se encontró la campaña en campanas-comerciales');
      }
      
      // Reabrir la campaña (eliminar fecha_fin) y liberar leads
      const response = await apiRequest(`/api/campanas-comerciales/${campanaEncontrada.id}/reopen`, 'PUT', {
        campaignId: campanaEncontrada.id
      });
      
      if (response.ok) {
        // Actualización optimista: mover la campaña inmediatamente
        const campaignKey = `${campaign.cliente}-${campaign.numeroCampana}-${campaign.marca}-${campaign.zona}`;
        setReopenedCampaignIds(prev => new Set([...prev, campaignKey]));
        
        toast({
          title: "Campaña reabierta exitosamente",
          description: `La campaña ${campaign.cliente} #${campaign.numeroCampana} ha sido reabierta y liberada completamente`,
        });
        
        // Refrescar datos del dashboard inmediatamente para mostrar cambios
        await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
        await queryClient.refetchQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      } else {
        throw new Error('Error al reabrir la campaña');
      }
    } catch (error) {
      console.error('Error reopening campaign:', error);
      toast({
        title: "Error",
        description: "No se pudo reabrir la campaña. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsReopeningCampaign(false);
    }
  };

  // Función para abrir el formulario de edición - igual que campanas-management
  const handleOpenEditForm = async (campaign: DatosDiariosData) => {
    try {
      // Buscar la campaña por numeroCampana en campanas-comerciales
      const campanasResponse = await apiRequest('/api/campanas-comerciales', 'GET');
      if (!campanasResponse.ok) {
        throw new Error('No se pudieron cargar las campañas');
      }
      
      const campanas = await campanasResponse.json();
      // Función para normalizar zonas (eliminar acentos, convertir a minúsculas, etc.)
      const normalizarZona = (zona: string) => {
        return zona
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
          .replace(/\s+/g, '') // Eliminar espacios
          .trim();
      };

      // Mapeo específico para casos conocidos
      const normalizarZonaEspecial = (zona: string) => {
        const zonaLower = zona.toLowerCase();
        if (zonaLower === 'nacional' || zonaLower === 'pais') return 'nacional';
        if (zonaLower === 'amba') return 'amba';
        return normalizarZona(zona);
      };

      const campanaEncontrada = campanas.find((c: any) => 
        c.numeroCampana === campaign.numeroCampana.toString() && 
        c.marca.toLowerCase() === campaign.marca.toLowerCase() &&
        normalizarZonaEspecial(c.zona) === normalizarZonaEspecial(campaign.zona)
      );
      
      if (!campanaEncontrada) {
        throw new Error('No se encontró la campaña en campanas-comerciales');
      }
      
      // Configurar campaña para edición
      setEditingCampana(campanaEncontrada);
      
      // Resetear el formulario con los datos de la campaña encontrada
      form.reset({
        clienteId: campanaEncontrada.clienteId,
        cantidadDatosSolicitados: campanaEncontrada.cantidadDatosSolicitados,
        marca: campanaEncontrada.marca,
        zona: campanaEncontrada.zona,
        fechaCampana: campanaEncontrada.fechaCampana || "",
        pedidosPorDia: campanaEncontrada.pedidosPorDia || 0,
        facturacionBruta: campanaEncontrada.facturacionBruta || 0,
        localizacion: campanaEncontrada.localizacion || "",
      });
      
      setIsDetailsModalOpen(false);
      setIsEditModalOpen(true);
    } catch (error) {
      console.error('Error loading campaña for edit:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la campaña para editar",
        variant: "destructive",
      });
    }
  };

  if (finalIsLoading && !datosDiarios) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
          <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">Cargando datos diarios...</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">Procesando registros...</p>
          <div className="mt-4 text-xs text-gray-500">
            Backend Status: {error ? 'Error' : 'OK'} | Loading: {isLoading ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Navigation />
        <div className="flex items-center justify-between">
          <div className="relative">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Dashboard - Datos Diarios
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg font-medium">
              🚀 Gestión de campañas Meta Ads con datos reales de Google Sheets
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-600 font-medium">Datos actualizándose cada 30 segundos</span>
            </div>
            <div className="absolute -top-2 -left-2 w-24 h-24 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full opacity-10 animate-pulse"></div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => syncAllSheetsMutation.mutate()}
              disabled={syncAllSheetsMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold shadow-xl transform hover:scale-105 transition-all duration-300 px-4 py-3"
              size="lg"
              data-testid="button-sync-sheets"
            >
              {syncAllSheetsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar Pestañas
            </Button>


            <Button
              onClick={handleUnifiedUpdate}
              disabled={unifiedUpdateMutation.isPending}
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white font-bold shadow-xl transform hover:scale-105 transition-all duration-300 px-6 py-3"
              size="lg"
            >
              {unifiedUpdateMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-3 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5 mr-3" />
              )}
              Actualizar Todo
            </Button>
          </div>
        </div>


        {/* Campañas en Proceso */}
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-white via-amber-50 to-orange-50 dark:from-gray-800 dark:via-amber-900/10 dark:to-orange-900/10">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
            <div className="space-y-4">
              <CardTitle className="flex items-center gap-3 flex-wrap">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  🚀
                </div>
                <span className="text-xl font-bold">Campañas en Proceso</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 font-bold">
                  {campanasEnProceso.length} en progreso
                </Badge>
                <Button
                  onClick={() => setSortByDate(sortByDate === 'desc' ? 'asc' : 'desc')}
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-all duration-300 text-sm"
                  data-testid="button-sort-by-date"
                >
                  📅 {sortByDate === 'desc' ? 'Más reciente primero ↓' : 'Más antigua primero ↑'}
                </Button>
                <Button
                  onClick={() => {
                    setShowDuplicatesOnly(!showDuplicatesOnly);
                  }}
                  variant="secondary"
                  size="sm"
                  disabled={false}
                  className={`border-white/30 hover:bg-white/30 transition-all duration-300 ${
                    showDuplicatesOnly 
                      ? 'bg-red-500/80 text-white border-red-300' 
                      : 'bg-white/20 text-white'
                  }`}
                >
                  🔍 Datos Duplicados {showDuplicatesOnly ? '(Activo)' : ''}
                </Button>
              </CardTitle>
              
              {/* Controles de filtro */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Filtros:</span>
                </div>
                
                <Select value={filtroProcesoZona || "all"} onValueChange={(value) => setFiltroProcesoZona(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-proceso-zona">
                    <SelectValue placeholder="Todas las zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las zonas</SelectItem>
                    {opcionesZona.map(zona => (
                      <SelectItem key={zona} value={zona}>{zona}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroProcesoMarca || "all"} onValueChange={(value) => setFiltroProcesoMarca(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-proceso-marca">
                    <SelectValue placeholder="Todas las marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las marcas</SelectItem>
                    {opcionesMarca.map(marca => (
                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroProcesoCliente || "all"} onValueChange={(value) => setFiltroProcesoCliente(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-48 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-proceso-cliente">
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {opcionesCliente.map(cliente => (
                      <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={filtroProcesoFechaInicio}
                  onChange={(e) => setFiltroProcesoFechaInicio(e.target.value)}
                  className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 placeholder:text-white/60 text-sm"
                  data-testid="filter-proceso-fecha-inicio"
                />

                <Input
                  type="date"
                  value={filtroProcesoFechaFin}
                  onChange={(e) => setFiltroProcesoFechaFin(e.target.value)}
                  className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 placeholder:text-white/60 text-sm"
                  data-testid="filter-proceso-fecha-fin"
                />

                {(filtroProcesoZona || filtroProcesoMarca || filtroProcesoCliente || filtroProcesoFechaInicio || filtroProcesoFechaFin) && (
                  <Button
                    onClick={() => {
                      setFiltroProcesoZona('');
                      setFiltroProcesoMarca('');
                      setFiltroProcesoCliente('');
                      setFiltroProcesoFechaInicio('');
                      setFiltroProcesoFechaFin('');
                    }}
                    variant="secondary"
                    size="sm"
                    className="bg-red-500/80 hover:bg-red-600/80 text-white border-red-300 text-sm"
                    data-testid="button-clear-filters-proceso"
                  >
                    ✕ Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Acciones</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-left font-semibold text-amber-900 dark:text-amber-100">Cliente</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-left font-semibold text-amber-900 dark:text-amber-100">Marca</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-left font-semibold text-amber-900 dark:text-amber-100">Zona</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Fecha de Inicio</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Pedidos Total</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Enviados</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Duplicados</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Entregados/día</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Pedidos/día</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">% Desvío</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">% Datos Enviados</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Faltantes</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">CPA Meta Ads</th>
                    {showDuplicatesOnly && (
                      <th className="border border-red-200 dark:border-red-600 p-3 text-center font-semibold text-red-900 dark:text-red-100">
                        🔍 Duplicados
                      </th>
                    )}
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">CPL Guardado</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Inversión Realizada</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Inversión Pendiente</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Exportar CSV</th>
                  </tr>
                </thead>
                <tbody>
                  {campanasEnProceso.map((data: DatosDiariosData, index: number) => {
                    // Crear key único usando múltiples identificadores para evitar duplicados
                    const uniqueKey = `${data.cliente}-${data.numeroCampana}-${data.zona}-${index}-${data.fechaCampana || 'no-fecha'}`;
                    
                    const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0; // Use CPL from storage or server
                    
                    // Usar el porcentaje calculado correctamente desde el backend
                    const porcentajeReal = data.porcentajeDatosEnviados || 0;
                    const esSuperior100 = porcentajeReal > 100;
                    
                    const updatedData = {
                      ...data,
                      faltantesAEnviar: esSuperior100 ? 0 : Math.max(0, (data.pedidosTotal || data.cantidadSolicitada || 0) - data.enviados),
                      porcentajeDatosEnviados: porcentajeReal, // Usar valor del backend directamente
                      esSuperior100: esSuperior100
                    };
                    
                    const inversions = calculateInversions(updatedData, currentCpl);
                    
                    return (
                      <tr key={uniqueKey} className="hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/10 dark:hover:to-orange-900/10 transition-all duration-300">
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="flex justify-center">
                            {(() => {
                              const campaignKey = `${data.cliente}-${data.numeroCampana}`;
                              const isProcessing = closingCampaigns.has(campaignKey);
                              const progress = campaignProgress[campaignKey] || 0;
                              const message = campaignMessages[campaignKey] || 'Procesando...';
                              
                              if (isProcessing) {
                                // Mostrar progress bar compacto con mensaje y porcentaje
                                return (
                                  <div className="flex flex-col items-center gap-1 px-2 w-28">
                                    <Progress 
                                      value={progress} 
                                      className="w-24 h-2" 
                                      data-testid={`progress-${data.cliente.replace(/\s+/g, '-')}`}
                                    />
                                    <div className="text-xs text-center w-full">
                                      <div className="text-blue-600 dark:text-blue-400 font-medium truncate">
                                        {message}
                                      </div>
                                      <div className="text-gray-500 dark:text-gray-400 font-semibold">
                                        {Math.round(progress)}%
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="flex justify-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        data-testid={`dropdown-actions-${data.cliente.replace(/\s+/g, '-')}`}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => handleViewDetails(data)}
                                        className="cursor-pointer"
                                        data-testid={`menu-view-details-${data.cliente.replace(/\s+/g, '-')}`}
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        Visualizar Campaña
                                      </DropdownMenuItem>
                                      {/* Mostrar opción de cerrar o mensaje de espera */}
                                      {hasActiveCounting(data) && (
                                        isAnyProcessing ? (
                                          <DropdownMenuItem
                                            disabled={true}
                                            className="cursor-not-allowed text-orange-500 focus:text-orange-500"
                                          >
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Cerrando campaña. Espere
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem
                                            onClick={() => handleCloseCampaign(data)}
                                            disabled={isClosingCampaign}
                                            className="cursor-pointer text-red-600 focus:text-red-600"
                                            data-testid={`menu-close-campaign-${data.cliente.replace(/\s+/g, '-')}`}
                                          >
                                            {isClosingCampaign ? (
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                              <Power className="mr-2 h-4 w-4" />
                                            )}
                                            Cerrar Campaña
                                          </DropdownMenuItem>
                                        )
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{data.clienteNombre}</div>
                            <div className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-1 rounded-full font-semibold w-fit">
                              #{data.numeroCampana || 1}
                            </div>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3">
                          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-2 rounded-lg text-center">
                            <span className="font-semibold text-indigo-700 dark:text-indigo-300">{extractMarca(data.cliente)}</span>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 font-medium text-slate-700 dark:text-slate-300">{data.zona}</td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-2 rounded-lg">
                            <div className="space-y-1">
                              <span className="font-medium text-green-700 dark:text-green-300 block">
                                {data.fechaCampana || 'N/A'}
                              </span>
                              {/* Fecha de fin se mostrará solo si existe fechaFinReal - sin lógica automática */}
                              {data.fechaFinReal && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                  Fin: {formatDateTimeExact(data.fechaFinReal)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="font-bold text-purple-700 dark:text-purple-300">{data.pedidosTotal || 0}</span>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-2 rounded-lg">
                            <span className="font-bold text-blue-700 dark:text-blue-300">{data.enviados}</span>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-2 rounded-lg">
                            <span className="font-bold text-orange-700 dark:text-orange-300">
                              {data.duplicados || 0}
                            </span>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {formatNumber(data.entregadosPorDia, 2)}
                          </span>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-2 rounded-lg">
                            <span className="font-medium text-blue-600 dark:text-blue-300">{formatNumber(data.pedidosPorDia, 2)}</span>
                            <div className="text-xs text-blue-500 mt-1">De campaña</div>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <Badge 
                            variant={inversions.porcentajeDesvio && inversions.porcentajeDesvio < 0 ? "destructive" : "default"}
                            className={`font-bold ${inversions.porcentajeDesvio && inversions.porcentajeDesvio < 0 
                              ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white' 
                              : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            }`}
                          >
                            {formatNumber(inversions.porcentajeDesvio, 2)}%
                          </Badge>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-24 h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full overflow-hidden shadow-inner">
                              <div 
                                className={`h-full transition-all duration-500 shadow-lg ${
                                  updatedData.esSuperior100 
                                    ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-600' 
                                    : 'bg-gradient-to-r from-amber-400 via-orange-500 to-red-500'
                                }`}
                                style={{ width: `${Math.min(updatedData.porcentajeDatosEnviados || 0, 100)}%` }}
                              />
                            </div>
                            <Badge className={`font-bold text-xs ${
                              updatedData.esSuperior100 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                            }`}>
                              {formatNumber(updatedData.porcentajeDatosEnviados, 1)}%
                              {updatedData.esSuperior100 && <span className="ml-1">✓</span>}
                            </Badge>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="font-bold text-red-700 dark:text-red-300">{data.faltantes ?? 0}</span>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          {(data as any).cpa > 0 ? (
                            <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold shadow-lg">
                              ARS ${((data as any).cpa).toLocaleString('es-AR')}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">Calculando...</span>
                          )}
                        </td>
                        {showDuplicatesOnly && (
                          <td className="border border-red-200 dark:border-red-600 p-3 text-center">
                            <div className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-800/50 dark:to-pink-800/50 p-2 rounded-lg">
                              <span className="font-bold text-red-700 dark:text-red-300">
                                {data.duplicados || 0}
                              </span>
                              {(data.duplicados || 0) > 0 && (
                                <div className="text-xs text-red-500 mt-1">teléfonos</div>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          {currentCpl > 0 ? (
                            <Badge variant="secondary" className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold shadow-lg">
                              ARS ${currentCpl.toLocaleString('es-AR')}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">Sin CPL</span>
                          )}
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center font-medium">
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-2 rounded-lg">
                            <span className="text-green-700 dark:text-green-300 font-bold">
                              ARS ${inversions.inversionRealizada.toLocaleString('es-AR')}
                            </span>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center font-medium">
                          {(() => {
                            const cplReal = calculateCPLReal(data);
                            const metaAdsAmount = cplReal > 0 ? Math.round(cplReal * data.enviados) : inversions.inversionPendiente;
                            return (
                              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-2 rounded-lg">
                                <span className="text-orange-700 dark:text-orange-300 font-bold">
                                  ARS ${metaAdsAmount.toLocaleString('es-AR')}
                                </span>
                                {cplReal > 0 && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Meta Ads Data</div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <Button
                            onClick={() => handleExportCampanaCSV(data)}
                            disabled={exportingCSV}
                            size="sm"
                            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold shadow-lg"
                            data-testid={`button-export-csv-${data.cliente.replace(/\s+/g, '-')}`}
                          >
                            {exportingCSV ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila de Totales - Campañas en Proceso */}
                  {campanasEnProceso.length > 0 && (
                    <tr className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-800/50 dark:to-orange-800/50 border-t-4 border-amber-500">
                      <td className="border border-amber-200 dark:border-amber-600 p-3 text-center font-bold text-amber-900 dark:text-amber-100">
                        —
                      </td>
                      <td colSpan={showDuplicatesOnly ? 13 : 12} className="border border-amber-200 dark:border-amber-600 p-3 text-center font-bold text-amber-900 dark:text-amber-100 text-lg">
                        TOTAL CAMPAÑAS EN PROCESO
                      </td>
                      <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                        <div className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-800/50 dark:to-pink-800/50 p-2 rounded-lg">
                          <span className="font-bold text-red-700 dark:text-red-300">
                            {campanasEnProceso.reduce((sum: number, data: DatosDiariosData) => {
                              const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                              const inversions = calculateInversions(data, currentCpl);
                              return sum + inversions.faltantes;
                            }, 0)}
                          </span>
                        </div>
                      </td>
                      {showDuplicatesOnly && (
                        <td className="border border-red-200 dark:border-red-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-800/50 dark:to-pink-800/50 p-2 rounded-lg">
                            <span className="font-bold text-red-700 dark:text-red-300">
                              {campanasEnProceso.reduce((sum: number, data: DatosDiariosData) => {
                                const duplicados = data.duplicados === "-" ? 0 : (data.duplicados || 0);
                                return sum + duplicados;
                              }, 0)}
                            </span>
                            <div className="text-xs text-red-500 mt-1">Total</div>
                          </div>
                        </td>
                      )}
                      <td className="border border-amber-200 dark:border-amber-600 p-3 text-center font-bold text-amber-900 dark:text-amber-100">
                        —
                      </td>
                      <td className="border border-amber-200 dark:border-amber-600 p-3 text-center font-medium">
                        <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-800/50 dark:to-emerald-800/50 p-2 rounded-lg">
                          <span className="text-green-700 dark:text-green-300 font-bold">
                            ARS ${campanasEnProceso.reduce((sum: number, data: DatosDiariosData) => {
                              const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                              const inversions = calculateInversions(data, currentCpl);
                              return sum + inversions.inversionRealizada;
                            }, 0).toLocaleString('es-AR')}
                          </span>
                        </div>
                      </td>
                      <td className="border border-amber-200 dark:border-amber-600 p-3 text-center font-medium">
                        <div className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-800/50 dark:to-red-800/50 p-2 rounded-lg">
                          <span className="text-orange-700 dark:text-orange-300 font-bold">
                            ARS ${campanasEnProceso.reduce((sum: number, data: DatosDiariosData) => {
                              const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                              const inversions = calculateInversions(data, currentCpl);
                              const cplReal = calculateCPLReal(data);
                              const enviados = typeof data.enviados === 'number' ? data.enviados : 0;
                              const metaAdsAmount = cplReal > 0 ? Math.round(cplReal * enviados) : inversions.inversionPendiente;
                              return sum + metaAdsAmount;
                            }, 0).toLocaleString('es-AR')}
                          </span>
                        </div>
                      </td>
                      <td className="border border-amber-200 dark:border-amber-600 p-3 text-center font-bold text-amber-900 dark:text-amber-100">
                        —
                      </td>
                      <td className="border border-amber-200 dark:border-amber-600 p-3 text-center font-bold text-amber-900 dark:text-amber-100">
                        —
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {campanasEnProceso.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay campañas en proceso actualmente
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campañas Finalizadas */}
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-white via-emerald-50 to-green-50 dark:from-gray-800 dark:via-emerald-900/10 dark:to-green-900/10">
          <CardHeader className="bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-t-lg">
            <div className="space-y-4">
              <CardTitle className="flex items-center gap-3 flex-wrap">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  ✅
                </div>
                <span className="text-xl font-bold">Campañas Finalizadas</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 font-bold">
                  {campanasFinalizadas.length} completadas
                </Badge>
              </CardTitle>
              
              {/* Controles de filtro para finalizadas */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Filtros:</span>
                </div>
                
                <Select value={filtroFinalizadasZona || "all"} onValueChange={(value) => setFiltroFinalizadasZona(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-finalizadas-zona">
                    <SelectValue placeholder="Todas las zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las zonas</SelectItem>
                    {opcionesZona.map(zona => (
                      <SelectItem key={zona} value={zona}>{zona}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroFinalizadasMarca || "all"} onValueChange={(value) => setFiltroFinalizadasMarca(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-finalizadas-marca">
                    <SelectValue placeholder="Todas las marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las marcas</SelectItem>
                    {opcionesMarca.map(marca => (
                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroFinalizadasCliente || "all"} onValueChange={(value) => setFiltroFinalizadasCliente(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-48 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-finalizadas-cliente">
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {opcionesCliente.map(cliente => (
                      <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={filtroFinalizadasFechaInicio}
                  onChange={(e) => setFiltroFinalizadasFechaInicio(e.target.value)}
                  className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 placeholder:text-white/60 text-sm"
                  data-testid="filter-finalizadas-fecha-inicio"
                />

                <Input
                  type="date"
                  value={filtroFinalizadasFechaFin}
                  onChange={(e) => setFiltroFinalizadasFechaFin(e.target.value)}
                  className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 placeholder:text-white/60 text-sm"
                  data-testid="filter-finalizadas-fecha-fin"
                />
                
                <Select value={filtroMesFinalizadas} onValueChange={setFiltroMesFinalizadas}>
                  <SelectTrigger className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-mes-finalizadas">
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los meses</SelectItem>
                    <SelectItem value="2025-01">Enero 2025</SelectItem>
                    <SelectItem value="2025-02">Febrero 2025</SelectItem>
                    <SelectItem value="2025-03">Marzo 2025</SelectItem>
                    <SelectItem value="2025-04">Abril 2025</SelectItem>
                    <SelectItem value="2025-05">Mayo 2025</SelectItem>
                    <SelectItem value="2025-06">Junio 2025</SelectItem>
                    <SelectItem value="2025-07">Julio 2025</SelectItem>
                    <SelectItem value="2025-08">Agosto 2025</SelectItem>
                    <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                    <SelectItem value="2025-10">Octubre 2025</SelectItem>
                    <SelectItem value="2025-11">Noviembre 2025</SelectItem>
                    <SelectItem value="2025-12">Diciembre 2025</SelectItem>
                    <SelectItem value="2024-01">Enero 2024</SelectItem>
                    <SelectItem value="2024-02">Febrero 2024</SelectItem>
                    <SelectItem value="2024-03">Marzo 2024</SelectItem>
                    <SelectItem value="2024-04">Abril 2024</SelectItem>
                    <SelectItem value="2024-05">Mayo 2024</SelectItem>
                    <SelectItem value="2024-06">Junio 2024</SelectItem>
                    <SelectItem value="2024-07">Julio 2024</SelectItem>
                    <SelectItem value="2024-08">Agosto 2024</SelectItem>
                    <SelectItem value="2024-09">Septiembre 2024</SelectItem>
                    <SelectItem value="2024-10">Octubre 2024</SelectItem>
                    <SelectItem value="2024-11">Noviembre 2024</SelectItem>
                    <SelectItem value="2024-12">Diciembre 2024</SelectItem>
                  </SelectContent>
                </Select>

                {(filtroFinalizadasZona || filtroFinalizadasMarca || filtroFinalizadasCliente || filtroFinalizadasFechaInicio || filtroFinalizadasFechaFin || (filtroMesFinalizadas && filtroMesFinalizadas !== 'all')) && (
                  <Button
                    onClick={() => {
                      setFiltroFinalizadasZona('');
                      setFiltroFinalizadasMarca('');
                      setFiltroFinalizadasCliente('');
                      setFiltroFinalizadasFechaInicio('');
                      setFiltroFinalizadasFechaFin('');
                      setFiltroMesFinalizadas('all');
                    }}
                    variant="secondary"
                    size="sm"
                    className="bg-red-500/80 hover:bg-red-600/80 text-white border-red-300 text-sm"
                    data-testid="button-clear-filters-finalizadas"
                  >
                    ✕ Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Acciones</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-left font-semibold text-emerald-900 dark:text-emerald-100">Cliente</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-left font-semibold text-emerald-900 dark:text-emerald-100">Marca</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-left font-semibold text-emerald-900 dark:text-emerald-100">Zona</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Fecha de Inicio</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Pedidos Total</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Enviados</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Duplicados</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Entregados/día</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Pedidos/día</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">% Desvío</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">% Datos Enviados</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Faltantes</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">CPA Meta Ads</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">CPL Guardado</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Inversión Realizada</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Inversión Pendiente</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Exportar CSV</th>
                  </tr>
                </thead>
                <tbody>
                  {campanasFinalizadas.map((data: DatosDiariosData, index: number) => {
                    const originalIndex = datosDiarios?.findIndex(d => d.cliente === data.cliente && d.numeroCampana === data.numeroCampana) || 0;
                    const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                    
                    const updatedData = {
                      ...data,
                      faltantesAEnviar: Math.max(0, data.pedidosTotal - data.enviados),
                    };
                    
                    const inversions = calculateInversions(updatedData, currentCpl);
                    
                    // Verificar si esta campaña debe mostrar el botón de reabrir
                    const campaignId = `${data.cliente}-${data.numeroCampana}-${data.zona}`;
                    const shouldShowReopenButton = campaignsWithReopenButton.has(campaignId);
                    
                    return (
                      <tr key={`completed-${index}`} className="hover:bg-green-50 dark:hover:bg-green-900/10">
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          {shouldShowReopenButton ? (
                            <Button
                              onClick={() => {
                                setCampaignToReopen(data);
                                setShowReopenConfirmModal(true);
                              }}
                              disabled={isReopeningCampaign}
                              size="sm"
                              className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-semibold shadow-lg"
                              data-testid={`button-reopen-campaign-${data.cliente.replace(/\s+/g, '-')}`}
                            >
                              {isReopeningCampaign ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                            </Button>
                          ) : (
                            <div className="flex items-center justify-center text-gray-400 text-xs">
                              —
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2">
                          <div>
                            <div className="font-medium">{data.clienteNombre}</div>
                            <div className="text-xs text-green-600 font-semibold">#{data.numeroCampana || 1}</div>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2">
                          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-2 rounded-lg text-center">
                            <span className="font-semibold text-indigo-700 dark:text-indigo-300">{extractMarca(data.cliente)}</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2">{data.zona}</td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-2 rounded-lg">
                            <span className="font-medium text-green-700 dark:text-green-300">
                              {data.fechaCampana || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="font-bold text-purple-700 dark:text-purple-300">{data.pedidosTotal || 0}</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{data.enviados}</td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-2 rounded-lg">
                            <span className="font-bold text-orange-700 dark:text-orange-300">
                              {data.duplicados || 0}
                            </span>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          {formatNumber(data.entregadosPorDia, 2)}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-2 rounded-lg">
                            <span className="font-medium text-blue-600 dark:text-blue-300">{formatNumber(data.pedidosPorDia, 2)}</span>
                            <div className="text-xs text-blue-500 mt-1">De campaña</div>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <Badge 
                            variant={inversions.porcentajeDesvio && inversions.porcentajeDesvio < 0 ? "destructive" : "default"}
                            className={`font-bold ${inversions.porcentajeDesvio && inversions.porcentajeDesvio < 0 
                              ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white' 
                              : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            }`}
                          >
                            {formatNumber(inversions.porcentajeDesvio, 2)}%
                          </Badge>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-20 h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 transition-all duration-300"
                                style={{ width: `${Math.min(data.porcentajeDatosEnviados || 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-green-700">
                              {formatNumber(data.porcentajeDatosEnviados, 1)}%
                            </span>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="font-bold text-red-700 dark:text-red-300">{inversions.faltantes}</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          {(data as any).cpa > 0 ? (
                            <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold shadow-lg">
                              ARS ${((data as any).cpa).toLocaleString('es-AR')}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">Calculando...</span>
                          )}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          {currentCpl > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-green-600 font-semibold">
                                ${currentCpl.toLocaleString('es-AR')}
                              </div>
                              <div className="text-xs text-gray-500">Guardado</div>
                            </div>
                          ) : (
                            <div className="text-gray-400">-</div>
                          )}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-2 rounded-lg">
                            <span className="text-green-700 dark:text-green-300 font-bold">
                              ARS ${inversions.inversionRealizada.toLocaleString('es-AR')}
                            </span>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="text-red-700 dark:text-red-300 font-bold">
                              ARS $0
                            </span>
                            <div className="text-xs text-gray-500 mt-1">Completada</div>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <Button
                            onClick={() => handleExportCampanaCSV(data)}
                            disabled={exportingCSV}
                            size="sm"
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg"
                            data-testid={`button-export-csv-finalized-${data.cliente.replace(/\s+/g, '-')}`}
                          >
                            {exportingCSV ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila de Totales - Campañas Finalizadas */}
                  {campanasFinalizadas.length > 0 && (
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-800/50 dark:to-green-800/50 border-t-4 border-emerald-500">
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-bold text-emerald-900 dark:text-emerald-100">
                        —
                      </td>
                      <td colSpan={12} className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-bold text-emerald-900 dark:text-emerald-100 text-lg">
                        TOTAL CAMPAÑAS FINALIZADAS
                      </td>
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center">
                        <div className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-800/50 dark:to-pink-800/50 p-2 rounded-lg">
                          <span className="font-bold text-red-700 dark:text-red-300">
                            {campanasFinalizadas.reduce((sum: number, data: DatosDiariosData) => {
                              const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                              const inversions = calculateInversions(data, currentCpl);
                              return sum + inversions.faltantes;
                            }, 0)}
                          </span>
                        </div>
                      </td>
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-bold text-emerald-900 dark:text-emerald-100">
                        —
                      </td>
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-medium">
                        <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-800/50 dark:to-emerald-800/50 p-2 rounded-lg">
                          <span className="text-green-700 dark:text-green-300 font-bold">
                            ARS ${campanasFinalizadas.reduce((sum, data) => {
                              const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                              const inversions = calculateInversions(data, currentCpl);
                              return sum + inversions.inversionRealizada;
                            }, 0).toLocaleString('es-AR')}
                          </span>
                        </div>
                      </td>
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-medium">
                        <div className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-800/50 dark:to-pink-800/50 p-2 rounded-lg">
                          <span className="text-red-700 dark:text-red-300 font-bold">
                            ARS $0
                          </span>
                          <div className="text-xs text-gray-500 mt-1">Todas Completadas</div>
                        </div>
                      </td>
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-bold text-emerald-900 dark:text-emerald-100">
                        —
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {/* Sin campañas finalizadas automáticas */}
              <div className="text-center py-8 text-gray-500">
                Las campañas finalizadas se gestionan manualmente
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Totales Generales de Todo el Dashboard */}
        {(campanasEnProceso.length > 0 || campanasFinalizadas.length > 0) && (
          <Card className="border-0 shadow-2xl bg-gradient-to-r from-white via-purple-50 to-indigo-50 dark:from-gray-800 dark:via-purple-900/10 dark:to-indigo-900/10">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  💰
                </div>
                <span className="text-xl font-bold">TOTALES GENERALES</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 font-bold">
                  {campanasEnProceso.length + campanasFinalizadas.length} campañas totales
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-800/50 dark:to-emerald-800/50 p-4 rounded-lg border-2 border-green-200 dark:border-green-600">
                  <div className="text-center">
                    <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">INVERSIÓN REALIZADA TOTAL</div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                      ARS ${[...campanasEnProceso, ...campanasFinalizadas].reduce((sum, data) => {
                        const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                        const inversions = calculateInversions(data, currentCpl);
                        return sum + inversions.inversionRealizada;
                      }, 0).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-800/50 dark:to-red-800/50 p-4 rounded-lg border-2 border-orange-200 dark:border-orange-600">
                  <div className="text-center">
                    <div className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">INVERSIÓN PENDIENTE TOTAL</div>
                    <div className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                      ARS ${[...campanasEnProceso, ...campanasFinalizadas].reduce((sum, data) => {
                        const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                        const inversions = calculateInversions(data, currentCpl);
                        const cplReal = calculateCPLReal(data);
                        const metaAdsAmount = cplReal > 0 ? Math.round(cplReal * data.enviados) : inversions.inversionPendiente;
                        return sum + metaAdsAmount; // Sin lógica automática de finalización
                      }, 0).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-800/50 dark:to-indigo-800/50 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-600">
                  <div className="text-center">
                    <div className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">INVERSIÓN TOTAL</div>
                    <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                      ARS ${[...campanasEnProceso, ...campanasFinalizadas].reduce((sum, data) => {
                        const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                        const inversions = calculateInversions(data, currentCpl);
                        const cplReal = calculateCPLReal(data);
                        const metaAdsAmount = cplReal > 0 ? Math.round(cplReal * data.enviados) : inversions.inversionPendiente;
                        const pendiente = metaAdsAmount; // Sin lógica automática de finalización
                        return sum + inversions.inversionRealizada + pendiente;
                      }, 0).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de detalles de campaña */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white border-2 border-gray-300 !bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detalles de Campaña: {selectedCampaign?.clienteNombre}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCampaign && (
            <div className="space-y-6">
              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Información General</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Cliente:</span> {selectedCampaign.clienteNombre}</div>
                    <div><span className="font-medium">Marca:</span> {extractMarca(selectedCampaign.cliente)}</div>
                    <div><span className="font-medium">Zona:</span> {selectedCampaign.zona}</div>
                    <div><span className="font-medium">Número de Campaña:</span> #{selectedCampaign.numeroCampana || 1}</div>
                    <div><span className="font-medium">Estado:</span> {selectedCampaign.estadoCampana || 'En proceso'}</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Fechas</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Fecha de Inicio:</span> {selectedCampaign.fechaCampana || 'N/A'}</div>
                    <div><span className="font-medium">Fecha de Fin:</span> {selectedCampaign.fechaFinReal ? formatDateTimeExact(selectedCampaign.fechaFinReal) : 'En proceso'}</div>
                    <div><span className="font-medium">Días Procesados:</span> {selectedCampaign.diasProcesados || 0}</div>
                  </div>
                </div>
              </div>

              {/* Métricas de rendimiento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Datos Enviados</h4>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{selectedCampaign.enviados}</div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">de {selectedCampaign.pedidosTotal || selectedCampaign.cantidadSolicitada || 0} solicitados</div>
                </div>
                
                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Duplicados</h4>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{selectedCampaign.duplicados || 0}</div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">registros duplicados</div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">% Progreso</h4>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatNumber(selectedCampaign.porcentajeDatosEnviados, 1)}%</div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">completado</div>
                </div>
              </div>

              {/* Información financiera */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Información Financiera</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">CPL Guardado</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      ARS ${(CPLStorage.get(selectedCampaign.cliente, selectedCampaign.numeroCampana.toString()) || selectedCampaign.cpl || 0).toLocaleString('es-AR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Inversión Realizada</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      ARS ${(() => {
                        const currentCpl = CPLStorage.get(selectedCampaign.cliente, selectedCampaign.numeroCampana.toString()) || selectedCampaign.cpl || 0;
                        const inversions = calculateInversions(selectedCampaign, currentCpl);
                        return inversions.inversionRealizada.toLocaleString('es-AR');
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rendimiento diario */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-4">Rendimiento Diario</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-amber-600 dark:text-amber-400">Entregados por Día</div>
                    <div className="text-lg font-bold text-amber-800 dark:text-amber-200">
                      {formatNumber(selectedCampaign.entregadosPorDia, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-amber-600 dark:text-amber-400">Pedidos por Día</div>
                    <div className="text-lg font-bold text-amber-800 dark:text-amber-200">
                      {formatNumber(selectedCampaign.pedidosPorDia, 2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción en el modal */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  onClick={() => {
                    if (selectedCampaign) {
                      handleOpenEditForm(selectedCampaign);
                    }
                  }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar Campaña
                </Button>
                <Button
                  onClick={() => setIsDetailsModalOpen(false)}
                  variant="outline"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edición de Campaña - Formulario completo igual que campanas-management */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-2 border-gray-300 !bg-white">
          <DialogHeader>
            <DialogTitle>
              Editar Campaña
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 form-modern">
              {/* Cliente */}
              <FormField
                control={form.control}
                name="clienteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente *</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientes.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id.toString()}>
                            {cliente.nombreCliente}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cantidad de Datos */}
              <FormField
                control={form.control}
                name="cantidadDatosSolicitados"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad de Datos Solicitados *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        placeholder="Ej: 500" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fecha de Inicio */}
              <FormField
                control={form.control}
                name="fechaCampana"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Inicio *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date"
                        value={field.value}
                        onChange={(e) => {
                          // Asegurar que la fecha se mantenga exacta
                          const dateValue = e.target.value;
                          console.log('Date input value:', dateValue);
                          field.onChange(dateValue);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground">
                      La fecha de fin se calculará automáticamente según la cantidad de datos solicitados
                    </p>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Marca */}
                <FormField
                  control={form.control}
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar marca" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MARCAS_DISPONIBLES.map((marca) => (
                            <SelectItem key={marca} value={marca}>
                              {marca}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Zona */}
                <FormField
                  control={form.control}
                  name="zona"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provincia/Zona *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar provincia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {ZONAS_DISPONIBLES.map((zona) => (
                            <SelectItem key={zona} value={zona}>
                              {zona}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Selecciona la provincia de Argentina o AMBA/NACIONAL
                      </p>
                    </FormItem>
                  )}
                />
              </div>

              {/* Campo Localizado */}
              <FormField
                control={form.control}
                name="localizacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localización Específica</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Ciudades específicas, zonas, radios de targeting..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground">
                      Opcional: Especifica targeting geográfico adicional o localización específica
                    </p>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Pedidos por Día */}
                <FormField
                  control={form.control}
                  name="pedidosPorDia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pedidos por Día</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          placeholder="Ej: 20" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        Cantidad de datos que se entregan por día
                      </p>
                    </FormItem>
                  )}
                />

                {/* Facturación Bruta */}
                <FormField
                  control={form.control}
                  name="facturacionBruta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facturación Bruta</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          placeholder="Ej: 600000" 
                          {...field} 
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        Monto total de facturación bruta por campaña
                      </p>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="btn-gradient"
                  disabled={updateMutation.isPending}
                >
                  Actualizar Campaña
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para reabrir campaña */}
      <Dialog open={showReopenConfirmModal} onOpenChange={setShowReopenConfirmModal}>
        <DialogContent className="max-w-md bg-white border-2 border-gray-300 !bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-500" />
              Confirmar Reapertura
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ¿Estás seguro que quieres reabrir la campaña "{campaignToReopen?.clienteNombre} #{campaignToReopen?.numeroCampana}"?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              La campaña se moverá de "Finalizadas" a "En Proceso" y podrá continuar recibiendo datos.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowReopenConfirmModal(false);
                setCampaignToReopen(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              type="button"
              className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white"
              disabled={isReopeningCampaign}
              onClick={() => {
                if (campaignToReopen) {
                  handleReopenCampaign(campaignToReopen);
                  setShowReopenConfirmModal(false);
                  setCampaignToReopen(null);
                }
              }}
            >
              {isReopeningCampaign ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Reabrir Campaña
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmación para cerrar campaña */}
      <AlertDialog open={showCloseCampaignDialog} onOpenChange={setShowCloseCampaignDialog}>
        <AlertDialogContent className="bg-white border-2 border-gray-300 shadow-2xl max-w-md !bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Power className="w-5 h-5 text-red-500" />
              Confirmar Cierre de Campaña
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700 leading-relaxed">
              ¿Estás seguro que deseas cerrar la campaña <strong className="text-blue-600">"{campaignToClose?.clienteNombre} #{campaignToClose?.numeroCampana}"</strong>?
              <br />
              <br />
              <span className="text-amber-600 font-medium">Esta acción procesará automáticamente la asignación de leads pendientes y finalizará la campaña.</span> Una vez cerrada, la campaña se moverá a la sección "Finalizadas".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel 
              onClick={() => {
                setShowCloseCampaignDialog(false);
                setCampaignToClose(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCloseCampaign}
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg border-0"
              disabled={isClosingCampaign}
            >
              {isClosingCampaign ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Power className="w-4 h-4 mr-2" />
              )}
              Cerrar Campaña
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}