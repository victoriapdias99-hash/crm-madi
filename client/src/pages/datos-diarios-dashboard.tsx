import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCw, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";
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
  inversionTotal: number;
}

export default function DatosDiariosDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cplValues, setCplValues] = useState<Record<number, number>>({});
  const [pedidosPorDiaValues, setPedidosPorDiaValues] = useState<Record<number, number>>({});

  const { data: datosDiarios, isLoading } = useQuery({
    queryKey: ['/api/dashboard/datos-diarios'],
    refetchInterval: 300000, // Refrescar cada 5 minutos
  });

  const updateCplMutation = useMutation({
    mutationFn: async ({ clienteIndex, cpl }: { clienteIndex: number; cpl: number }) => {
      console.log('Updating CPL:', { clienteIndex, cpl });
      const response = await apiRequest('/api/dashboard/update-cpl', 'POST', { clienteIndex, cpl });
      console.log('CPL update response:', response);
      return response;
    },
    onSuccess: (data) => {
      console.log('CPL update successful:', data);
      toast({
        title: "CPL Actualizado",
        description: "El CPL se ha actualizado correctamente",
      });
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

  const updatePedidosPorDiaMutation = useMutation({
    mutationFn: async ({ clienteIndex, pedidos }: { clienteIndex: number; pedidos: number }) => {
      console.log('Updating Pedidos por Día:', { clienteIndex, pedidos });
      const response = await apiRequest('/api/dashboard/update-pedidos-por-dia', 'POST', { clienteIndex, pedidos });
      console.log('Pedidos por día update response:', response);
      return response;
    },
    onSuccess: (data) => {
      console.log('Pedidos por día update successful:', data);
      toast({
        title: "Pedidos por Día Actualizado",
        description: "Los pedidos por día se han actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
    },
    onError: (error) => {
      console.error('Pedidos por día update error:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar los pedidos por día",
        variant: "destructive",
      });
    }
  });

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

  // Calcular inversiones basadas en CPL manual con 2% de impuestos
  const calculateInversions = (data: DatosDiariosData, cpl: number) => {
    const inversionRealizada = data.enviados * cpl * 1.02; // +2% impuestos
    const inversionPendiente = data.faltantesAEnviar * cpl * 1.02; // +2% impuestos
    const inversionTotal = data.pedidosPorDia * cpl * 1.02; // +2% impuestos
    
    return {
      inversionRealizada,
      inversionPendiente,
      inversionTotal
    };
  };

  const handleCplChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCplValues(prev => ({ ...prev, [index]: numValue }));
  };

  const handlePedidosPorDiaChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setPedidosPorDiaValues(prev => ({ ...prev, [index]: numValue }));
  };

  const handleSaveCpl = (index: number) => {
    const cpl = cplValues[index];
    console.log('Attempting to save CPL:', { index, cpl });
    if (cpl && cpl > 0) {
      updateCplMutation.mutate({ clienteIndex: index, cpl });
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

  const handleSavePedidosPorDia = (index: number) => {
    const pedidos = pedidosPorDiaValues[index];
    console.log('Attempting to save Pedidos por Día:', { index, pedidos });
    if (pedidos && pedidos > 0) {
      updatePedidosPorDiaMutation.mutate({ clienteIndex: index, pedidos });
      // Clear the input after saving
      setPedidosPorDiaValues(prev => {
        const newValues = { ...prev };
        delete newValues[index];
        return newValues;
      });
    } else {
      toast({
        title: "Error",
        description: "Por favor ingrese un valor válido de pedidos por día",
        variant: "destructive",
      });
    }
  };

  const clearAllManualValues = () => {
    setCplValues({});
    setPedidosPorDiaValues({});
    toast({
      title: "Valores restablecidos",
      description: "Todos los valores manuales han sido eliminados",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando datos diarios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Navigation />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard - Datos Diarios
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Gestión de campañas Meta Ads con datos reales de Google Sheets
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => mapearCampanasMutation.mutate()}
              disabled={mapearCampanasMutation.isPending}
              variant="default"
              size="sm"
            >
              {mapearCampanasMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Mapear Campañas
            </Button>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
                queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
                queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
                toast({
                  title: "Datos actualizados",
                  description: "Se refrescaron los datos de campañas y clientes",
                });
              }}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button
              onClick={clearAllManualValues}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpiar Valores
            </Button>
          </div>
        </div>

        {/* Panel de Pruebas Funcionales */}
        <TestPanel />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Datos de Campañas por Cliente
              <Badge variant="secondary">{datosDiarios?.length || 0} registros</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-left">Cliente</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-left">Zona</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Enviados</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Entregados/día</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Pedidos/día (Manual)</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Pedidos Total</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">% Desvío</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">% Datos Enviados</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Faltantes</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">CPL Manual (ARS)</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Inversión Realizada (con impuestos)</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Inversión Pendiente (con impuestos)</th>
                    <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Inversión Total (con impuestos)</th>
                  </tr>
                </thead>
                <tbody>
                  {datosDiarios?.map((data: DatosDiariosData, index: number) => {
                    const currentCpl = data.cpl || 0; // Use stored CPL from server
                    const currentPedidosPorDia = pedidosPorDiaValues[index] || data.pedidosPorDia || 0;
                    
                    // Crear objeto actualizado con valores manuales
                    const updatedData = {
                      ...data,
                      pedidosPorDia: currentPedidosPorDia,
                      faltantesAEnviar: Math.max(0, currentPedidosPorDia - data.enviados),
                      porcentajeDesvio: (currentPedidosPorDia > 0 && data.entregadosPorDia > 0) ? 
                        ((data.entregadosPorDia - currentPedidosPorDia) / currentPedidosPorDia * 100) : 0
                    };
                    
                    const inversions = calculateInversions(updatedData, currentCpl);
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="border border-gray-300 dark:border-gray-600 p-2">
                          <div>
                            <div className="font-medium">{data.clienteNombre}</div>
                            <div className="text-sm text-gray-500">{data.cliente}</div>
                            <div className="text-xs text-blue-600 font-semibold">Campaña #{data.numeroCampana || 1}</div>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2">{data.zona}</td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{data.enviados}</td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          {data.entregadosPorDia ? data.entregadosPorDia.toFixed(2) : '0.00'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2">
                          <div className="flex gap-2 items-center justify-center">
                            <Input
                              type="number"
                              placeholder="Pedidos"
                              value={pedidosPorDiaValues[index] || data.pedidosPorDia || ''}
                              onChange={(e) => handlePedidosPorDiaChange(index, e.target.value)}
                              className="w-20"
                            />
                            <Button
                              onClick={() => handleSavePedidosPorDia(index)}
                              size="sm"
                              disabled={updatePedidosPorDiaMutation.isPending}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          {data.pedidosTotal || 0}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <Badge variant={updatedData.porcentajeDesvio && updatedData.porcentajeDesvio < 0 ? "destructive" : "default"}>
                            {updatedData.porcentajeDesvio ? updatedData.porcentajeDesvio.toFixed(2) : '0.00'}%
                          </Badge>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                          <Badge variant={data.porcentajeDatosEnviados >= 80 ? "default" : data.porcentajeDatosEnviados >= 50 ? "secondary" : "destructive"}>
                            {data.porcentajeDatosEnviados ? data.porcentajeDatosEnviados.toFixed(2) : '0.00'}%
                          </Badge>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{updatedData.faltantesAEnviar}</td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2">
                          <div className="flex gap-2 items-center">
                            {data.cpl && data.cpl > 0 ? (
                              <div className="flex gap-2 items-center">
                                <Badge variant="secondary" className="text-sm">
                                  CPL: ARS ${data.cpl.toLocaleString('es-AR')}
                                </Badge>
                                <Input
                                  type="number"
                                  placeholder="Nuevo CPL"
                                  value={cplValues[index] || ''}
                                  onChange={(e) => handleCplChange(index, e.target.value)}
                                  className="w-20 text-xs"
                                  min="0"
                                  step="0.01"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveCpl(index)}
                                  disabled={!cplValues[index] || updateCplMutation.isPending}
                                  variant="outline"
                                >
                                  {updateCplMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Save className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="number"
                                  placeholder="CPL"
                                  value={cplValues[index] || ''}
                                  onChange={(e) => handleCplChange(index, e.target.value)}
                                  className="w-24"
                                  min="0"
                                  step="0.01"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveCpl(index)}
                                  disabled={!cplValues[index] || updateCplMutation.isPending}
                                >
                                  {updateCplMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Save className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                          ARS ${inversions.inversionRealizada.toLocaleString('es-AR')}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                          ARS ${inversions.inversionPendiente.toLocaleString('es-AR')}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                          ARS ${inversions.inversionTotal.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}