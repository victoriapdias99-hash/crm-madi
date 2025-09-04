import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, RefreshCw, Download, Filter, Power, Edit, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { CPLStorage } from "@/lib/cpl-storage";
import { debounce, memoize, measurePerformance } from "@/lib/performance";

interface DatosDiariosData {
  cliente: string;
  clienteNombre: string;
  marca: string;
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
  fechaFinReal: string | null;
  cantidadSolicitada: number;
  diasProcesados: number;
  estadoCampana: string;
  duplicados?: number;
  faltantes?: number;
  esSuperior100?: boolean;
}

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

export default function DatosDiariosDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cplValues, setCplValues] = useState<Record<number, number>>({});

  const [forceShowContent, setForceShowContent] = useState(false);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [sortByDate, setSortByDate] = useState<'desc' | 'asc'>('desc'); // Por defecto más reciente primero
  
  // Estados para filtros de Campañas en Proceso
  const [filtroZona, setFiltroZona] = useState<string>('');
  const [filtroMarca, setFiltroMarca] = useState<string>('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState<string>('');
  const [filtroFechaFin, setFiltroFechaFin] = useState<string>('');
  
  // Estado para filtro de Campañas Finalizadas
  const [filtroMesFinalizadas, setFiltroMesFinalizadas] = useState<string>('all');
  
  // Estados para modal de detalles y acciones
  const [selectedCampaign, setSelectedCampaign] = useState<DatosDiariosData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isClosingCampaign, setIsClosingCampaign] = useState(false);
  const [, setLocation] = useLocation();

  // Función para exportar una campaña individual a CSV
  const handleExportCampanaCSV = async (campana: DatosDiariosData) => {
    const campaignKey = `${campana.cliente}-export`;
    setExportingCSV(true);
    
    try {
      console.log(`🔽 Exportando CSV para campaña: ${campana.cliente}`);
      console.log(`🔍 DEBUG: URL del endpoint:`, `/api/export/campana-leads/${encodeURIComponent(campana.cliente)}`);
      
      const response = await apiRequest(`/api/export/campana-leads/${encodeURIComponent(campana.cliente)}`, 'GET');
      console.log(`📡 DEBUG: Response status:`, response.status);
      console.log(`📡 DEBUG: Response ok:`, response.ok);
      
      const data = await response.json();
      console.log(`📦 DEBUG: Data recibida completa:`, data);
      console.log(`📦 DEBUG: totalLeads en respuesta:`, data.totalLeads);
      
      const leads = data.leads || [];
      console.log(`📊 DEBUG: Recibidos ${leads.length} leads del endpoint`);
      console.log(`📋 DEBUG: Primeros 3 leads:`, leads.slice(0, 3));
      
      // Generar CSV para esta campaña específica
      const csvContent = generateCSVFromSingleCampana(campana, leads);
      console.log(`📄 DEBUG: CSV generado tiene ${csvContent.split('\n').length} líneas`);
      console.log(`📄 DEBUG: Primeras 5 líneas del CSV:`, csvContent.split('\n').slice(0, 5));
      
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
      console.error('Error exportando CSV:', error);
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
      console.error('Error en sincronización smart:', error);
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

  // Memoize filtered and sorted data for performance
  const campanasData = useMemo(() => {
    // Verificar que datosDiarios existe y es un array
    if (!datosDiarios || !Array.isArray(datosDiarios)) {
      console.warn('⚠️ datosDiarios is not an array:', datosDiarios);
      return { campanasEnProceso: [], campanasFinalizadas: [] };
    }
    
    measurePerformance('Data filtering and sorting', () => {
      // Performance optimization complete
    });
    
    let filteredData = datosDiarios;
    
    // Aplicar filtros de zona, marca y fecha de inicio
    if (filtroZona) {
      filteredData = filteredData.filter((data: DatosDiariosData) => data.zona === filtroZona);
    }
    
    if (filtroMarca) {
      filteredData = filteredData.filter((data: DatosDiariosData) => {
        const marca = data.cliente.match(/^([A-Z]+)/)?.[1] || data.cliente.split(' ')[0];
        return marca === filtroMarca;
      });
    }
    
    if (filtroFechaInicio) {
      filteredData = filteredData.filter((data: DatosDiariosData) => 
        data.fechaCampana && data.fechaCampana >= filtroFechaInicio
      );
    }
    
    if (filtroFechaFin) {
      filteredData = filteredData.filter((data: DatosDiariosData) => 
        data.fechaCampana && data.fechaCampana <= filtroFechaFin
      );
    }
    
    // If showing duplicates only, filter to show campaigns with duplicate data
    if (showDuplicatesOnly) {
      filteredData = filteredData.filter((data: DatosDiariosData) => {
        return (data.duplicados || 0) > 0;
      });
    }
    
    // Función segura para parsear fechas
    const parseDate = (dateStr: string) => {
      if (!dateStr || dateStr === 'null') return new Date(0); // Fecha por defecto muy antigua
      
      try {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? new Date(0) : date;
      } catch (error) {
        console.warn('⚠️ Error parsing date:', dateStr);
        return new Date(0);
      }
    };
    
    // Separar campañas según tengan fecha_fin o no
    const sortedData = filteredData.sort((a, b) => {
      // Ordenar por fecha de campaña según el estado sortByDate
      const dateA = parseDate(a.fechaCampana);
      const dateB = parseDate(b.fechaCampana);
      return sortByDate === 'desc' 
        ? dateB.getTime() - dateA.getTime() // Descendente (más reciente primero)
        : dateA.getTime() - dateB.getTime(); // Ascendente (más antigua primero)
    });

    // Campañas en proceso: sin fechaFin
    const enProceso = sortedData.filter(data => !data.fechaFin);
    
    // Campañas finalizadas: con fechaFin
    const finalizadas = sortedData.filter(data => data.fechaFin);
    
    console.log(`📊 Datos ordenados: ${enProceso.length} en proceso, ${finalizadas.length} finalizadas`);
    
    return { campanasEnProceso: enProceso, campanasFinalizadas: finalizadas };
  }, [datosDiarios, showDuplicatesOnly, sortByDate, filtroZona, filtroMarca, filtroFechaInicio, filtroFechaFin, filtroMesFinalizadas]);

  const { campanasEnProceso, campanasFinalizadas } = campanasData;

  const finalData: DatosDiariosData[] = Array.isArray(datosDiarios) ? datosDiarios : [];
  const finalIsLoading = isLoading;

  console.log('Dashboard loading state:', { isLoading, error, dataLength: finalData.length });
  console.log('Performance data:', { campanasEnProceso: campanasEnProceso?.length || 0, campanasFinalizadas: campanasFinalizadas?.length || 0 });
  
  // Debug para verificar estado del query
  useEffect(() => {
    console.log('Component state update:', { 
      isLoading, 
      hasData: !!datosDiarios, 
      dataLength: Array.isArray(datosDiarios) ? datosDiarios.length : 0,
      errorMessage: error?.message 
    });
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
      return matchingCampaign.spend / data.enviados;
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
    const safeEnviados = isNaN(data.enviados) || !data.enviados ? 0 : data.enviados;
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
  const handleCloseCampaign = async (campaign: DatosDiariosData) => {
    setIsClosingCampaign(true);
    try {
      const response = await apiRequest('/api/campaign-closure/execute', 'POST', {
        clienteId: campaign.cliente,
        campaignNumber: campaign.numeroCampana
      });
      
      if (response.ok) {
        toast({
          title: "Campaña cerrada",
          description: `La campaña ${campaign.cliente} #${campaign.numeroCampana} ha sido cerrada exitosamente`,
        });
        // Refrescar datos
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      } else {
        throw new Error('Error al cerrar la campaña');
      }
    } catch (error) {
      console.error('Error closing campaign:', error);
      toast({
        title: "Error",
        description: "No se pudo cerrar la campaña. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsClosingCampaign(false);
    }
  };

  const handleEditCampaign = (campaign: DatosDiariosData) => {
    // Redirigir a la página de gestión de campañas con filtro específico
    setLocation(`/campanas-management?cliente=${encodeURIComponent(campaign.cliente)}`);
  };

  const handleViewDetails = (campaign: DatosDiariosData) => {
    setSelectedCampaign(campaign);
    setIsDetailsModalOpen(true);
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
              onClick={() => closeCampaignsMutation.mutate()}
              disabled={closeCampaignsMutation.isPending}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold shadow-xl transform hover:scale-105 transition-all duration-300 px-4 py-3"
              size="lg"
              data-testid="button-close-campaigns"
            >
              {closeCampaignsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Power className="h-4 w-4 mr-2" />
              )}
              Cerrar Campañas
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
                
                <Select value={filtroZona || "all"} onValueChange={(value) => setFiltroZona(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-zona">
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
                  <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm" data-testid="filter-marca">
                    <SelectValue placeholder="Todas las marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las marcas</SelectItem>
                    {opcionesMarca.map(marca => (
                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={filtroFechaInicio}
                  onChange={(e) => setFiltroFechaInicio(e.target.value)}
                  className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 placeholder:text-white/60 text-sm"
                  data-testid="filter-fecha-inicio"
                />

                <Input
                  type="date"
                  value={filtroFechaFin}
                  onChange={(e) => setFiltroFechaFin(e.target.value)}
                  className="w-44 bg-white/20 text-white border-white/30 hover:bg-white/30 placeholder:text-white/60 text-sm"
                  data-testid="filter-fecha-fin"
                />

                {(filtroZona || filtroMarca || filtroFechaInicio || filtroFechaFin) && (
                  <Button
                    onClick={() => {
                      setFiltroZona('');
                      setFiltroMarca('');
                      setFiltroFechaInicio('');
                      setFiltroFechaFin('');
                    }}
                    variant="secondary"
                    size="sm"
                    className="bg-red-500/80 hover:bg-red-600/80 text-white border-red-300 text-sm"
                    data-testid="button-clear-filters"
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
                          <div className="flex gap-2 justify-center">
                            <Button
                              onClick={() => handleCloseCampaign(data)}
                              disabled={isClosingCampaign}
                              size="sm"
                              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-lg"
                              data-testid={`button-close-campaign-${data.cliente.replace(/\s+/g, '-')}`}
                            >
                              {isClosingCampaign ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Power className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              onClick={() => handleEditCampaign(data)}
                              size="sm"
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg"
                              data-testid={`button-edit-campaign-${data.cliente.replace(/\s+/g, '-')}`}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              onClick={() => handleViewDetails(data)}
                              size="sm"
                              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg"
                              data-testid={`button-view-details-${data.cliente.replace(/\s+/g, '-')}`}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
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
                                style={{ width: `${Math.min(updatedData.porcentajeDatosEnviados || 0, 100)}%` }}
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
                                return sum + (data.duplicados || 0);
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
                              const metaAdsAmount = cplReal > 0 ? Math.round(cplReal * data.enviados) : inversions.inversionPendiente;
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
              
              {/* Control de filtro de mes */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Filtro de mes:</span>
                </div>
                
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

                {filtroMesFinalizadas && filtroMesFinalizadas !== 'all' && (
                  <Button
                    onClick={() => setFiltroMesFinalizadas('all')}
                    variant="secondary"
                    size="sm"
                    className="bg-red-500/80 hover:bg-red-600/80 text-white border-red-300 text-sm"
                    data-testid="button-clear-filter-finalizadas"
                  >
                    ✕ Limpiar filtro
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
                    
                    return (
                      <tr key={`completed-${index}`} className="hover:bg-green-50 dark:hover:bg-green-900/10">
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
                          {data.entregadosPorDia ? data.entregadosPorDia.toFixed(2) : '0.00'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-2 rounded-lg">
                            <span className="font-medium text-blue-600 dark:text-blue-300">{data.pedidosPorDia?.toFixed(2) || '0.00'}</span>
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{selectedCampaign.porcentajeDatosEnviados?.toFixed(1) || '0.0'}%</div>
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
                      {selectedCampaign.entregadosPorDia?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-amber-600 dark:text-amber-400">Pedidos por Día</div>
                    <div className="text-lg font-bold text-amber-800 dark:text-amber-200">
                      {selectedCampaign.pedidosPorDia?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción en el modal */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    handleEditCampaign(selectedCampaign);
                  }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar Campaña
                </Button>
                <Button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    handleCloseCampaign(selectedCampaign);
                  }}
                  className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white"
                  disabled={isClosingCampaign}
                >
                  {isClosingCampaign ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Power className="w-4 h-4 mr-2" />
                  )}
                  Cerrar Campaña
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
    </div>
  );
}