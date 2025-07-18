import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, DollarSign, TrendingUp, Users, BarChart3 } from "lucide-react";
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

export default function MetaAdsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      </div>
    </div>
  );
}