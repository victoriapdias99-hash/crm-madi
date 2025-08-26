import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, DollarSign, TrendingUp, Users, BarChart3, Settings, FileText, Activity, Download, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface MetaCampaign {
  campaignId: string;
  campaignName: string;
  spend: number;
  accountCurrency: string;
  cpc: number;
  cpm: number;
  frequency: number;
  dateStart: string;
  dateStop: string;
  lastUpdated: Date;
  costPerResult?: number; // Coste por conversación/resultado directo de Meta Ads
  results?: number; // Cantidad de resultados/conversiones
  actions?: any;
  costPerActionType?: any;
  effectiveStatus?: string; // Estado actual de la campaña (ACTIVE, PAUSED, etc.)
  isActive?: boolean; // Helper para verificar si está activa
}

interface MetaAdset {
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  accountCurrency: string;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  dateStart: string;
  dateStop: string;
  lastUpdated: Date;
  costPerResult?: number;
  results?: number; // Cantidad de resultados/conversiones
  actions?: any;
  costPerActionType?: any;
  effectiveStatus?: string; // Estado actual del adset (ACTIVE, PAUSED, etc.)
  isActive?: boolean; // Helper para verificar si está activo
}

interface MetaStats {
  totalSpend: number;
  totalCampaigns: number;
  avgCPC: number;
  avgCPM: number;
  isConnected: boolean;
  lastSync: Date | null;
}

// Interfaces para el informe de auditoría
interface AuditReport {
  periodo: string;
  cambios: {
    adsets: {
      total: number;
      nuevos: number;
      modificados: number;
      pausados: number;
    };
    anuncios?: {
      total: number;
      nuevos: number;
      modificados: number;
      pausados: number;
    };
    detalles: Array<{
      tipo: string;
      nombre: string;
      descripcion: string;
      fecha: string;
    }>;
  };
  costes: {
    gastoTotal: number;
    gastoDiario: number;
    cpcPromedio: number;
    cpmPromedio: number;
    moneda: string;
  };
  resultados: {
    impresiones: number;
    clics: number;
    ctr: number;
    alcance: number;
    frecuencia: number;
  };
  resumen: string;
}

interface AuditFilters {
  fechaInicio: string;
  fechaFin: string;
  campanaId: string;
  rangoRapido: string;
}

export default function MetaAdsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado para filtros de campañas
  const [campaignFilters, setCampaignFilters] = useState({
    fechaInicio: format(new Date(), 'yyyy-MM-dd'),
    fechaFin: format(new Date(), 'yyyy-MM-dd'),
    nombreCampana: '',
    rangoRapido: 'hoy'
  });
  
  // Estado para filtro de conjuntos de anuncios
  const [adsetFilter, setAdsetFilter] = useState('');
  
  // Estado para filtros globales de fechas
  const [globalDateFilters, setGlobalDateFilters] = useState({
    fechaInicio: format(new Date(), 'yyyy-MM-dd'),
    fechaFin: format(new Date(), 'yyyy-MM-dd')
  });
  
  // Estado para manejar campañas expandidas y sus adsets
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [campaignAdsets, setCampaignAdsets] = useState<Record<string, MetaAdset[]>>({});
  
  // Estado para el módulo de auditoría
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({
    fechaInicio: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    fechaFin: format(new Date(), 'yyyy-MM-dd'),
    campanaId: '',
    rangoRapido: 'ult7dias'
  });
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);

  // Función para aplicar rango rápido para campañas
  const applyCampaignQuickRange = (rangoRapido: string) => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
    
    let fechaInicio = '';
    let fechaFin = '';
    
    switch (rangoRapido) {
      case 'hoy':
        fechaInicio = today;
        fechaFin = today;
        break;
      case 'ayer':
        fechaInicio = yesterday;
        fechaFin = yesterday;
        break;
      case 'ayer_hoy':
        fechaInicio = yesterday;
        fechaFin = today;
        break;
      case 'ult7dias':
        fechaInicio = format(subDays(now, 6), 'yyyy-MM-dd');
        fechaFin = today;
        break;
      case 'ult14dias':
        fechaInicio = format(subDays(now, 13), 'yyyy-MM-dd');
        fechaFin = today;
        break;
      case 'ult30dias':
        fechaInicio = format(subDays(now, 29), 'yyyy-MM-dd');
        fechaFin = today;
        break;
      case 'ult6meses':
        fechaInicio = format(subDays(now, 180), 'yyyy-MM-dd');
        fechaFin = today;
        break;
      case 'ult1ano':
        fechaInicio = format(subDays(now, 365), 'yyyy-MM-dd');
        fechaFin = today;
        break;
      default:
        return; // No cambiar fechas si es personalizado
    }
    
    // Actualizar tanto los filtros de campaña como los filtros globales
    setCampaignFilters(prev => ({
      ...prev,
      rangoRapido,
      fechaInicio,
      fechaFin
    }));
    
    // CRÍTICO: También actualizar los filtros globales para que las consultas API usen el mismo rango
    setGlobalDateFilters({
      fechaInicio,
      fechaFin
    });
  };

  // Función para aplicar rango rápido
  const applyQuickRange = (rangoRapido: string) => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
    
    let fechaInicio = '';
    let fechaFin = '';
    
    switch (rangoRapido) {
      case 'hoy':
        fechaInicio = today;
        fechaFin = today;
        break;
      case 'ayer':
        fechaInicio = yesterday;
        fechaFin = yesterday;
        break;
      case 'ult7dias':
        fechaInicio = format(subDays(now, 6), 'yyyy-MM-dd');
        fechaFin = today;
        break;
      case 'ult14dias':
        fechaInicio = format(subDays(now, 13), 'yyyy-MM-dd');
        fechaFin = today;
        break;
      case 'ult30dias':
        fechaInicio = format(subDays(now, 29), 'yyyy-MM-dd');
        fechaFin = today;
        break;
      default:
        return; // No cambiar fechas si es personalizado
    }
    
    setAuditFilters(prev => ({
      ...prev,
      rangoRapido,
      fechaInicio,
      fechaFin
    }));
  };

  const { data: metaStats, isLoading: statsLoading } = useQuery<MetaStats>({
    queryKey: ['/api/meta-ads/stats', globalDateFilters],
    queryFn: async () => {
      let url = '/api/meta-ads/stats';
      
      // Solo agregar filtros de fecha si están definidos
      if (globalDateFilters.fechaInicio || globalDateFilters.fechaFin) {
        const timeRange = {
          since: globalDateFilters.fechaInicio || undefined,
          until: globalDateFilters.fechaFin || undefined
        };
        url += `?timeRange=${encodeURIComponent(JSON.stringify(timeRange))}`;
        console.log('🔍 ENVIANDO FILTROS DE FECHA STATS AL BACKEND:', timeRange);
      } else {
        console.log('⚠️ NO HAY FILTROS DE FECHA STATS - USANDO RANGO POR DEFECTO');
      }
      
      const response = await apiRequest(url, 'GET');
      return await response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: campaigns, isLoading: campaignLoading } = useQuery<MetaCampaign[]>({
    queryKey: ['/api/meta-ads/campaigns', globalDateFilters],
    queryFn: async () => {
      let url = '/api/meta-ads/campaigns';
      
      // Solo agregar filtros de fecha si están definidos
      if (globalDateFilters.fechaInicio || globalDateFilters.fechaFin) {
        const timeRange = {
          since: globalDateFilters.fechaInicio || undefined,
          until: globalDateFilters.fechaFin || undefined
        };
        url += `?timeRange=${encodeURIComponent(JSON.stringify(timeRange))}`;
        console.log('🔍 ENVIANDO FILTROS DE FECHA CAMPAIGNS AL BACKEND:', timeRange);
      } else {
        console.log('⚠️ NO HAY FILTROS DE FECHA CAMPAIGNS - USANDO RANGO POR DEFECTO');
      }
      
      const response = await apiRequest(url, 'GET');
      return await response.json();
    },
    refetchInterval: 300000,
  });
  
  // Función para obtener adsets de una campaña
  const fetchAdsets = async (campaignName: string): Promise<MetaAdset[]> => {
    try {
      let url = `/api/meta-ads/adsets?campaignName=${encodeURIComponent(campaignName)}`;
      
      // Solo agregar filtros de fecha si están definidos
      if (globalDateFilters.fechaInicio || globalDateFilters.fechaFin) {
        const timeRange = {
          since: globalDateFilters.fechaInicio || undefined,
          until: globalDateFilters.fechaFin || undefined
        };
        url += `&timeRange=${encodeURIComponent(JSON.stringify(timeRange))}`;
        console.log('🔍 ENVIANDO FILTROS DE FECHA ADSETS AL BACKEND:', timeRange, 'CAMPAÑA:', campaignName);
      } else {
        console.log('⚠️ NO HAY FILTROS DE FECHA ADSETS - USANDO RANGO POR DEFECTO', 'CAMPAÑA:', campaignName);
      }
      
      const response = await apiRequest(url, 'GET');
      const data = await response.json();
      return data as MetaAdset[];
    } catch (error) {
      console.error('Error fetching adsets:', error);
      return [];
    }
  };
  
  // Función para expandir/contraer campaña
  const toggleCampaign = async (campaignId: string, campaignName: string) => {
    const newExpanded = new Set(expandedCampaigns);
    
    if (expandedCampaigns.has(campaignId)) {
      // Contraer
      newExpanded.delete(campaignId);
      setExpandedCampaigns(newExpanded);
    } else {
      // Expandir y cargar adsets
      newExpanded.add(campaignId);
      setExpandedCampaigns(newExpanded);
      
      if (!campaignAdsets[campaignId]) {
        const adsets = await fetchAdsets(campaignName);
        setCampaignAdsets(prev => ({ ...prev, [campaignId]: adsets }));
      }
    }
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/meta-ads/sync', 'POST');
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sincronización exitosa",
        description: "Datos de Meta Ads actualizados correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
    },
    onError: () => {
      toast({
        title: "Error de sincronización",
        description: "No se pudieron actualizar los datos de Meta Ads",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/meta-ads/test-connection', 'POST');
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Conexión exitosa",
        description: `Conectado a Meta Ads: ${data.accountName || 'Cuenta conectada'}`,
      });
    },
    onError: () => {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar a Meta Ads. Verifica las credenciales.",
        variant: "destructive",
      });
    },
  });

  // Mutación para generar informe de auditoría
  const generateReportMutation = useMutation({
    mutationFn: async (filters: AuditFilters) => {
      const response = await apiRequest('/api/meta-ads/audit-report', 'POST', filters);
      return await response.json();
    },
    onSuccess: (data: AuditReport) => {
      console.log("🔍 AUDIT REPORT DATA RECEIVED:", data);
      console.log("🔍 DATA STRUCTURE:", JSON.stringify(data, null, 2));
      setAuditReport(data);
      toast({
        title: "Informe generado",
        description: "El informe de auditoría ha sido generado exitosamente",
      });
    },
    onError: (error: any) => {
      console.error("🚨 AUDIT REPORT ERROR:", error);
      toast({
        variant: "destructive",
        title: "Error generando informe",
        description: error.message || "No se pudo generar el informe de auditoría",
      });
    }
  });

  // Función para generar informe
  const generateAuditReport = () => {
    if (!auditFilters.fechaInicio || !auditFilters.fechaFin) {
      toast({
        variant: "destructive",
        title: "Fechas requeridas",
        description: "Por favor selecciona fecha de inicio y fin",
      });
      return;
    }
    generateReportMutation.mutate(auditFilters);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'ARS'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-AR').format(num);
  };

  // Función para generar informe completo en texto
  const generateFullReportText = (report: AuditReport) => {
    const reportText = `
INFORME DE AUDITORÍA META ADS
========================================
Período: ${report.periodo}
Fecha de generación: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}

RESUMEN EJECUTIVO
----------------------------------------
${report.resumen || 'Informe de auditoría generado para analizar el rendimiento y cambios en las campañas de Meta Ads durante el período especificado.'}

ANÁLISIS DE CAMBIOS EN CONJUNTOS DE ANUNCIOS (CAPA 1)
----------------------------------------
${report.cambios && report.cambios.adsets ? `
• Conjuntos activos: ${report.cambios.adsets.total || 0}
• Nuevos conjuntos: ${report.cambios.adsets.nuevos || 0}
• Conjuntos modificados: ${report.cambios.adsets.modificados || 0}
• Conjuntos pausados: ${report.cambios.adsets.pausados || 0}
` : 'No hay datos disponibles de cambios en conjuntos de anuncios.'}

ANÁLISIS DE CAMBIOS EN ANUNCIOS INDIVIDUALES (CAPA 2)
----------------------------------------
${report.cambios && report.cambios.anuncios ? `
• Anuncios activos: ${report.cambios.anuncios.total || 0}
• Nuevos anuncios: ${report.cambios.anuncios.nuevos || 0}
• Anuncios modificados: ${report.cambios.anuncios.modificados || 0}
• Anuncios pausados: ${report.cambios.anuncios.pausados || 0}
` : 'No hay datos disponibles de cambios en anuncios individuales.'}

${report.cambios && report.cambios.detalles && report.cambios.detalles.length > 0 ? `
DETALLES DE CAMBIOS DETECTADOS
----------------------------------------
${report.cambios.detalles.map((cambio, index) => `
${index + 1}. ${cambio.tipo}: ${cambio.nombre}
   Descripción: ${cambio.descripcion}
   Fecha: ${cambio.fecha}
`).join('\n')}
` : 'No se detectaron cambios específicos en el período analizado.'}

ANÁLISIS DE COSTES Y INVERSIÓN
----------------------------------------
${report.costes ? `
• Gasto total: ${formatCurrency(report.costes.gastoTotal || 0, report.costes.moneda || 'ARS')}
• Gasto promedio diario: ${formatCurrency(report.costes.gastoDiario || 0, report.costes.moneda || 'ARS')}
• CPC promedio: ${formatCurrency(report.costes.cpcPromedio || 0, report.costes.moneda || 'ARS')}
• CPM promedio: ${formatCurrency(report.costes.cpmPromedio || 0, report.costes.moneda || 'ARS')}
` : 'No hay datos disponibles de costes.'}

RESULTADOS Y RENDIMIENTO
----------------------------------------
${report.resultados ? `
• Impresiones totales: ${formatNumber(report.resultados.impresiones || 0)}
• Clics totales: ${formatNumber(report.resultados.clics || 0)}
• CTR (Click Through Rate): ${(report.resultados.ctr || 0).toFixed(2)}%
• Alcance: ${formatNumber(report.resultados.alcance || 0)}
• Frecuencia: ${(report.resultados.frecuencia || 0).toFixed(2)}
` : 'No hay datos disponibles de resultados.'}

CONCLUSIONES Y RECOMENDACIONES
----------------------------------------
• Durante el período analizado se han monitoreado los cambios en campañas, conjuntos de anuncios y anuncios individuales
• Se recomienda revisar periódicamente tanto los conjuntos de anuncios como los anuncios individuales para optimizar el rendimiento
• Los datos de gasto y rendimiento pueden utilizarse para ajustar estrategias tanto a nivel de adset como de anuncio
• Es importante mantener un seguimiento continuo de las métricas clave (CPC, CPM, CTR) en ambas capas
• La auditoría de 2 capas proporciona mayor granularidad para identificar oportunidades de optimización específicas

----------------------------------------
Informe generado automáticamente por el Sistema de Gestión de Campañas Meta Ads
© ${new Date().getFullYear()} - Dashboard de Auditoría
`.trim();
    return reportText;
  };

  // Función para descargar informe como archivo de texto
  const downloadReport = () => {
    if (!auditReport) return;
    
    const reportText = generateFullReportText(auditReport);
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-auditoria-meta-ads-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Informe descargado",
      description: "El informe de auditoría ha sido descargado exitosamente",
    });
  };

  if (statsLoading || campaignLoading) {
    return (
      <div className="p-6">
        <Navigation />
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-lg">Cargando datos de Meta Ads...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <Navigation />
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard Meta Ads
            </h1>
            <p className="text-gray-600 mt-1">
              Monitoreo en tiempo real de campañas publicitarias
            </p>
          </div>
          
          {/* Filtros de Fecha Globales */}
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Desde</label>
              <input
                type="date"
                className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                value={globalDateFilters.fechaInicio}
                onChange={(e) => setGlobalDateFilters(prev => ({ ...prev, fechaInicio: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hasta</label>
              <input
                type="date"
                className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                value={globalDateFilters.fechaFin}
                onChange={(e) => setGlobalDateFilters(prev => ({ ...prev, fechaFin: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          
          <div className="flex gap-3">
            <Button
              onClick={() => window.location.href = '/meta-ads-config'}
              variant="outline"
              className="border-orange-200 hover:bg-orange-50 text-orange-600"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
            
            <Button
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
              variant="outline"
              className="border-blue-200 hover:bg-blue-50"
            >
              {testConnectionMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <BarChart3 className="h-4 w-4 mr-2" />
              )}
              Probar Conexión
            </Button>
            
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {syncMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar
            </Button>
          </div>
        </div>


        {/* Stats Cards - Temporalmente ocultas */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metaStats ? formatCurrency(metaStats.totalSpend) : '$0'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Últimos 30 días</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {metaStats?.totalCampaigns || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Campañas en ejecución</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPC Promedio</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {metaStats ? formatCurrency(metaStats.avgCPC) : '$0'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Costo por clic</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPM Promedio</CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {metaStats ? formatCurrency(metaStats.avgCPM) : '$0'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Costo por mil impresiones</p>
            </CardContent>
          </Card>
        </div> */}

        {/* Campaigns Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Detalle de Campañas
            </CardTitle>
            
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={campaignFilters.fechaInicio}
                  onChange={(e) => setCampaignFilters(prev => ({ ...prev, fechaInicio: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fecha Fin</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={campaignFilters.fechaFin}
                  onChange={(e) => setCampaignFilters(prev => ({ ...prev, fechaFin: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Nombre de Campaña</label>
                <input
                  type="text"
                  placeholder="Buscar campaña..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={campaignFilters.nombreCampana}
                  onChange={(e) => setCampaignFilters(prev => ({ ...prev, nombreCampana: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Nombre de Conjunto</label>
                <input
                  type="text"
                  placeholder="Buscar conjunto de anuncios..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={adsetFilter}
                  onChange={(e) => setAdsetFilter(e.target.value)}
                  data-testid="filter-adset-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Rango Rápido</label>
                <Select
                  value={campaignFilters.rangoRapido}
                  onValueChange={applyCampaignQuickRange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar período..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoy">Hoy</SelectItem>
                    <SelectItem value="ayer">Ayer</SelectItem>
                    <SelectItem value="ayer_hoy">Ayer y Hoy</SelectItem>
                    <SelectItem value="ult7dias">Últimos 7 días</SelectItem>
                    <SelectItem value="ult14dias">Últimos 14 días</SelectItem>
                    <SelectItem value="ult30dias">Últimos 30 días</SelectItem>
                    <SelectItem value="ult6meses">Últimos 6 meses</SelectItem>
                    <SelectItem value="ult1ano">Último año</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {campaigns && campaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3 font-medium">Campaña / Conjunto de Anuncios</th>
                      <th className="text-center p-3 font-medium">Gasto</th>
                      <th className="text-center p-3 font-medium">Coste por Conversación</th>
                      <th className="text-center p-3 font-medium">Cantidad de Resultados</th>
                      <th className="text-center p-3 font-medium">CPC</th>
                      <th className="text-center p-3 font-medium">CPM</th>
                      <th className="text-center p-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns
                      .filter(campaign => {
                        // Filtro por nombre
                        const nameMatch = !campaignFilters.nombreCampana || 
                          campaign.campaignName.toLowerCase().includes(campaignFilters.nombreCampana.toLowerCase());
                        
                        // Filtro por fecha de inicio de campaña
                        let dateMatch = true;
                        if (campaignFilters.fechaInicio || campaignFilters.fechaFin) {
                          const campaignStart = new Date(campaign.dateStart);
                          
                          if (campaignFilters.fechaInicio) {
                            const filterStart = new Date(campaignFilters.fechaInicio);
                            dateMatch = dateMatch && campaignStart >= filterStart;
                          }
                          
                          if (campaignFilters.fechaFin) {
                            const filterEnd = new Date(campaignFilters.fechaFin);
                            dateMatch = dateMatch && campaignStart <= filterEnd;
                          }
                        }
                        
                        return nameMatch && dateMatch;
                      })
                      .flatMap((campaign) => {
                        const campaignRow = (
                          <tr key={campaign.campaignId} className="border-b border-gray-100 hover:bg-gray-50 bg-blue-25">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleCampaign(campaign.campaignId, campaign.campaignName)}
                                  className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200"
                                >
                                  {expandedCampaigns.has(campaign.campaignId) ? (
                                    <ChevronDown className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                  )}
                                </button>
                                <div>
                                  <div className="font-medium text-blue-700">📢 {campaign.campaignName}</div>
                                  <div className="text-sm text-gray-500">ID: {campaign.campaignId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="text-center p-3 font-medium text-green-600">
                              {formatCurrency(campaign.spend, campaign.accountCurrency)}
                            </td>
                            <td className="text-center p-3 font-medium text-purple-600">
                              {campaign.costPerResult && campaign.costPerResult > 0 
                                ? formatCurrency(campaign.costPerResult, campaign.accountCurrency)
                                : <span className="text-gray-400">N/A</span>
                              }
                            </td>
                            <td className="text-center p-3 font-medium text-blue-600">
                              {campaign.results && campaign.results > 0 
                                ? formatNumber(campaign.results)
                                : <span className="text-gray-400">0</span>
                              }
                            </td>
                            <td className="text-center p-3">
                              {formatCurrency(campaign.cpc, campaign.accountCurrency)}
                            </td>
                            <td className="text-center p-3">
                              {formatCurrency(campaign.cpm, campaign.accountCurrency)}
                            </td>
                            <td className="text-center p-3">
                              <Badge 
                                variant="default" 
                                className={
                                  campaign.isActive 
                                    ? "bg-green-100 text-green-800" 
                                    : "bg-red-100 text-red-800"
                                }
                              >
                                {campaign.isActive ? "Activa" : "Desactivado"}
                              </Badge>
                            </td>
                          </tr>
                        );
                        
                        const adsetRows: JSX.Element[] = [];
                        if (expandedCampaigns.has(campaign.campaignId) && campaignAdsets[campaign.campaignId]) {
                          campaignAdsets[campaign.campaignId]
                            .filter((adset) => {
                              // Filtrar por nombre de conjunto de anuncios
                              const adsetNameMatch = !adsetFilter || 
                                adset.adsetName.toLowerCase().includes(adsetFilter.toLowerCase());
                              return adsetNameMatch;
                            })
                            .forEach((adset, index) => {
                            adsetRows.push(
                              <tr key={`${campaign.campaignId}-adset-${adset.adsetId}`} className="border-b border-gray-50 hover:bg-orange-25 bg-orange-10">
                                <td className="p-3 pl-12">
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 flex items-center justify-center">
                                      <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                    </div>
                                    <div>
                                      <div className="font-medium text-orange-700">🎯 {adset.adsetName}</div>
                                      <div className="text-xs text-gray-500">Adset ID: {adset.adsetId}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-center p-3 text-green-600">
                                  {formatCurrency(adset.spend, adset.accountCurrency)}
                                </td>
                                <td className="text-center p-3 text-purple-600">
                                  {adset.costPerResult && adset.costPerResult > 0 
                                    ? formatCurrency(adset.costPerResult, adset.accountCurrency)
                                    : <span className="text-gray-400">N/A</span>
                                  }
                                </td>
                                <td className="text-center p-3 text-blue-600">
                                  {adset.results && adset.results > 0 
                                    ? formatNumber(adset.results)
                                    : <span className="text-gray-400">0</span>
                                  }
                                </td>
                                <td className="text-center p-3">
                                  {formatCurrency(adset.cpc, adset.accountCurrency)}
                                </td>
                                <td className="text-center p-3">
                                  {formatCurrency(adset.cpm, adset.accountCurrency)}
                                </td>
                                <td className="text-center p-3">
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    Conjunto
                                  </Badge>
                                </td>
                              </tr>
                            );
                          });
                        }
                        
                        return [campaignRow, ...adsetRows];
                      })
                    }
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay campañas disponibles</p>
                <p className="text-sm">Sincroniza para cargar datos de Meta Ads</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Módulo de Informes de Auditoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-500" />
              Informes de Auditoría
            </CardTitle>
            <CardDescription>
              Genera informes detallados de cambios en conjuntos de anuncios y resultados de campañas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filtros */}
              <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">

                
                {/* Filtros de Fecha Personalizada */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={auditFilters.fechaInicio}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, fechaInicio: e.target.value, rangoRapido: 'personalizado' }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Fecha Fin</label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={auditFilters.fechaFin}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, fechaFin: e.target.value, rangoRapido: 'personalizado' }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Campaña</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={auditFilters.campanaId}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, campanaId: e.target.value }))}
                    >
                      <option value="">Todas las campañas</option>
                      {campaigns?.map((campaign) => (
                        <option key={campaign.campaignId} value={campaign.campaignId}>
                          {campaign.campaignName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Botón Generar Informe */}
              <div className="flex justify-center gap-3">
                <Button
                  onClick={generateAuditReport}
                  disabled={generateReportMutation.isPending || !auditFilters.fechaInicio || !auditFilters.fechaFin}
                  className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                >
                  {generateReportMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generar Informe
                </Button>
                
                {auditReport && (
                  <Button
                    onClick={downloadReport}
                    variant="outline"
                    className="border-green-200 hover:bg-green-50 text-green-600"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Informe
                  </Button>
                )}
              </div>

              {/* Resultado del Informe */}
              {auditReport && (
                <div className="space-y-4 mt-6">
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-green-500" />
                      Informe de Auditoría - {auditReport.periodo}
                    </h3>

                    {/* Cambios en Conjuntos y Anuncios */}
                    {auditReport.cambios && auditReport.cambios.adsets ? (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle className="text-base">Auditoría de Cambios en Conjuntos y Anuncios</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">{auditReport.cambios.adsets.total || 0}</div>
                                <div className="text-sm text-gray-600">Conjuntos Activos</div>
                              </div>
                              <div className="p-3 bg-green-50 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{auditReport.cambios.adsets.nuevos || 0}</div>
                                <div className="text-sm text-gray-600">Nuevos</div>
                              </div>
                              <div className="p-3 bg-yellow-50 rounded-lg">
                                <div className="text-2xl font-bold text-yellow-600">{auditReport.cambios.adsets.modificados || 0}</div>
                                <div className="text-sm text-gray-600">Modificados</div>
                              </div>
                              <div className="p-3 bg-red-50 rounded-lg">
                                <div className="text-2xl font-bold text-red-600">{auditReport.cambios.adsets.pausados || 0}</div>
                                <div className="text-sm text-gray-600">Pausados</div>
                              </div>
                            </div>
                            
                            {auditReport.cambios.detalles && auditReport.cambios.detalles.length > 0 && (
                              <div className="mt-4">
                                <h4 className="font-medium mb-2">Cambios Detectados:</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {auditReport.cambios.detalles.map((cambio, index) => (
                                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                                      <div className="font-medium">{cambio.tipo}: {cambio.nombre}</div>
                                      <div className="text-gray-600">{cambio.descripcion}</div>
                                      <div className="text-xs text-gray-500">{cambio.fecha}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Informe Completo Redactado - Siempre Visible */}
                    <Card className="mb-4">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-5 w-5 text-blue-600" />
                          Informe Completo de Auditoría
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 border border-gray-200 rounded-lg shadow-sm">
                          <div className="bg-white p-6 rounded-lg shadow-inner">
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
                              {generateFullReportText(auditReport)}
                            </pre>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Costes y Resultados */}
                    {auditReport.costes && auditReport.resultados && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Costes y Resultados</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Métricas de Coste */}
                            <div>
                              <h4 className="font-medium mb-3 text-gray-700">Inversión Total</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Gasto Total:</span>
                                  <span className="font-semibold text-green-600">
                                    {formatCurrency(auditReport.costes.gastoTotal || 0, auditReport.costes.moneda || 'ARS')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Gasto Promedio Diario:</span>
                                  <span className="font-medium">
                                    {formatCurrency(auditReport.costes.gastoDiario || 0, auditReport.costes.moneda || 'ARS')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>CPC Promedio:</span>
                                  <span className="font-medium">
                                    {formatCurrency(auditReport.costes.cpcPromedio || 0, auditReport.costes.moneda || 'ARS')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>CPM Promedio:</span>
                                  <span className="font-medium">
                                    {formatCurrency(auditReport.costes.cpmPromedio || 0, auditReport.costes.moneda || 'ARS')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Métricas de Resultado */}
                            <div>
                              <h4 className="font-medium mb-3 text-gray-700">Resultados Obtenidos</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Impresiones:</span>
                                  <span className="font-semibold text-blue-600">
                                    {formatNumber(auditReport.resultados.impresiones || 0)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Clics:</span>
                                  <span className="font-semibold text-purple-600">
                                    {formatNumber(auditReport.resultados.clics || 0)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>CTR:</span>
                                  <span className="font-medium">
                                    {(auditReport.resultados.ctr || 0).toFixed(2)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Alcance:</span>
                                  <span className="font-medium">
                                    {formatNumber(auditReport.resultados.alcance || 0)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Frecuencia:</span>
                                  <span className="font-medium">
                                    {(auditReport.resultados.frecuencia || 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Resumen Ejecutivo */}
                          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                            <h4 className="font-semibold mb-2 text-gray-800">Resumen Ejecutivo</h4>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {auditReport.resumen}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}