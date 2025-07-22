import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";

interface CampaignData {
  id: number;
  clienteId: number;
  clienteNombre: string;
  numeroCampana: string;
  marca: string;
  zona: string;
  fechaCampana: string;
  cantidadDatosSolicitados: number;
  enviados: number;
  cpl: number;
  venta: number;
  ventaPorCampana: number;
  inversion: number;
  inversionRealizada: number;
  inversionPendiente: number;
  porcentajeCompletado: number;
  estado: string;
  cpa: number;
}

export default function DatosDiariosCentralized() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Obtener datos desde endpoint centralizado
  const { data: campaigns, isLoading, refetch } = useQuery({
    queryKey: ['/api/datos-diarios/centralized'],
    refetchInterval: 30000, // Auto refresh cada 30 segundos
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Forzar sincronización desde base de datos
      await fetch('/api/data/sync-all', { method: 'POST' });
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
        <Navigation />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Cargando datos centralizados...</span>
        </div>
      </div>
    );
  }

  const campaignsArray = Array.isArray(campaigns) ? campaigns : [];
  const enProceso = campaignsArray.filter((c: CampaignData) => c.porcentajeCompletado < 100);
  const completadas = campaignsArray.filter((c: CampaignData) => c.porcentajeCompletado >= 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <Navigation />
      
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Datos Diarios Centralizados
            </h1>
            <p className="text-gray-600 mt-2">
              Dashboard unificado con datos 100% desde base de datos
            </p>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sincronizar
          </Button>
        </div>

        {/* Resumen general */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">{campaignsArray.length}</div>
              <p className="text-sm text-gray-600">Total Campañas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-orange-600">{enProceso.length}</div>
              <p className="text-sm text-gray-600">En Proceso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">{completadas.length}</div>
              <p className="text-sm text-gray-600">Completadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-purple-600">
                {campaignsArray.reduce((sum: number, c: CampaignData) => sum + c.enviados, 0)}
              </div>
              <p className="text-sm text-gray-600">Total Enviados</p>
            </CardContent>
          </Card>
        </div>

        {/* Campañas en proceso */}
        {enProceso.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600">Campañas en Proceso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enProceso.map((campaign: CampaignData) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold">{campaign.clienteNombre}</div>
                      <div className="text-sm text-gray-600">
                        {campaign.marca} #{campaign.numeroCampana} • {campaign.zona}
                      </div>
                      <div className="mt-2">
                        <Progress value={campaign.porcentajeCompletado} className="w-full" />
                        <div className="text-xs text-gray-500 mt-1">
                          {campaign.enviados} / {campaign.cantidadDatosSolicitados} enviados
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-6">
                      <Badge variant={campaign.porcentajeCompletado > 75 ? "default" : "secondary"}>
                        {campaign.porcentajeCompletado}%
                      </Badge>
                      <div className="text-sm text-gray-600 mt-1">
                        CPL: ${campaign.cpl.toLocaleString()}
                      </div>
                      {campaign.cpa > 0 && (
                        <div className="text-sm text-blue-600">
                          CPA: ${campaign.cpa.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campañas completadas */}
        {completadas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Campañas Completadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completadas.map((campaign: CampaignData) => (
                  <div key={campaign.id} className="p-4 border rounded-lg bg-green-50">
                    <div className="font-semibold">{campaign.clienteNombre}</div>
                    <div className="text-sm text-gray-600">
                      {campaign.marca} #{campaign.numeroCampana} • {campaign.zona}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <span className="text-sm">
                        {campaign.enviados} enviados
                      </span>
                      <Badge className="bg-green-600">Completada</Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Inversión: ${campaign.inversionRealizada.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}