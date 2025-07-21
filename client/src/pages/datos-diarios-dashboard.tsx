import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Save, RefreshCw, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";
import { CPLStorage } from "@/lib/cpl-storage";
import { debounce, memoize, measurePerformance } from "@/lib/performance";
import TestPanel from "@/components/test-panel";

interface DatosDiariosData {
  cliente: string;
  clienteNombre: string;
  zona: string;
  diasData: number[];
  enviados: number;
  entregadosPorDia: number;
  pedidosPorDia: number;
  pedidosTotal: number;
  numeroCampana: number;
  porcentajeDesvio: number;
  porcentajeDatosEnviados: number;
  faltantesAEnviar: number;
  cpl: number;
  ventaPorCampana: number;
  inversionRealizada: number;
  inversionPendiente: number;
  fechaCampana: string;
  fechaFinReal: string;
  cantidadSolicitada: number;
  diasProcesados: number;
  estadoCampana: string;
}

export default function DatosDiariosDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cplValues, setCplValues] = useState<Record<number, number>>({});
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Por defecto ascendente (menos faltantes primero)
  const [forceShowContent, setForceShowContent] = useState(false);

  const [isManualLoading, setIsManualLoading] = useState(false);
  const [manualData, setManualData] = useState<DatosDiariosData[] | null>(null);
  
  // Real-time optimized query for live data updates
  const { data: datosDiarios, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/dashboard/datos-diarios'],
    refetchInterval: 10 * 1000, // Auto-refresh every 10 seconds for immediate updates
    staleTime: 0, // Always get fresh data for real-time updates
    gcTime: 0, // Don't cache data to ensure fresh data (React Query v5)
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true, // Refresh when window gets focus
    refetchOnMount: true,
    enabled: true,
    refetchOnReconnect: true,
  });

  // Manual data fetching as fallback
  const fetchDataManually = async () => {
    try {
      setIsManualLoading(true);
      const response = await fetch('/api/dashboard/datos-diarios', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Manual fetch successful:', data.length, 'records');
      setManualData(data);
    } catch (err) {
      console.error('Manual fetch failed:', err);
    } finally {
      setIsManualLoading(false);
    }
  };

  // Memoize filtered and sorted data for performance
  const campanasData = useMemo(() => {
    if (!datosDiarios) return { campanasEnProceso: [], campanasFinalizadas: [] };
    
    measurePerformance('Data filtering and sorting', () => {
      // Performance optimization complete
    });
    
    const enProceso = datosDiarios
      .filter(data => data.porcentajeDatosEnviados < 100)
      .sort((a, b) => sortOrder === 'asc' ? a.faltantesAEnviar - b.faltantesAEnviar : b.faltantesAEnviar - a.faltantesAEnviar);
    
    const finalizadas = datosDiarios
      .filter(data => data.porcentajeDatosEnviados >= 100)
      .sort((a, b) => sortOrder === 'asc' ? a.faltantesAEnviar - b.faltantesAEnviar : b.faltantesAEnviar - a.faltantesAEnviar);
    
    return { campanasEnProceso: enProceso, campanasFinalizadas: finalizadas };
  }, [datosDiarios, sortOrder]);

  const campanasEnProceso = campanasData.campanasEnProceso;
  const campanasFinalizadas = campanasData.campanasFinalizadas;

  const finalData: DatosDiariosData[] = datosDiarios || [];
  const finalIsLoading = isLoading;

  console.log('Dashboard loading state:', { isLoading, error, dataLength: finalData.length });
  console.log('Performance data:', { campanasEnProceso: campanasEnProceso.length, campanasFinalizadas: campanasFinalizadas.length });
  
  // Debug para verificar estado del query
  useEffect(() => {
    console.log('Component state update:', { 
      isLoading, 
      hasData: !!datosDiarios, 
      dataLength: datosDiarios?.length,
      errorMessage: error?.message 
    });
  }, [isLoading, datosDiarios, error]);

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
      queryClient.setQueryData(['/api/dashboard/datos-diarios'], (oldData: any) => {
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
      
      // Invalidar queries para sincronización completa
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
    if (!metaCampaigns || !Array.isArray(metaCampaigns) || data.enviados === 0) {
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

    // Extraer marca del nombre del cliente
    let detectedBrand = '';
    for (const [brand, keywords] of Object.entries(brandMap)) {
      if (keywords.some(keyword => 
        data.cliente.toLowerCase().includes(keyword) || 
        data.clienteNombre.toLowerCase().includes(keyword)
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
      return matchingCampaign.spend / data.enviados;
    }

    return 0;
  };

  const mapearCampanasMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/dashboard/mapear-campanas', 'POST');
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Mapeo Exitoso",
        description: `Se mapearon ${data.mapped || 0} campañas con datos diarios`,
      });
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

  // Memoized calculation for inversions - Performance Optimization
  const calculateInversions = useMemo(() => memoize((data: DatosDiariosData, cpl: number) => {
    const inversionRealizada = data.enviados * cpl * 1.02; // +2% impuestos
    const faltantes = Math.max(0, data.pedidosTotal - data.enviados);
    const inversionPendiente = data.porcentajeDatosEnviados >= 100 ? 0 : faltantes * cpl * 1.02;
    
    // Corregir porcentaje de desvío: (Pedidos Total - Enviados) / Enviados × 100
    const porcentajeDesvio = data.enviados > 0 ? ((data.pedidosTotal - data.enviados) / data.enviados) * 100 : 0;
    
    return {
      inversionRealizada,
      inversionPendiente,
      faltantes,
      porcentajeDesvio
    };
  }), []);

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
        numeroCampana: data.numeroCampana
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
      
      // 3. Actualizar todos los datos
      await apiRequest('/api/dashboard/refresh-all-data', 'POST', {});
      
      return { success: true };
    },
    onSuccess: () => {
      // Invalidar todas las queries relevantes para recargar datos frescos
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
      
      // Forzar recarga manual
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

  if (finalIsLoading && !finalData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
          <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">Cargando datos diarios...</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">Procesando {finalData?.length || 0} registros</p>
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

        {/* Panel de Pruebas Funcionales */}
        {/* <TestPanel /> */}

        {/* Campañas en Proceso */}
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-white via-amber-50 to-orange-50 dark:from-gray-800 dark:via-amber-900/10 dark:to-orange-900/10">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                🚀
              </div>
              <span className="text-xl font-bold">Campañas en Proceso</span>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 font-bold">
                {campanasEnProceso.length} en progreso
              </Badge>
              <Button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                variant="secondary"
                size="sm"
                className="bg-white/20 text-white border-white/30 hover:bg-white/30"
              >
                {sortOrder === 'asc' ? '↑' : '↓'} Ordenar por Faltantes
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-left font-semibold text-amber-900 dark:text-amber-100">Cliente</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-left font-semibold text-amber-900 dark:text-amber-100">Zona</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Fecha de Inicio</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Enviados</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Entregados/día</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Pedidos/día</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Pedidos Total</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">% Desvío</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">% Datos Enviados</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Faltantes</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">CPL Guardado</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Inversión Realizada</th>
                    <th className="border border-amber-200 dark:border-amber-600 p-3 text-center font-semibold text-amber-900 dark:text-amber-100">Inversión Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {campanasEnProceso.map((data: DatosDiariosData, index: number) => {
                    // Usar el índice original de la lista completa para identificar correctamente el registro
                    const originalIndex = finalData?.findIndex(d => d.cliente === data.cliente && d.numeroCampana === data.numeroCampana) || 0;
                    const uniqueKey = `${data.cliente}-${data.numeroCampana}`;
                    
                    const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0; // Use CPL from storage or server
                    
                    // Crear objeto actualizado con validaciones para datos > 100%
                    const porcentajeReal = data.pedidosTotal > 0 ? (data.enviados / data.pedidosTotal) * 100 : 0;
                    const esSuperior100 = porcentajeReal > 100;
                    
                    const updatedData = {
                      ...data,
                      faltantesAEnviar: esSuperior100 ? 0 : Math.max(0, data.pedidosTotal - data.enviados), // Si supera 100%, faltantes = 0
                      porcentajeDatosEnviados: Math.min(100, porcentajeReal), // Limitar a 100% para display
                      esSuperior100: esSuperior100
                    };
                    
                    const inversions = calculateInversions(updatedData, currentCpl);
                    
                    return (
                      <tr key={uniqueKey} className="hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/10 dark:hover:to-orange-900/10 transition-all duration-300">
                        <td className="border border-amber-200 dark:border-amber-600 p-3">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{data.clienteNombre}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">{data.cliente}</div>
                            <div className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-1 rounded-full font-semibold w-fit">
                              Campaña #{data.numeroCampana || 1}
                            </div>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 font-medium text-slate-700 dark:text-slate-300">{data.zona}</td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-2 rounded-lg">
                            <span className="font-medium text-green-700 dark:text-green-300">
                              {data.fechaCampana || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-2 rounded-lg">
                            <span className="font-bold text-blue-700 dark:text-blue-300">{data.enviados}</span>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {data.entregadosPorDia ? data.entregadosPorDia.toFixed(2) : '0.00'}
                          </span>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-2 rounded-lg">
                            <span className="font-medium text-blue-600 dark:text-blue-300">{data.pedidosPorDia?.toFixed(2) || '0.00'}</span>
                            <div className="text-xs text-blue-500 mt-1">De campaña</div>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="font-bold text-purple-700 dark:text-purple-300">{data.pedidosTotal || 0}</span>
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
                            {inversions.porcentajeDesvio ? inversions.porcentajeDesvio.toFixed(2) : '0.00'}%
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
                                style={{ width: `${Math.min(data.porcentajeDatosEnviados || 0, 100)}%` }}
                              />
                            </div>
                            <Badge className={`font-bold text-xs ${
                              updatedData.esSuperior100 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                            }`}>
                              {updatedData.porcentajeDatosEnviados.toFixed(1)}%
                              {updatedData.esSuperior100 && <span className="ml-1">✓</span>}
                            </Badge>
                          </div>
                        </td>
                        <td className="border border-amber-200 dark:border-amber-600 p-3 text-center">
                          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="font-bold text-red-700 dark:text-red-300">{inversions.faltantes}</span>
                          </div>
                        </td>
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
                      </tr>
                    );
                  })}
                  {/* Fila de Totales - Campañas en Proceso */}
                  {campanasEnProceso.length > 0 && (
                    <tr className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-800/50 dark:to-orange-800/50 border-t-4 border-amber-500">
                      <td colSpan={9} className="border border-amber-200 dark:border-amber-600 p-3 text-center font-bold text-amber-900 dark:text-amber-100 text-lg">
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
                              const metaAdsAmount = cplReal > 0 ? Math.round(cplReal * data.enviados) : inversions.inversionPendiente;
                              return sum + metaAdsAmount;
                            }, 0).toLocaleString('es-AR')}
                          </span>
                        </div>
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
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                ✅
              </div>
              <span className="text-xl font-bold">Campañas Finalizadas</span>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 font-bold">
                {campanasFinalizadas.length} completadas
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-left font-semibold text-emerald-900 dark:text-emerald-100">Cliente</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-left font-semibold text-emerald-900 dark:text-emerald-100">Zona</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Fecha de Inicio</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Enviados</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Entregados/día</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Pedidos/día</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Pedidos Total</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">% Desvío</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">% Datos Enviados</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Faltantes</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">CPL Guardado</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Inversión Realizada</th>
                    <th className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-semibold text-emerald-900 dark:text-emerald-100">Inversión Pendiente</th>
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
                    
                    return (
                      <tr key={`completed-${index}`} className="hover:bg-green-50 dark:hover:bg-green-900/10">
                        <td className="border border-gray-300 dark:border-gray-600 p-2">
                          <div>
                            <div className="font-medium">{data.clienteNombre}</div>
                            <div className="text-sm text-gray-500">{data.cliente}</div>
                            <div className="text-xs text-green-600 font-semibold">Campaña #{data.numeroCampana || 1}</div>
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
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{data.enviados}</td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          {data.entregadosPorDia ? data.entregadosPorDia.toFixed(2) : '0.00'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-2 rounded-lg">
                            <span className="font-medium text-blue-600 dark:text-blue-300">{data.pedidosPorDia?.toFixed(2) || '0.00'}</span>
                            <div className="text-xs text-blue-500 mt-1">De campaña</div>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="font-bold text-purple-700 dark:text-purple-300">{data.pedidosTotal || 0}</span>
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
                            {inversions.porcentajeDesvio ? inversions.porcentajeDesvio.toFixed(2) : '0.00'}%
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
                              {data.porcentajeDatosEnviados ? data.porcentajeDatosEnviados.toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-2 rounded-lg">
                            <span className="font-bold text-red-700 dark:text-red-300">{inversions.faltantes}</span>
                          </div>
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
                          {(() => {
                            const cplReal = calculateCPLReal(data);
                            return cplReal > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  ARS ${Math.round(cplReal).toLocaleString('es-AR')}
                                </Badge>
                                <div className="text-xs text-gray-500">Meta Ads</div>
                              </div>
                            ) : (
                              <div className="text-gray-400 text-sm">-</div>
                            );
                          })()}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                          ARS ${inversions.inversionPendiente.toLocaleString('es-AR')}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                          ARS ${inversions.inversionRealizada.toLocaleString('es-AR')}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila de Totales - Campañas Finalizadas */}
                  {campanasFinalizadas.length > 0 && (
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-800/50 dark:to-green-800/50 border-t-4 border-emerald-500">
                      <td colSpan={9} className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-bold text-emerald-900 dark:text-emerald-100 text-lg">
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
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-bold text-emerald-900 dark:text-emerald-100">
                        —
                      </td>
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-medium">
                        <div className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-800/50 dark:to-red-800/50 p-2 rounded-lg">
                          <span className="text-orange-700 dark:text-orange-300 font-bold">
                            ARS ${campanasFinalizadas.reduce((sum, data) => {
                              const currentCpl = CPLStorage.get(data.cliente, data.numeroCampana.toString()) || data.cpl || 0;
                              const inversions = calculateInversions(data, currentCpl);
                              return sum + inversions.inversionPendiente;
                            }, 0).toLocaleString('es-AR')}
                          </span>
                        </div>
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
                      <td className="border border-emerald-200 dark:border-emerald-600 p-3 text-center font-bold text-emerald-900 dark:text-emerald-100">
                        —
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {datosDiarios?.filter(data => data.porcentajeDatosEnviados >= 100).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay campañas finalizadas aún
                </div>
              )}
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
                        return sum + (data.porcentajeDatosEnviados >= 100 ? inversions.inversionPendiente : metaAdsAmount);
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
                        const pendiente = data.porcentajeDatosEnviados >= 100 ? inversions.inversionPendiente : metaAdsAmount;
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
    </div>
  );
}