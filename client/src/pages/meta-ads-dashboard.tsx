import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, DollarSign, TrendingUp, Users, BarChart3, Settings, FileText, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";

interface MetaCampaign {
  campaignId: string;
  campaignName: string;
  spend: number;
  accountCurrency: string;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  frequency: number;
  dateStart: string;
  dateStop: string;
  lastUpdated: Date;
}

interface MetaStats {
  totalSpend: number;
  totalCampaigns: number;
  totalImpressions: number;
  totalClicks: number;
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
}

export default function MetaAdsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado para el módulo de auditoría
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({
    fechaInicio: '',
    fechaFin: '',
    campanaId: ''
  });
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);

  const { data: metaStats, isLoading: statsLoading } = useQuery<MetaStats>({
    queryKey: ['/api/meta-ads/stats'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: campaigns, isLoading: campaignLoading } = useQuery<MetaCampaign[]>({
    queryKey: ['/api/meta-ads/campaigns'],
    refetchInterval: 300000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/meta-ads/sync', { method: 'POST' });
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
      return await apiRequest('/api/meta-ads/test-connection', { method: 'POST' });
    },
    onSuccess: (data) => {
      toast({
        title: "Conexión exitosa",
        description: `Conectado a Meta Ads: ${data.accountName}`,
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
      return await apiRequest('/api/meta-ads/audit-report', { 
        method: 'POST',
        body: JSON.stringify(filters),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data: AuditReport) => {
      setAuditReport(data);
      toast({
        title: "Informe generado",
        description: "El informe de auditoría ha sido generado exitosamente",
      });
    },
    onError: (error: any) => {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard Meta Ads
            </h1>
            <p className="text-gray-600 mt-1">
              Monitoreo en tiempo real de campañas publicitarias
            </p>
          </div>
          
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

        {/* Connection Status */}
        <Card className="border-l-4 border-l-blue-500 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${metaStats?.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-medium">
                  Estado: {metaStats?.isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              {metaStats?.lastSync && (
                <span className="text-sm text-gray-500">
                  Última sincronización: {new Date(metaStats.lastSync).toLocaleString('es-AR')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <CardTitle className="text-sm font-medium">Impresiones</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {metaStats ? formatNumber(metaStats.totalImpressions) : '0'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Total de visualizaciones</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clics Totales</CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {metaStats ? formatNumber(metaStats.totalClicks) : '0'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Interacciones totales</p>
            </CardContent>
          </Card>
        </div>

        {/* Campaigns Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Detalle de Campañas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns && campaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3 font-medium">Campaña</th>
                      <th className="text-center p-3 font-medium">Gasto</th>
                      <th className="text-center p-3 font-medium">Impresiones</th>
                      <th className="text-center p-3 font-medium">Clics</th>
                      <th className="text-center p-3 font-medium">CPC</th>
                      <th className="text-center p-3 font-medium">CPM</th>
                      <th className="text-center p-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr key={campaign.campaignId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{campaign.campaignName}</div>
                            <div className="text-sm text-gray-500">ID: {campaign.campaignId}</div>
                          </div>
                        </td>
                        <td className="text-center p-3 font-medium text-green-600">
                          {formatCurrency(campaign.spend, campaign.accountCurrency)}
                        </td>
                        <td className="text-center p-3">
                          {formatNumber(campaign.impressions)}
                        </td>
                        <td className="text-center p-3">
                          {formatNumber(campaign.clicks)}
                        </td>
                        <td className="text-center p-3">
                          {formatCurrency(campaign.cpc, campaign.accountCurrency)}
                        </td>
                        <td className="text-center p-3">
                          {formatCurrency(campaign.cpm, campaign.accountCurrency)}
                        </td>
                        <td className="text-center p-3">
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Activa
                          </Badge>
                        </td>
                      </tr>
                    ))}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
                  <input
                    type="date"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={auditFilters.fechaInicio}
                    onChange={(e) => setAuditFilters(prev => ({ ...prev, fechaInicio: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fecha Fin</label>
                  <input
                    type="date"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={auditFilters.fechaFin}
                    onChange={(e) => setAuditFilters(prev => ({ ...prev, fechaFin: e.target.value }))}
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

              {/* Botón Generar Informe */}
              <div className="flex justify-center">
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
                    <Card className="mb-4">
                      <CardHeader>
                        <CardTitle className="text-base">Auditoría de Cambios en Conjuntos y Anuncios</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600">{auditReport.cambios.adsets.total}</div>
                              <div className="text-sm text-gray-600">Conjuntos Activos</div>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg">
                              <div className="text-2xl font-bold text-green-600">{auditReport.cambios.adsets.nuevos}</div>
                              <div className="text-sm text-gray-600">Nuevos</div>
                            </div>
                            <div className="p-3 bg-yellow-50 rounded-lg">
                              <div className="text-2xl font-bold text-yellow-600">{auditReport.cambios.adsets.modificados}</div>
                              <div className="text-sm text-gray-600">Modificados</div>
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg">
                              <div className="text-2xl font-bold text-red-600">{auditReport.cambios.adsets.pausados}</div>
                              <div className="text-sm text-gray-600">Pausados</div>
                            </div>
                          </div>
                          
                          {auditReport.cambios.detalles.length > 0 && (
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

                    {/* Costes y Resultados */}
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
                                  {formatCurrency(auditReport.costes.gastoTotal, auditReport.costes.moneda)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Gasto Promedio Diario:</span>
                                <span className="font-medium">
                                  {formatCurrency(auditReport.costes.gastoDiario, auditReport.costes.moneda)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>CPC Promedio:</span>
                                <span className="font-medium">
                                  {formatCurrency(auditReport.costes.cpcPromedio, auditReport.costes.moneda)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>CPM Promedio:</span>
                                <span className="font-medium">
                                  {formatCurrency(auditReport.costes.cpmPromedio, auditReport.costes.moneda)}
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
                                  {formatNumber(auditReport.resultados.impresiones)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Clics:</span>
                                <span className="font-semibold text-purple-600">
                                  {formatNumber(auditReport.resultados.clics)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>CTR:</span>
                                <span className="font-medium">
                                  {auditReport.resultados.ctr.toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Alcance:</span>
                                <span className="font-medium">
                                  {formatNumber(auditReport.resultados.alcance)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Frecuencia:</span>
                                <span className="font-medium">
                                  {auditReport.resultados.frecuencia.toFixed(2)}
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