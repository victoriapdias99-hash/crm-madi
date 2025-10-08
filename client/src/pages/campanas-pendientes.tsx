import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, RefreshCw, Download, Filter, Power, Edit, Eye, X, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useDashboardWebSocket } from "@/hooks/use-dashboard-websocket";
import { Navigation } from "@/components/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { CPLStorage } from "@/lib/cpl-storage";
import { debounce, memoize } from "@/lib/performance";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import {
  insertCampanaComercialSchema,
  type CampanaComercial,
  type InsertCampanaComercial,
  type Cliente,
} from "@shared/schema";
import { BrandDisplay } from "@/components/ui/brand-display";
import { getCampaignBrandInfo as getEnhancedCampaignBrandInfo } from "@shared/utils/brand-display-utils";
import { TableSkeleton } from "@/components/ui/table-skeleton";

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
  campaignId?: number;
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

export default function CampanasPendientes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // WebSocket para refresh automático inmediato
  const { isConnected: wsConnected, connectionError, reconnectCount, isRefreshing: wsRefreshing } = useDashboardWebSocket();

  const [exportingCSV, setExportingCSV] = useState(false);
  const [sortByDate, setSortByDate] = useState<'desc' | 'asc'>('desc');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  // Estados para filtros
  const [filtroZona, setFiltroZona] = useState<string>('');
  const [filtroMarca, setFiltroMarca] = useState<string>('');
  const [filtroCliente, setFiltroCliente] = useState<string>('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState<string>('');
  const [filtroFechaFin, setFiltroFechaFin] = useState<string>('');

  // Estados para modal de detalles y acciones
  const [selectedCampaign, setSelectedCampaign] = useState<DatosDiariosData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Estados para loading individual por campaña
  const [closingCampaigns, setClosingCampaigns] = useState<Set<string>>(new Set());
  const [campaignProgress, setCampaignProgress] = useState<Record<string, number>>({});
  const [campaignMessages, setCampaignMessages] = useState<Record<string, string>>({});
  const [websocketConnections, setWebsocketConnections] = useState<Record<string, WebSocket>>({});

  const [showCloseCampaignDialog, setShowCloseCampaignDialog] = useState(false);
  const [campaignToClose, setCampaignToClose] = useState<DatosDiariosData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCampana, setEditingCampana] = useState<CampanaComercial | null>(null);

  // Configurar useForm
  const form = useForm<Omit<InsertCampanaComercial, 'fechaFin'>>({
    resolver: zodResolver(insertCampanaComercialSchema.omit({ fechaFin: true })),
    defaultValues: {
      clienteId: 0,
      numeroCampana: "",
      cantidadDatosSolicitados: 0,
      marca: "",
      zona: "",
      fechaCampana: "",
      pedidosPorDia: 0,
      facturacionBruta: 0,
    },
  });

  // Fetch clientes para el dropdown
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  // Fetch datos desde el endpoint exclusivo de campañas pendientes
  const { data: datosDiarios, isLoading, error, refetch } = useQuery<DatosDiariosData[]>({
    queryKey: ['/api/dashboard/campanas-pendientes'],
    refetchInterval: 30 * 1000,
    staleTime: 0, // CAMBIO: No usar caché, siempre considerar datos como stale
    gcTime: 0, // CAMBIO: No mantener datos en caché después de que el componente se desmonta
    retry: 2,
    retryDelay: 1000,
  });

  // Obtener campañas comerciales
  const { data: campanasComerciales } = useQuery({
    queryKey: ['/api/campanas-comerciales'],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // updateMutation para edición
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CampanaComercial> }) => {
      await apiRequest(`/api/campanas-comerciales/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      setIsEditModalOpen(false);
      setEditingCampana(null);
      toast({
        title: "Campaña actualizada exitosamente",
        description: "Los cambios se reflejarán inmediatamente"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar campaña",
        description: error?.message || "Error desconocido",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: Omit<InsertCampanaComercial, 'fechaFin'>) => {
    if (editingCampana) {
      updateMutation.mutate({ id: editingCampana.id, data });
    }
  };

  // Función para conectar WebSocket
  const connectCampaignWebSocket = useCallback((campaignKey: string): WebSocket => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // En desarrollo, usar puerto 5000 explícitamente
    const host = import.meta.env.DEV ? 'localhost:5000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    const ws = new WebSocket(wsUrl);

    const timeoutId = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, 120000);

    ws.onopen = () => {
      console.log(`🔗 WebSocket conectado para campaña: ${campaignKey}`);
      ws.send(JSON.stringify({
        type: 'register_campaign_progress',
        campaignKey
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'campaign-progress' && data.campaignKey === campaignKey) {
        console.log(`📡 [WEBSOCKET-PROGRESS] Progreso recibido: ${data.progress}% - ${data.message}`);

        setCampaignProgress(prev => ({
          ...prev,
          [campaignKey]: data.progress
        }));
        setCampaignMessages(prev => ({
          ...prev,
          [campaignKey]: data.message
        }));

        // Refrescar cuando el progreso llega al 90% (casi terminado)
        if (data.progress >= 90 && data.progress < 100) {
          console.log(`🔄 [WEBSOCKET-PROGRESS] Progreso al 90%, preparando refresco...`);
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/campanas-pendientes'] });
        }

        if (data.progress >= 100) {
          console.log(`🎉 [WEBSOCKET-PROGRESS] Campaña ${campaignKey} completada al 100%`);
          console.log(`🔄 [WEBSOCKET-PROGRESS] Forzando refresco inmediato...`);

          // REFRESCO INMEDIATO cuando llega al 100%
          queryClient.invalidateQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true
          });
          queryClient.removeQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true
          });
          refetch();

          clearTimeout(timeoutId);
          setTimeout(() => {
            console.log(`🧹 [WEBSOCKET-PROGRESS] Limpiando estado de campaña ${campaignKey}`);
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

            ws.close();
            setWebsocketConnections(prev => {
              const newConnections = { ...prev };
              delete newConnections[campaignKey];
              return newConnections;
            });

            // Refresco adicional después de limpiar
            console.log(`🔄 [WEBSOCKET-PROGRESS] Refresco adicional después de limpiar estado`);
            queryClient.refetchQueries({ queryKey: ['/api/dashboard/campanas-pendientes'] });
            refetch();
          }, 2000);
        }
      }
    };

    ws.onerror = (error) => {
      console.error(`❌ Error en WebSocket para ${campaignKey}:`, error);
      clearTimeout(timeoutId);
    };

    ws.onclose = () => {
      clearTimeout(timeoutId);
      console.log(`🔗 WebSocket desconectado para ${campaignKey}`);
    };

    return ws;
  }, []);

  // Función para cerrar campaña
  const handleCloseCampaignInline = async (campaign: DatosDiariosData) => {
    const campaignKey = `${campaign.cliente}-${campaign.numeroCampana}`;
    console.log('🚀 [FRONTEND] INICIO - Cerrando campaña:', campaignKey);
    console.log('📋 [FRONTEND] Datos de campaña:', {
      cliente: campaign.cliente,
      clienteNombre: campaign.clienteNombre,
      numeroCampana: campaign.numeroCampana,
      marca: campaign.marca,
      zona: campaign.zona
    });

    setClosingCampaigns(prev => new Set(prev).add(campaignKey));
    setCampaignProgress(prev => ({ ...prev, [campaignKey]: 0 }));
    setCampaignMessages(prev => ({ ...prev, [campaignKey]: 'Iniciando...' }));

    const ws = connectCampaignWebSocket(campaignKey);
    setWebsocketConnections(prev => ({
      ...prev,
      [campaignKey]: ws
    }));

    try {
      const technicalClientName = campaign.clienteNombre.toLowerCase();
      const requestPayload = {
        clients: technicalClientName,
        campaignKey: campaignKey,
        campaignNumber: campaign.numeroCampana.toString(),
        dryRun: false
      };

      console.log('📤 [FRONTEND] Enviando request de cierre:', requestPayload);

      const response = await apiRequest('/api/campaign-closure/execute', 'POST', requestPayload);

      console.log('📥 [FRONTEND] Response recibido:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [FRONTEND] Resultado del cierre:', result);

        toast({
          title: "Campaña cerrada exitosamente",
          description: `${result.campaignsClosed || 0} campañas cerradas, ${result.leadsAssigned || 0} leads asignados`,
        });

        // REFRESCO INMEDIATO Y FORZADO
        console.log('🔄 [FRONTEND] PASO 1 - Invalidando queries...');
        await queryClient.invalidateQueries({
          queryKey: ['/api/dashboard/campanas-pendientes'],
          exact: true
        });

        console.log('🔄 [FRONTEND] PASO 2 - Removiendo queries del caché...');
        queryClient.removeQueries({
          queryKey: ['/api/dashboard/campanas-pendientes'],
          exact: true
        });

        console.log('🔄 [FRONTEND] PASO 3 - Ejecutando refetch directo (forzado)...');
        await refetch();

        console.log('✅ [FRONTEND] Refrescos completados exitosamente');

        if (ws && ws.readyState === WebSocket.OPEN) {
          console.log('📢 [FRONTEND] Notificando al servidor vía WebSocket');
          ws.send(JSON.stringify({
            type: 'notify_dashboard_refresh',
            campaignKey,
            leadsAssigned: result.leadsAssigned
          }));
        }

        // Refresco adicional después de 2 segundos por si acaso
        console.log('⏱️ [FRONTEND] Programando refresco adicional en 2 segundos...');
        setTimeout(async () => {
          console.log('🔄 [FRONTEND] Ejecutando refresco adicional (timeout 2s)');
          await queryClient.refetchQueries({ queryKey: ['/api/dashboard/campanas-pendientes'] });
          await refetch();
          console.log('✅ [FRONTEND] Refresco adicional completado');
        }, 2000);

      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [FRONTEND] Error en response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.message || 'Error al cerrar la campaña');
      }
    } catch (error: any) {
      console.error('❌ [FRONTEND] ERROR CRÍTICO al cerrar campaña:', {
        error: error.message,
        stack: error.stack,
        campaignKey
      });

      setCampaignProgress(prev => ({ ...prev, [campaignKey]: 100 }));
      setCampaignMessages(prev => ({ ...prev, [campaignKey]: 'Error al procesar' }));

      toast({
        title: "Error al cerrar campaña",
        description: error.message || "No se pudo cerrar la campaña. Intenta nuevamente.",
        variant: "destructive",
      });

      ws.close();
      setWebsocketConnections(prev => {
        const newConnections = { ...prev };
        delete newConnections[campaignKey];
        return newConnections;
      });

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

        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/campanas-pendientes'] });
        refetch();
      }, 2000);
    }
  };

  const confirmCloseCampaign = async () => {
    if (!campaignToClose) return;

    setShowCloseCampaignDialog(false);
    await handleCloseCampaignInline(campaignToClose);
    setCampaignToClose(null);
  };

  // Función para exportar CSV
  const handleExportCampanaCSV = async (campana: DatosDiariosData) => {
    setExportingCSV(true);

    try {
      const response = await apiRequest(`/api/export/campana-leads/${encodeURIComponent(campana.cliente)}`, 'GET');
      const data = await response.json();
      const leads = data.leads || [];

      // Generar CSV
      const headers = ['Campaña', 'Zona', 'Fecha Inicio', 'Estado', 'Total Enviados', 'Nombre Completo', 'Teléfono', 'Email'];
      let csvContent = headers.join(',') + '\n';

      if (leads.length === 0) {
        csvContent += `"${campana.cliente}","${campana.zona}","${campana.fechaCampana}","Activa",${campana.enviados},"Sin leads"\n`;
      } else {
        leads.forEach((lead: any) => {
          const nombreCompleto = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Sin nombre';
          csvContent += [
            `"${campana.cliente}"`,
            `"${campana.zona}"`,
            `"${campana.fechaCampana}"`,
            '"Activa"',
            campana.enviados,
            `"${nombreCompleto}"`,
            `"${lead.phone || ''}"`,
            `"${lead.email || ''}"`
          ].join(',') + '\n';
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
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

  // Función para verificar si una campaña tiene conteo activo
  const hasActiveCounting = (data: DatosDiariosData): boolean => {
    const enviados = data.enviados;
    const entregados = data.entregadosPorDia;

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

    return enviadosActive || entregadosActive;
  };

  // Verificar si hay algún procesamiento activo
  const isAnyProcessing = closingCampaigns.size > 0;

  // Filtrar y ordenar campañas PENDIENTES (sin fechaFin)
  const campanasPendientes = useMemo(() => {
    if (!datosDiarios || !Array.isArray(datosDiarios)) {
      return [];
    }

    // El endpoint ya retorna solo campañas pendientes (sin fechaFin)
    let filtered = [...datosDiarios];

    // Aplicar filtros
    if (filtroZona) {
      filtered = filtered.filter(data => data.zona === filtroZona);
    }

    if (filtroMarca) {
      filtered = filtered.filter(data => data.marca === filtroMarca);
    }

    if (filtroCliente) {
      filtered = filtered.filter(data => data.clienteNombre === filtroCliente);
    }

    if (filtroFechaInicio) {
      filtered = filtered.filter(data => data.fechaCampana && data.fechaCampana >= filtroFechaInicio);
    }

    if (filtroFechaFin) {
      filtered = filtered.filter(data => data.fechaCampana && data.fechaCampana <= filtroFechaFin);
    }

    if (showDuplicatesOnly) {
      filtered = filtered.filter(data => (data.duplicados || 0) > 0);
    }

    // Ordenar por fecha
    filtered.sort((a, b) => {
      const fechaA = a.fechaCampana || '1970-01-01';
      const fechaB = b.fechaCampana || '1970-01-01';
      return sortByDate === 'desc'
        ? new Date(fechaB).getTime() - new Date(fechaA).getTime()
        : new Date(fechaA).getTime() - new Date(fechaB).getTime();
    });

    return filtered;
  }, [datosDiarios, filtroZona, filtroMarca, filtroCliente, filtroFechaInicio, filtroFechaFin, showDuplicatesOnly, sortByDate]);

  // Opciones para filtros
  const opcionesZona = useMemo(() => {
    if (!datosDiarios || !Array.isArray(datosDiarios)) return [];
    const zonasSet = new Set(datosDiarios.map(d => d.zona).filter(Boolean));
    return Array.from(zonasSet).sort();
  }, [datosDiarios]);

  const opcionesMarca = useMemo(() => {
    if (!datosDiarios || !Array.isArray(datosDiarios)) return [];
    const marcasSet = new Set<string>();
    datosDiarios.forEach(data => {
      const brands = getEnhancedCampaignBrandInfo(data, campanasComerciales);
      brands.forEach(brand => marcasSet.add(brand.marca));
    });
    return Array.from(marcasSet).filter(Boolean).sort();
  }, [datosDiarios, campanasComerciales]);

  const opcionesCliente = useMemo(() => {
    if (!datosDiarios || !Array.isArray(datosDiarios)) return [];
    const clientesSet = new Set(datosDiarios.map(d => d.clienteNombre).filter(Boolean));
    return Array.from(clientesSet).sort();
  }, [datosDiarios]);

  // Cálculo de inversiones
  const calculateInversions = useMemo(() => memoize((data: DatosDiariosData, cpl: number) => {
    const safeCpl = isNaN(cpl) || !cpl ? 0 : cpl;
    const safeEnviados = isNaN(data.enviados as any) || !data.enviados || data.enviados === "-" ? 0 : data.enviados as number;
    const safePedidosTotal = isNaN(data.pedidosTotal) || !data.pedidosTotal ? 0 : data.pedidosTotal;
    const safePorcentaje = isNaN(data.porcentajeDatosEnviados) || !data.porcentajeDatosEnviados ? 0 : data.porcentajeDatosEnviados;

    const inversionRealizada = safeEnviados * safeCpl * 1.02;
    const faltantes = Math.max(0, safePedidosTotal - safeEnviados);
    const inversionPendiente = safePorcentaje >= 100 ? 0 : faltantes * safeCpl * 1.02;
    const porcentajeDesvio = safeEnviados > 0 ? (safePedidosTotal / safeEnviados) : 0;

    return {
      inversionRealizada: isNaN(inversionRealizada) ? 0 : inversionRealizada,
      inversionPendiente: isNaN(inversionPendiente) ? 0 : inversionPendiente,
      faltantes: isNaN(faltantes) ? 0 : faltantes,
      porcentajeDesvio: isNaN(porcentajeDesvio) ? 0 : porcentajeDesvio
    };
  }), []);

  const getCampaignBrandInfo = (data: DatosDiariosData) => {
    return getEnhancedCampaignBrandInfo(data, campanasComerciales);
  };

  const getCampaignWithAutoAssignment = (data: DatosDiariosData) => {
    if (!campanasComerciales || !Array.isArray(campanasComerciales)) {
      return null;
    }

    const campana = campanasComerciales.find((c: any) =>
      c.numeroCampana === data.numeroCampana.toString() &&
      c.marca.toLowerCase() === data.marca.toLowerCase() &&
      c.zona === data.zona
    );

    return campana;
  };

  // Configurar listeners de WebSocket para refrescar automáticamente
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // En desarrollo, usar puerto 5000 explícitamente
    const host = import.meta.env.DEV ? 'localhost:5000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🔗 WebSocket conectado para Campañas Pendientes');
      ws.send(JSON.stringify({
        type: 'register_dashboard_listener'
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 [WEBSOCKET] Mensaje recibido:', data);

        if (data.type === 'dashboard_refresh' || data.type === 'campaign_update') {
          console.log('🔄 [WEBSOCKET] Evento de actualización recibido:', {
            type: data.type,
            timestamp: data.timestamp,
            action: data.action,
            campaignId: data.campaignId
          });

          console.log('🔄 [WEBSOCKET] Invalidando queries...');
          await queryClient.invalidateQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true
          });

          console.log('🔄 [WEBSOCKET] Removiendo del caché...');
          queryClient.removeQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true
          });

          console.log('🔄 [WEBSOCKET] Ejecutando refetch directo...');
          const result = await refetch();
          console.log('📊 [WEBSOCKET] Datos recibidos:', result.data?.length || 0, 'campañas');

          console.log('✅ [WEBSOCKET] Refresco completado exitosamente');
        }

        if (data.type === 'campaign-completed') {
          console.log('🎯 [WEBSOCKET] Campaña completada:', data);

          console.log('🔄 [WEBSOCKET] Refrescando después de campaign-completed...');
          await queryClient.invalidateQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true
          });
          queryClient.removeQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true
          });
          const result = await refetch();
          console.log('📊 [WEBSOCKET] Datos recibidos:', result.data?.length || 0, 'campañas');

          if (data.success) {
            toast({
              title: "✅ Campaña procesada",
              description: `${data.leadsAssigned || 0} leads asignados. Dashboard actualizado.`,
            });
          }
          console.log('✅ [WEBSOCKET] Refresco de campaign-completed completado');
        }
      } catch (error) {
        console.error('❌ [WEBSOCKET] Error procesando mensaje:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Error en WebSocket:', error);
    };

    ws.onclose = () => {
      console.log('🔗 WebSocket desconectado');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [queryClient, refetch, toast]);

  if (isLoading && !datosDiarios) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
          <p className="text-lg font-semibold text-blue-900">Cargando campañas pendientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Navigation />

        <div className="flex items-center justify-between">
          <div className="relative">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Campañas Pendientes
            </h1>
            <p className="text-slate-600 mt-2 text-lg font-medium">
              🚀 Campañas activas sin fecha de finalización
            </p>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 font-medium">Actualización automática cada 30s</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-xs font-medium ${wsConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {wsConnected ? 'WebSocket conectado' : 'WebSocket desconectado'}
                </span>
              </div>
              {wsRefreshing && (
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <span className="text-xs font-semibold text-blue-700">Actualizando datos...</span>
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-xl"
            size="lg"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5 mr-3" />
            )}
            Actualizar
          </Button>
        </div>

        {/* Tarjeta de Campañas Pendientes */}
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-white via-amber-50 to-orange-50">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
            <div className="space-y-4">
              <CardTitle className="flex items-center gap-3 flex-wrap">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  🚀
                </div>
                <span className="text-xl font-bold">Campañas Activas</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 font-bold">
                  {campanasPendientes.length} en proceso
                </Badge>
                <Button
                  onClick={() => setSortByDate(sortByDate === 'desc' ? 'asc' : 'desc')}
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 text-white border border-white/30 hover:bg-white/30"
                >
                  📅 {sortByDate === 'desc' ? 'Más reciente primero ↓' : 'Más antigua primero ↑'}
                </Button>
                <Button
                  onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                  variant="secondary"
                  size="sm"
                  className={`border-white/30 hover:bg-white/30 ${showDuplicatesOnly ? 'bg-red-500/80 text-white' : 'bg-white/20 text-white'}`}
                >
                  🔍 Datos Duplicados {showDuplicatesOnly ? '(Activo)' : ''}
                </Button>
              </CardTitle>

              {/* Filtros */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Filtros:</span>
                </div>

                <Select value={filtroZona || "all"} onValueChange={(value) => setFiltroZona(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm">
                    <SelectValue placeholder="Todas las zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las zonas</SelectItem>
                    {opcionesZona.map(zona => (
                      <SelectItem key={zona} value={zona}>{zona}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroMarca || "all"} onValueChange={(value) => setFiltroMarca(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm">
                    <SelectValue placeholder="Todas las marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las marcas</SelectItem>
                    {opcionesMarca.map(marca => (
                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroCliente || "all"} onValueChange={(value) => setFiltroCliente(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-48 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm">
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
                  value={filtroFechaInicio}
                  onChange={(e) => setFiltroFechaInicio(e.target.value)}
                  className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 placeholder:text-white/60 text-sm"
                />

                <Input
                  type="date"
                  value={filtroFechaFin}
                  onChange={(e) => setFiltroFechaFin(e.target.value)}
                  className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 placeholder:text-white/60 text-sm"
                />

                {(filtroZona || filtroMarca || filtroCliente || filtroFechaInicio || filtroFechaFin) && (
                  <Button
                    onClick={() => {
                      setFiltroZona('');
                      setFiltroMarca('');
                      setFiltroCliente('');
                      setFiltroFechaInicio('');
                      setFiltroFechaFin('');
                    }}
                    variant="secondary"
                    size="sm"
                    className="bg-red-500/80 hover:bg-red-600/80 text-white border-red-300 text-sm"
                  >
                    ✕ Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              {isLoading ? (
                <TableSkeleton rows={8} columns={16} />
              ) : (
                <>
                  <table className="w-full border-collapse border border-amber-300">
                    <thead>
                      <tr className="bg-gradient-to-r from-amber-100 to-orange-100">
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Acciones</th>
                        <th className="border border-amber-200 p-3 text-left font-semibold text-amber-900">Cliente</th>
                        <th className="border border-amber-200 p-3 text-left font-semibold text-amber-900">Marca</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Zona</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Fecha Inicio</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Pedidos Total</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Enviados</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Duplicados</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Entregados/día</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Pedidos/día</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">% Desvío</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">% Enviados</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Faltantes</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">CPL</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Inversión Realizada</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Inversión Pendiente</th>
                        <th className="border border-amber-200 p-3 text-center font-semibold text-amber-900">Exportar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campanasPendientes.map((data: DatosDiariosData, index: number) => {
                        const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                        const inversions = calculateInversions(data, currentCpl);
                        const campaignKey = `${data.cliente}-${data.numeroCampana}`;
                        const isProcessing = closingCampaigns.has(campaignKey);
                        const progress = campaignProgress[campaignKey] || 0;
                        const message = campaignMessages[campaignKey] || '';

                        return (
                          <tr key={`pending-${index}`} className="hover:bg-amber-50">
                            <td className="border border-amber-200 p-2 text-center">
                              <div className="flex flex-col items-center gap-2">
                                {/* Mostrar progreso si está procesando */}
                                {isProcessing ? (
                                  <div className="w-full space-y-1">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-gray-600">{message}</p>
                                  </div>
                                ) : (
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
                                        onClick={() => {
                                          setSelectedCampaign(data);
                                          setIsDetailsModalOpen(true);
                                        }}
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
                                            onClick={() => {
                                              setCampaignToClose(data);
                                              setShowCloseCampaignDialog(true);
                                            }}
                                            disabled={isProcessing}
                                            className="cursor-pointer text-red-600 focus:text-red-600"
                                            data-testid={`menu-close-campaign-${data.cliente.replace(/\s+/g, '-')}`}
                                          >
                                            <Power className="mr-2 h-4 w-4" />
                                            Cerrar Campaña
                                          </DropdownMenuItem>
                                        )
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </td>
                            <td className="border border-amber-200 p-2">
                              <div className="font-medium">{data.clienteNombre}</div>
                              <div className="text-xs text-blue-600 font-semibold">#{data.numeroCampana || 1}</div>
                            </td>
                            <td className="border border-amber-200 p-2">
                              <BrandDisplay
                                campaignData={getCampaignWithAutoAssignment(data)}
                                brands={getCampaignBrandInfo(data)}
                                className="min-w-[120px]"
                                variant="secondary"
                              />
                            </td>
                            <td className="border border-amber-200 p-2 text-center">
                              <Badge variant="outline">{data.zona}</Badge>
                            </td>
                            <td className="border border-amber-200 p-2 text-center">{data.fechaCampana || 'N/A'}</td>
                            <td className="border border-amber-200 p-2 text-center font-bold text-purple-700">{data.pedidosTotal || 0}</td>
                            <td className="border border-amber-200 p-2 text-center">{data.enviados}</td>
                            <td className="border border-amber-200 p-2 text-center">
                              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-2 rounded-lg">
                                <span className="font-bold text-orange-700">{data.duplicados || 0}</span>
                              </div>
                            </td>
                            <td className="border border-amber-200 p-2 text-center">{formatNumber(data.entregadosPorDia, 2)}</td>
                            <td className="border border-amber-200 p-2 text-center">
                              <span className="font-medium text-blue-600">{formatNumber(data.pedidosPorDia, 2)}</span>
                            </td>
                            <td className="border border-amber-200 p-2 text-center">
                              <Badge variant={inversions.porcentajeDesvio < 0 ? "destructive" : "default"}>
                                {formatNumber(inversions.porcentajeDesvio, 2)}%
                              </Badge>
                            </td>
                            <td className="border border-amber-200 p-2 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-20 h-3 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 transition-all"
                                    style={{ width: `${Math.min(data.porcentajeDatosEnviados || 0, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold">{formatNumber(data.porcentajeDatosEnviados, 1)}%</span>
                              </div>
                            </td>
                            <td className="border border-amber-200 p-2 text-center">
                              <span className="font-bold text-red-700">{inversions.faltantes}</span>
                            </td>
                            <td className="border border-amber-200 p-2 text-center">
                              {currentCpl > 0 ? (
                                <Badge variant="secondary" className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                                  ARS ${currentCpl.toLocaleString('es-AR')}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-sm">Sin CPL</span>
                              )}
                            </td>
                            <td className="border border-amber-200 p-2 text-center">
                              <span className="text-green-700 font-bold">
                                ARS ${inversions.inversionRealizada.toLocaleString('es-AR')}
                              </span>
                            </td>
                            <td className="border border-amber-200 p-2 text-center">
                              <span className="text-orange-700 font-bold">
                                ARS ${inversions.inversionPendiente.toLocaleString('es-AR')}
                              </span>
                            </td>
                            <td className="border border-amber-200 p-2 text-center">
                              <Button
                                onClick={() => handleExportCampanaCSV(data)}
                                disabled={exportingCSV}
                                size="sm"
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
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
                    </tbody>
                  </table>

                  {campanasPendientes.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay campañas pendientes actualmente
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal de detalles */}
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalles de Campaña</DialogTitle>
            </DialogHeader>
            {selectedCampaign && (
              <div className="space-y-3">
                <div><span className="font-medium">Cliente:</span> {selectedCampaign.clienteNombre}</div>
                <div><span className="font-medium">Campaña #:</span> {selectedCampaign.numeroCampana}</div>
                <div><span className="font-medium">Marca:</span> {selectedCampaign.marca}</div>
                <div><span className="font-medium">Zona:</span> {selectedCampaign.zona}</div>
                <div><span className="font-medium">Fecha Inicio:</span> {selectedCampaign.fechaCampana}</div>
                <div><span className="font-medium">Estado:</span> En Proceso</div>
                <div><span className="font-medium">Enviados:</span> {selectedCampaign.enviados}</div>
                <div><span className="font-medium">Pedidos Total:</span> {selectedCampaign.pedidosTotal}</div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmación de cierre */}
        <AlertDialog open={showCloseCampaignDialog} onOpenChange={setShowCloseCampaignDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar esta campaña?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción procesará automáticamente la asignación de leads pendientes y finalizará la campaña.
                {campaignToClose && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="font-semibold">{campaignToClose.clienteNombre} - Campaña #{campaignToClose.numeroCampana}</p>
                    <p className="text-sm mt-1">Marca: {campaignToClose.marca} | Zona: {campaignToClose.zona}</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCloseCampaign} className="bg-orange-600 hover:bg-orange-700">
                Confirmar cierre
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
