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
import { calcularIIBB, calcularIVA, calcularImpuestoTarjeta, calcularBeneficio, calcularMargenReal, makeSpendKey } from "@/lib/financial-utils";
import { debounce, memoize } from "@/lib/performance";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import {
  insertCampanaComercialSchema,
  type CampanaComercial,
  type InsertCampanaComercial,
  type Cliente,
  MARCAS_DISPONIBLES,
} from "@shared/schema";
import { BrandDisplay } from "@/components/ui/brand-display";
import { getCampaignBrandInfo as getEnhancedCampaignBrandInfo } from "@shared/utils/brand-display-utils";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { SentLeadsModal } from "@/components/sent-leads-modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ColumnToggleDropdown } from "@/components/ui/column-toggle-dropdown";

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
  facturacionBruta?: number;
  tipoFacturacion?: string;
  costeVenta?: number;
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

const PEND_COLS = [
  { key: 'fecha_inicio', label: 'Fecha Inicio' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'marca', label: 'Marca' },
  { key: 'leads_dia', label: 'Leads x Día' },
  { key: 'leads', label: 'Leads' },
  { key: 'progreso', label: 'Progreso' },
  { key: 'faltantes', label: 'Faltantes' },
  { key: 'facturacionBruta', label: 'Facturación Bruta' },
  { key: 'gastoAcumulado', label: 'Gasto Meta Ads' },
  { key: 'iibb', label: 'IIBB (4.5%)' },
  { key: 'iva', label: 'FC / IVA' },
  { key: 'impTarjeta', label: 'Imp. Tarjeta (5.5%)' },
  { key: 'beneficio', label: 'Beneficio' },
  { key: 'margenReal', label: 'Margen Real' },
  { key: 'cplActual', label: 'CPL Actual' },
  { key: 'reposiciones', label: 'Reposiciones' },
  { key: 'margenSinMerma', label: 'Margen sin Merma' },
  { key: 'acciones', label: 'Acciones' },
];

export default function CampanasPendientes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // WebSocket para refresh automático inmediato
  const { isConnected: wsConnected, connectionError, reconnectCount, isRefreshing: wsRefreshing } = useDashboardWebSocket();

  const [sortByDate, setSortByDate] = useState<'desc' | 'asc'>('desc');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showReadyToCloseOnly, setShowReadyToCloseOnly] = useState(true); // NUEVO: Filtro activo por defecto

  // Estados para filtros
  const [filtroZona, setFiltroZona] = useState<string>('');
  const [filtroMarca, setFiltroMarca] = useState<string>('');
  const [filtroCliente, setFiltroCliente] = useState<string>('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState<string>('');
  const [filtroFechaFin, setFiltroFechaFin] = useState<string>('');

  const { isVisible: isVisibleCol, toggleColumn: toggleCol, showAll: showAllCol, visibility: visibilityCol, hiddenCount: hiddenCountCol } = useColumnVisibility('campanas-pendientes', PEND_COLS);

  const cssPend = useMemo(() => {
    const rules: string[] = [];
    PEND_COLS.forEach((col, idx) => {
      if (!isVisibleCol(col.key)) {
        const pos = idx + 1;
        rules.push(`#table-pendientes thead tr th:nth-child(${pos}), #table-pendientes tbody tr td:nth-child(${pos}) { display: none !important; }`);
      }
    });
    return rules.join('\n');
  }, [visibilityCol, isVisibleCol]);


  // Estados para modal de detalles y acciones
  const [selectedCampaign, setSelectedCampaign] = useState<DatosDiariosData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Estados para modal de leads enviados
  const [isSentLeadsModalOpen, setIsSentLeadsModalOpen] = useState(false);
  const [selectedCampaignForLeads, setSelectedCampaignForLeads] = useState<DatosDiariosData | null>(null);

  // Estados para loading individual por campaña
  const [closingCampaigns, setClosingCampaigns] = useState<Set<string>>(new Set());
  const [campaignProgress, setCampaignProgress] = useState<Record<string, number>>({});
  const [campaignMessages, setCampaignMessages] = useState<Record<string, string>>({});
  const [websocketConnections, setWebsocketConnections] = useState<Record<string, WebSocket>>({});
  const [closedCampaignIds, setClosedCampaignIds] = useState<Set<string>>(new Set());

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
  const { data: datosDiarios, isLoading, error, refetch, isFetching } = useQuery<DatosDiariosData[]>({
    queryKey: ['/api/dashboard/campanas-pendientes'],
    refetchInterval: 30 * 1000,
    staleTime: 0,
    gcTime: 5 * 60 * 1000, // Mantener en caché 5 minutos
    retry: 2,
    retryDelay: 1000,
    // OPTIMIZACIÓN: Mantener datos previos mientras carga nuevos
    placeholderData: (previousData) => previousData,
    // Refetch en segundo plano sin bloquear UI
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Obtener campañas comerciales
  const { data: campanasComerciales } = useQuery({
    queryKey: ['/api/campanas-comerciales'],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Mapa de gasto Meta Ads
  const [spendMap, setSpendMap] = useState<Map<string, { spend: number; results: number; cpl: number }>>(new Map());

  useEffect(() => {
    if (!datosDiarios || datosDiarios.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const uniqueKeys = new Map<string, { marca: string; zona: string; fechaInicio: string; fechaFin: string }>();
    datosDiarios.forEach(d => {
      const fi = d.fechaCampana || today;
      const ff = d.fechaFin || today;
      const key = makeSpendKey(d.marca || '', d.zona || 'NACIONAL', fi, ff);
      if (!uniqueKeys.has(key)) uniqueKeys.set(key, { marca: d.marca || '', zona: d.zona || 'NACIONAL', fechaInicio: fi, fechaFin: ff });
    });
    setSpendMap(new Map());
    [...uniqueKeys.entries()].forEach(async ([key, p]) => {
      try {
        const res = await fetch(`/api/meta-ads/campaign-spend?marca=${encodeURIComponent(p.marca)}&zona=${encodeURIComponent(p.zona)}&fechaInicio=${p.fechaInicio}&fechaFin=${p.fechaFin}`);
        if (!res.ok) return;
        const data = await res.json();
        setSpendMap(prev => new Map(prev).set(key, { spend: data.spend || 0, results: data.results || 0, cpl: data.cpl || 0 }));
      } catch { /* silencioso */ }
    });
  }, [datosDiarios]);

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
    const wsUrl = `${protocol}//${window.location.host}/ws`;
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

        // Preparar actualización cuando el progreso llega al 90%
        if (data.progress >= 90 && data.progress < 100) {
          console.log(`🔄 [WEBSOCKET-PROGRESS] Progreso al 90%, preparando actualización...`);
          queryClient.invalidateQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            refetchType: 'active'
          });
        }

        if (data.progress >= 100) {
          console.log(`🎉 [WEBSOCKET-PROGRESS] Campaña ${campaignKey} completada al 100%`);

          // Actualización suave en segundo plano - sin refresco de página
          queryClient.invalidateQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true,
            refetchType: 'active'
          });

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
          }, 1000);
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

        // Actualización optimista: ocultar la campaña inmediatamente
        setClosedCampaignIds(prev => new Set([...Array.from(prev), campaignKey]));

        // MEJORA 3: Timeout de seguridad para limpiar closedCampaignIds
        // Esto previene que la campaña quede oculta permanentemente si hay problemas
        setTimeout(() => {
          setClosedCampaignIds(prev => {
            const newSet = new Set(prev);
            const wasDeleted = newSet.delete(campaignKey);
            if (wasDeleted) {
              console.log(`⏱️ [TIMEOUT] Limpiando campaña ${campaignKey} del estado optimista (timeout 5s)`);
            }
            return newSet;
          });
        }, 5000); // 5 segundos: suficiente para que el servidor actualice

        toast({
          title: "Campaña cerrada exitosamente",
          description: `${result.campaignsClosed || 0} campañas cerradas, ${result.leadsAssigned || 0} leads asignados`,
        });

        // Actualización suave en segundo plano - sin refresco de página
        console.log('🔄 [FRONTEND] Invalidando queries en segundo plano...');
        await queryClient.invalidateQueries({
          queryKey: ['/api/dashboard/campanas-pendientes'],
          exact: true,
          refetchType: 'active' // Solo actualiza queries activas en segundo plano
        });

        console.log('✅ [FRONTEND] Actualización en segundo plano completada');

        if (ws && ws.readyState === WebSocket.OPEN) {
          console.log('📢 [FRONTEND] Notificando al servidor vía WebSocket');
          ws.send(JSON.stringify({
            type: 'notify_dashboard_refresh',
            campaignKey,
            leadsAssigned: result.leadsAssigned
          }));
        }

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

      // MEJORA 2: Revertir actualización optimista en caso de error
      console.log('🔄 [FRONTEND] Revirtiendo actualización optimista por error');
      setClosedCampaignIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignKey); // Volver a mostrar la campaña
        return newSet;
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

        queryClient.invalidateQueries({
          queryKey: ['/api/dashboard/campanas-pendientes'],
          refetchType: 'active'
        });
      }, 2000);
    }
  };

  const confirmCloseCampaign = async () => {
    if (!campaignToClose) return;

    setShowCloseCampaignDialog(false);
    await handleCloseCampaignInline(campaignToClose);
    setCampaignToClose(null);
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
      filtered = filtered.filter(data => {
        const brands = getEnhancedCampaignBrandInfo(data, campanasComerciales);
        return brands.some(brand => brand.marca === filtroMarca);
      });
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

    // NUEVO: Filtrar solo campañas listas para cerrar
    if (showReadyToCloseOnly) {
      filtered = filtered.filter(data => hasActiveCounting(data));
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
  }, [datosDiarios, filtroZona, filtroMarca, filtroCliente, filtroFechaInicio, filtroFechaFin, showDuplicatesOnly, showReadyToCloseOnly, sortByDate, campanasComerciales]);

  // Opciones para filtros
  const opcionesZona = useMemo(() => {
    if (!datosDiarios || !Array.isArray(datosDiarios)) return [];
    const zonasSet = new Set(datosDiarios.map(d => d.zona).filter(Boolean));
    return Array.from(zonasSet).sort();
  }, [datosDiarios]);

  const opcionesMarca = useMemo(() => {
    const marcasSet = new Set<string>(MARCAS_DISPONIBLES);
    if (datosDiarios && Array.isArray(datosDiarios)) {
      datosDiarios.forEach(data => {
        const brands = getEnhancedCampaignBrandInfo(data, campanasComerciales);
        brands.forEach(brand => { if (brand.marca) marcasSet.add(brand.marca); });
      });
    }
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

  // MEJORA 1: Sincronizar closedCampaignIds con datos reales del servidor
  useEffect(() => {
    if (datosDiarios && closedCampaignIds.size > 0) {
      // Obtener IDs actuales de campañas que SÍ existen en el servidor
      const existingCampaignKeys = new Set(
        datosDiarios.map(c => `${c.cliente}-${c.numeroCampana}`)
      );

      // Limpiar IDs de campañas que ya no existen (fueron cerradas exitosamente)
      setClosedCampaignIds(prev => {
        const updated = new Set<string>();
        let hasChanges = false;

        prev.forEach(key => {
          if (existingCampaignKeys.has(key)) {
            // Mantener solo si aún existe en el servidor (campaña no se cerró correctamente)
            updated.add(key);
          } else {
            // La campaña fue cerrada exitosamente en el servidor
            hasChanges = true;
            console.log(`🧹 [SYNC] Limpiando campaña cerrada exitosamente: ${key}`);
          }
        });

        return hasChanges ? updated : prev;
      });
    }
  }, [datosDiarios, closedCampaignIds]);

  // Configurar listeners de WebSocket para refrescar automáticamente
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
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

          // Actualización suave en segundo plano
          console.log('🔄 [WEBSOCKET] Invalidando queries en segundo plano...');
          await queryClient.invalidateQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true,
            refetchType: 'active' // Solo actualiza queries activas
          });

          console.log('✅ [WEBSOCKET] Actualización en segundo plano completada');
        }

        if (data.type === 'campaign-completed') {
          console.log('🎯 [WEBSOCKET] Campaña completada:', data);

          // Actualización suave en segundo plano
          console.log('🔄 [WEBSOCKET] Actualizando después de campaign-completed...');
          await queryClient.invalidateQueries({
            queryKey: ['/api/dashboard/campanas-pendientes'],
            exact: true,
            refetchType: 'active'
          });

          if (data.success) {
            toast({
              title: "✅ Campaña procesada",
              description: `${data.leadsAssigned || 0} leads asignados. Dashboard actualizado.`,
            });
          }
          console.log('✅ [WEBSOCKET] Actualización de campaign-completed completada');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">
        <Navigation />

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Campañas Pendientes
            </h1>
            <p className="text-slate-600 text-sm">
              Campañas activas sin fecha de finalización
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`font-medium ${wsConnected ? 'text-green-700' : 'text-red-700'}`}>
                  {wsConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
                <span>Auto-actualización cada 30s</span>
              </div>
              {(wsRefreshing || isFetching) && (
                <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
                  <span className="text-blue-700 font-medium">
                    {isFetching && !isLoading ? 'Actualizando en segundo plano...' : 'Actualizando...'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Actualizar
          </Button>
        </div>

        {/* Tarjeta de Campañas Pendientes */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="bg-slate-50 border-b border-slate-200 px-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-slate-800">Campañas Activas</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-0 font-medium">
                    {campanasPendientes.length} campañas
                  </Badge>
                </CardTitle>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setSortByDate(sortByDate === 'desc' ? 'asc' : 'desc')}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                  >
                    {sortByDate === 'desc' ? '↓ Más reciente' : '↑ Más antigua'}
                  </Button>
                  <Button
                    onClick={() => setShowReadyToCloseOnly(!showReadyToCloseOnly)}
                    variant={showReadyToCloseOnly ? "default" : "outline"}
                    size="sm"
                    className={`text-xs h-8 ${showReadyToCloseOnly ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    title={showReadyToCloseOnly ? "Mostrando solo campañas listas para cerrar" : "Mostrando todas las campañas"}
                  >
                    {showReadyToCloseOnly ? '✓ ' : ''}Listas para cerrar
                  </Button>
                  <Button
                    onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                    variant={showDuplicatesOnly ? "default" : "outline"}
                    size="sm"
                    className={`text-xs h-8 ${showDuplicatesOnly ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                  >
                    {showDuplicatesOnly ? '✓ ' : ''}Duplicados
                  </Button>
                </div>
              </div>

              {/* Filtros compactos */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-3.5 w-3.5 text-slate-400" />

                <Select value={filtroZona || "all"} onValueChange={(value) => setFiltroZona(value === "all" ? "" : value)}>
                  <SelectTrigger className="h-8 w-36 text-xs bg-white">
                    <SelectValue placeholder="Zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las zonas</SelectItem>
                    {opcionesZona.map(zona => (
                      <SelectItem key={zona} value={zona}>{zona}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroMarca || "all"} onValueChange={(value) => setFiltroMarca(value === "all" ? "" : value)}>
                  <SelectTrigger className="h-8 w-36 text-xs bg-white">
                    <SelectValue placeholder="Marca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las marcas</SelectItem>
                    {opcionesMarca.map(marca => (
                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroCliente || "all"} onValueChange={(value) => setFiltroCliente(value === "all" ? "" : value)}>
                  <SelectTrigger className="h-8 w-44 text-xs bg-white">
                    <SelectValue placeholder="Cliente" />
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
                  className="h-8 w-36 text-xs bg-white"
                  placeholder="Desde"
                />

                <Input
                  type="date"
                  value={filtroFechaFin}
                  onChange={(e) => setFiltroFechaFin(e.target.value)}
                  className="h-8 w-36 text-xs bg-white"
                  placeholder="Hasta"
                />

                <ColumnToggleDropdown
                  columns={PEND_COLS}
                  isVisible={isVisibleCol}
                  toggleColumn={toggleCol}
                  showAll={showAllCol}
                  hiddenCount={hiddenCountCol}
                />

                {(filtroZona || filtroMarca || filtroCliente || filtroFechaInicio || filtroFechaFin || !showReadyToCloseOnly || showDuplicatesOnly) && (
                  <Button
                    onClick={() => {
                      setFiltroZona('');
                      setFiltroMarca('');
                      setFiltroCliente('');
                      setFiltroFechaInicio('');
                      setFiltroFechaFin('');
                      setShowReadyToCloseOnly(true); // Restablecer a valor por defecto
                      setShowDuplicatesOnly(false);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {isLoading && !datosDiarios ? (
                <div className="p-6">
                  <TableSkeleton rows={8} columns={16} />
                </div>
              ) : (
                <>
                  {cssPend && <style>{cssPend}</style>}
                  <table id="table-pendientes" className={`w-full border-collapse transition-opacity duration-300 ${isFetching && !isLoading ? 'opacity-90' : 'opacity-100'}`}>
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Fecha Inicio</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Cliente</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Marca</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="cursor-help">
                                Leads x Día
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <div className="space-y-1 text-xs">
                                  <p className="font-semibold">Fórmula del Desvío:</p>
                                  <p className="font-mono bg-slate-100 p-1 rounded">
                                    ((Entregados - Pedidos) / Pedidos) × 100
                                  </p>
                                  <p className="text-slate-600 mt-2">
                                    <span className="font-medium">Positivo (+):</span> Entregamos más de lo pedido
                                  </p>
                                  <p className="text-slate-600">
                                    <span className="font-medium">Negativo (-):</span> Entregamos menos de lo pedido
                                  </p>
                                  <p className="text-slate-600">
                                    <span className="font-medium">Cero (0%):</span> Entregamos exactamente lo pedido
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Leads</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Progreso</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Faltantes</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase tracking-wider">Facturación Bruta</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase tracking-wider">Gasto Meta Ads</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase tracking-wider">IIBB (4.5%)</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase tracking-wider">FC / IVA</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase tracking-wider">Imp. Tarjeta (5.5%)</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase tracking-wider">Beneficio</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase tracking-wider">Margen Real</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase tracking-wider">CPL Actual</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-orange-700 uppercase tracking-wider">Reposiciones</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-orange-700 uppercase tracking-wider">Margen sin Merma</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {campanasPendientes.map((data: DatosDiariosData, index: number) => {
                        const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                        const inversions = calculateInversions(data, currentCpl);
                        const campaignKey = `${data.cliente}-${data.numeroCampana}`;
                        const isProcessing = closingCampaigns.has(campaignKey);
                        const progress = campaignProgress[campaignKey] || 0;
                        const message = campaignMessages[campaignKey] || '';
                        const isClosed = closedCampaignIds.has(campaignKey);

                        // Si la campaña fue cerrada, no mostrarla (actualización optimista)
                        if (isClosed) return null;

                        return (
                          <tr key={`pending-${index}`} className="hover:bg-slate-50 transition-colors">
                            {/* Fecha Inicio */}
                            <td className="px-4 py-3 text-center text-sm text-slate-600">
                              {data.fechaCampana || 'N/A'}
                            </td>

                            {/* Cliente */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-900 text-sm">{data.clienteNombre}</span>
                                <span className="text-xs text-slate-500">Campaña #{data.numeroCampana || 1}</span>
                              </div>
                            </td>

                            {/* Marca */}
                            <td className="px-4 py-3">
                              <BrandDisplay
                                campaignData={getCampaignWithAutoAssignment(data)}
                                brands={getCampaignBrandInfo(data)}
                                className="min-w-[100px]"
                                variant="secondary"
                              />
                            </td>

                            {/* Leads x Día */}
                            <td className="px-4 py-3">
                              {(() => {
                                const leadsRealRaw = typeof data.entregadosPorDia === 'number'
                                  ? data.entregadosPorDia
                                  : (typeof data.entregadosPorDia === 'string' && data.entregadosPorDia !== '-'
                                      ? parseFloat(data.entregadosPorDia)
                                      : 0);
                                const leadsReal = Math.round(leadsRealRaw * 10) / 10;
                                const leadsEsperados = data.pedidosPorDia || 0;

                                // Calcular desvío: ((entregados - pedidos) / pedidos) * 100
                                const desvio = leadsEsperados > 0
                                  ? ((leadsReal - leadsEsperados) / leadsEsperados) * 100
                                  : 0;

                                // Determinar color según el desvío
                                // Si desvío > 0: entregamos MÁS de lo pedido (verde)
                                // Si desvío < 0: entregamos MENOS de lo pedido (rojo)
                                // Si desvío = 0: entregamos exactamente lo pedido (gris)
                                const desvioColor = desvio > 0
                                  ? 'text-green-600'
                                  : desvio < 0
                                    ? 'text-red-600'
                                    : 'text-slate-600';

                                const desvioSign = desvio > 0 ? '+' : '';

                                return (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-sm">
                                      <span className="font-semibold text-slate-700">{leadsReal}</span>
                                      <span className="text-slate-400 mx-1">/</span>
                                      <span className="font-medium text-slate-600">{leadsEsperados}</span>
                                    </span>
                                    <span className={`text-xs font-medium ${desvioColor}`}>
                                      Desvío: {desvioSign}{Math.round(desvio * 10) / 10}%
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Leads (Enviados / Duplicados / Pedidos) */}
                            <td className="px-4 py-3 text-center">
                              <span className="text-sm">
                                <button
                                  onClick={() => {
                                    if (data.enviados && typeof data.enviados === 'number' && data.enviados > 0) {
                                      setSelectedCampaignForLeads(data);
                                      setIsSentLeadsModalOpen(true);
                                    }
                                  }}
                                  className={`font-semibold ${
                                    data.enviados && typeof data.enviados === 'number' && data.enviados > 0
                                      ? 'text-green-600 hover:text-green-700 hover:underline cursor-pointer'
                                      : 'text-green-600'
                                  }`}
                                  disabled={!data.enviados || typeof data.enviados !== 'number' || data.enviados === 0}
                                >
                                  {data.enviados || 0}
                                </button>
                                <span className="text-slate-400 mx-1">/</span>
                                <span className="font-semibold text-orange-600">{data.duplicados || 0}</span>
                                <span className="text-slate-400 mx-1">/</span>
                                <span className="font-semibold text-blue-600">{data.pedidosTotal || 0}</span>
                              </span>
                            </td>

                            {/* Progreso */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-full max-w-[80px] h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      (data.porcentajeDatosEnviados || 0) > 100
                                        ? 'bg-gradient-to-r from-green-500 to-green-600 animate-pulse'
                                        : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                    }`}
                                    style={{ width: `${Math.min(data.porcentajeDatosEnviados || 0, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium ${
                                  (data.porcentajeDatosEnviados || 0) > 100
                                    ? 'text-green-600 font-bold animate-pulse'
                                    : 'text-slate-600'
                                }`}>{formatNumber(data.porcentajeDatosEnviados, 0)}%</span>
                              </div>
                            </td>

                            {/* Faltantes */}
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-red-600 text-sm">{inversions.faltantes}</span>
                            </td>

                            {/* Financial columns */}
                            {(() => {
                              const today = new Date().toISOString().split('T')[0];
                              const fi = data.fechaCampana || today;
                              const ff = (data.fechaFin as string) || today;
                              const sk = makeSpendKey(data.marca || '', data.zona || 'NACIONAL', fi, ff);
                              const spendData = spendMap.get(sk) || { spend: 0, results: 0, cpl: 0 };
                              const fb = parseFloat(String(data.facturacionBruta || 0)) || 0;
                              const tf = data.tipoFacturacion || 'C';
                              const iibb = calcularIIBB(fb);
                              const iva = calcularIVA(fb, tf);
                              const impTarjeta = calcularImpuestoTarjeta(spendData.spend);
                              const beneficio = calcularBeneficio(fb, spendData.spend, iibb, iva, impTarjeta);
                              const margen = calcularMargenReal(beneficio, fb);
                              const cplActual = spendData.results > 0 ? spendData.spend / spendData.results : 0;
                              const safeEnv = parseFloat(String(data.enviados || 0)) || 0;
                              const safePed = parseFloat(String(data.pedidosTotal || 0)) || 0;
                              const reposiciones = Math.max(0, safeEnv - safePed);
                              const merma = reposiciones * cplActual;
                              const margenSinMerma = fb > 0 ? ((beneficio + merma) / fb) * 100 : 0;
                              const fmtCur = (v: number) => v === 0 ? '$0' : v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
                              const hasMeta = spendData.spend > 0 || spendData.results > 0;
                              return (
                                <>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {fb > 0 ? <span className="font-semibold text-violet-700">{fmtCur(fb)}</span> : <span className="text-slate-400">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {hasMeta ? <span className="font-semibold text-violet-700">{fmtCur(spendData.spend)}</span> : <span className="text-slate-400">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {fb > 0 ? <span className="text-violet-600">{fmtCur(iibb)}</span> : <span className="text-slate-400">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {fb > 0 ? <span className="text-violet-600">{tf === 'A' ? fmtCur(iva) : '$0'}</span> : <span className="text-slate-400">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {hasMeta ? <span className="text-violet-600">{fmtCur(impTarjeta)}</span> : <span className="text-slate-400">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {fb > 0 && hasMeta ? (
                                      <span className={`font-bold ${beneficio >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtCur(beneficio)}</span>
                                    ) : <span className="text-slate-400">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {fb > 0 && hasMeta ? (
                                      <span className={`font-bold ${margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{margen.toFixed(1)}%</span>
                                    ) : <span className="text-slate-400">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {hasMeta ? <span className="font-semibold text-violet-700">{fmtCur(cplActual)}</span> : <span className="text-slate-400">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    <span className={`font-semibold ${reposiciones > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{reposiciones > 0 ? reposiciones : '0'}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {fb > 0 && hasMeta ? (
                                      <span className={`font-bold ${margenSinMerma >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{margenSinMerma.toFixed(1)}%</span>
                                    ) : <span className="text-slate-400">-</span>}
                                  </td>
                                </>
                              );
                            })()}

                            {/* Acciones */}
                            <td className="px-4 py-3">
                              {isProcessing ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-full max-w-[100px] bg-slate-200 rounded-full h-1.5">
                                    <div
                                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-slate-500">{message}</p>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    onClick={() => {
                                      setSelectedCampaign(data);
                                      setIsDetailsModalOpen(true);
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="Ver detalles"
                                  >
                                    <Eye className="h-4 w-4 text-slate-600" />
                                  </Button>


                                  {hasActiveCounting(data) && (
                                    isAnyProcessing ? (
                                      <Button
                                        disabled={true}
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 cursor-not-allowed"
                                        title="Procesando otra campaña..."
                                      >
                                        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                      </Button>
                                    ) : (
                                      <Button
                                        onClick={() => {
                                          setCampaignToClose(data);
                                          setShowCloseCampaignDialog(true);
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Cerrar campaña"
                                        data-testid={`close-campaign-${data.cliente.replace(/\s+/g, '-')}`}
                                      >
                                        <Power className="h-4 w-4" />
                                      </Button>
                                    )
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {campanasPendientes.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-slate-500 text-sm">No hay campañas pendientes actualmente</p>
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

        {/* Modal de leads enviados */}
        <SentLeadsModal
          isOpen={isSentLeadsModalOpen}
          onClose={() => setIsSentLeadsModalOpen(false)}
          campaignData={selectedCampaignForLeads}
        />
      </div>
    </div>
  );
}
