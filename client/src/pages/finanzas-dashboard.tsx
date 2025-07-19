import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCw, DollarSign, TrendingUp, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";

interface FinanzasData {
  cliente: string;
  clienteNombre: string;
  campana: string;
  numeroCampana: number;
  marca: string;
  zona: string;
  totalLeads: number;
  cpl: number;
  ventaPorCampana: number;
  inversionTotal: number;
  ganancia: number;
  roiNegocio: number;
  impuestosIIBB: number;
  totalFacturado: number;
}

interface ResumenPorMarca {
  marca: string;
  totalGanancia: number;
  totalInversion: number;
  totalFacturado: number;
  roiPorMarca: number;
  campañas: number;
}

export default function FinanzasDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ventaValues, setVentaValues] = useState<Record<number, number>>({});

  const { data: finanzasData, isLoading } = useQuery({
    queryKey: ['/api/dashboard/finanzas'],
    refetchInterval: 300000, // Refrescar cada 5 minutos
  });

  const updateVentaMutation = useMutation({
    mutationFn: async ({ clienteIndex, venta, clienteNombre, numeroCampana }: { 
      clienteIndex?: number; 
      venta: number; 
      clienteNombre?: string; 
      numeroCampana?: number; 
    }) => {
      await apiRequest('POST', '/api/dashboard/update-venta', { 
        clienteIndex, 
        venta, 
        clienteNombre, 
        numeroCampana 
      });
    },
    onSuccess: (_, variables) => {
      // Actualizar inmediatamente el estado local para respuesta instantánea
      setVentaValues(prev => {
        const newValues = { ...prev };
        delete newValues[variables.clienteIndex || 0];
        return newValues;
      });
      
      toast({
        title: "✓ Venta Guardada",
        description: `Venta actualizada: $${variables.venta}`,
      });
      
      // Refrescar datos para recalcular métricas
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/finanzas'] });
    },
    onError: (error) => {
      toast({
        title: "Error al Guardar",
        description: "No se pudo actualizar la venta por campaña",
        variant: "destructive",
      });
      console.error('Error updating venta:', error);
    }
  });

  const handleVentaChange = (index: number, value: string) => {
    // Permitir valores vacíos y números válidos
    if (value === '') {
      setVentaValues(prev => ({ ...prev, [index]: '' as any }));
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        setVentaValues(prev => ({ ...prev, [index]: numValue }));
      }
    }
  };

  const handleSaveVenta = (index: number, clienteNombre?: string, numeroCampana?: number) => {
    const venta = ventaValues[index];
    
    // Validación más robusta
    if (venta === '' || venta === undefined || venta === null) {
      toast({
        title: "Campo Vacío",
        description: "Ingrese un valor de venta antes de guardar",
        variant: "destructive",
      });
      return;
    }

    const ventaNum = typeof venta === 'string' ? parseFloat(venta) : venta;
    
    if (isNaN(ventaNum) || ventaNum <= 0) {
      toast({
        title: "Valor Inválido",
        description: "Ingrese un valor de venta numérico mayor a 0",
        variant: "destructive",
      });
      return;
    }

    if (!clienteNombre || !numeroCampana) {
      toast({
        title: "Error de Datos",
        description: "Faltan datos de cliente o campaña",
        variant: "destructive",
      });
      return;
    }

    console.log(`💰 Guardando venta: ${clienteNombre} #${numeroCampana} = $${ventaNum}`);
    
    updateVentaMutation.mutate({ 
      clienteIndex: index, 
      venta: ventaNum, 
      clienteNombre, 
      numeroCampana: numeroCampana.toString()
    });
  };

  // Calcular métricas financieras
  const calculateFinancialMetrics = (data: FinanzasData, ventaManual?: number): {
    ganancia: number;
    roiNegocio: number;
    impuestosIIBB: number;
    totalFacturado: number;
  } => {
    const venta = ventaManual || data.ventaPorCampana || 0;
    const totalLeads = data.totalLeads || 0;
    const cpl = data.cpl || 0;
    const inversion = data.inversionTotal || 0;

    // Ganancia: (Total de leads * CPL * Venta por campaña) - Inversión total
    const ingresosTotales = totalLeads * cpl * venta;
    const ganancia = ingresosTotales - inversion;

    // ROI de negocio: (Ganancia / Inversión) * 100
    const roiNegocio = inversion > 0 ? (ganancia / inversion) * 100 : 0;

    // Impuestos IIBB: 4% sobre la venta de cada campaña
    const impuestosIIBB = ingresosTotales * 0.04;

    // Total facturado: coste de venta * cantidad de leads * CPL
    const totalFacturado = totalLeads * cpl * venta;

    return {
      ganancia,
      roiNegocio,
      impuestosIIBB,
      totalFacturado
    };
  };

  // Agrupar datos por marca
  const resumenPorMarca = finanzasData ? finanzasData.reduce((acc: Record<string, ResumenPorMarca>, item: FinanzasData, index: number) => {
    const venta = ventaValues[index] || item.ventaPorCampana || 0;
    const metrics = calculateFinancialMetrics(item, venta);
    
    if (!acc[item.marca]) {
      acc[item.marca] = {
        marca: item.marca,
        totalGanancia: 0,
        totalInversion: 0,
        totalFacturado: 0,
        roiPorMarca: 0,
        campañas: 0
      };
    }

    acc[item.marca].totalGanancia += metrics.ganancia;
    acc[item.marca].totalInversion += item.inversionTotal;
    acc[item.marca].totalFacturado += metrics.totalFacturado;
    acc[item.marca].campañas += 1;

    return acc;
  }, {}) : {};

  // Calcular ROI por marca
  Object.values(resumenPorMarca).forEach(marca => {
    marca.roiPorMarca = marca.totalInversion > 0 ? (marca.totalGanancia / marca.totalInversion) * 100 : 0;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Navigation />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calculator className="h-8 w-8" />
            Dashboard Finanzas
          </h1>
          <p className="text-muted-foreground">Análisis de rentabilidad y ROI por campaña y marca</p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/dashboard/finanzas'] })}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Resumen por marca */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.values(resumenPorMarca).map((marca) => (
          <Card key={marca.marca}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {marca.marca}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(marca.totalGanancia)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ganancia Total</p>
                </div>
                <div className="flex justify-between text-sm">
                  <span>ROI:</span>
                  <Badge variant={marca.roiPorMarca > 0 ? "default" : "destructive"}>
                    {formatPercentage(marca.roiPorMarca)}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Campañas:</span>
                  <span className="font-medium">{marca.campañas}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Facturado:</span>
                  <span className="font-medium">{formatCurrency(marca.totalFacturado)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla detallada de finanzas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Análisis Financiero por Campaña
            <Badge variant="secondary">{finanzasData?.length || 0} campañas</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-left">Cliente</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Marca</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Campaña</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Total Leads</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">CPL</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Venta/Campaña</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Inversión Total</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Ganancia</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">ROI Negocio</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Impuestos IIBB</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Total Facturado</th>
                </tr>
              </thead>
              <tbody>
                {finanzasData?.map((data: FinanzasData, index: number) => {
                  const currentVenta = ventaValues[index] || data.ventaPorCampana || 0;
                  const metrics = calculateFinancialMetrics(data, currentVenta);
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="border border-gray-300 dark:border-gray-600 p-2">
                        <div>
                          <div className="font-medium">{data.clienteNombre}</div>
                          <div className="text-sm text-gray-500">{data.cliente}</div>
                        </div>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                        <Badge variant="outline">{data.marca}</Badge>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                        {data.campana} #{data.numeroCampana}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                        {data.totalLeads}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                        {formatCurrency(data.cpl)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2">
                        <div className="flex gap-2 items-center justify-center">
                          <Input
                            type="number"
                            placeholder="0"
                            value={ventaValues[index] !== undefined ? ventaValues[index] : (data.ventaPorCampana > 0 ? data.ventaPorCampana : "")}
                            onChange={(e) => handleVentaChange(index, e.target.value)}
                            className="w-24 text-center"
                            min="0"
                            step="1000"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveVenta(index, data.clienteNombre, data.numeroCampana)}
                            disabled={updateVentaMutation.isPending}
                            variant={ventaValues[index] ? "default" : "outline"}
                            className={ventaValues[index] ? "bg-green-600 hover:bg-green-700" : ""}
                          >
                            {updateVentaMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                        {formatCurrency(data.inversionTotal)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-bold">
                        <span className={metrics.ganancia >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(metrics.ganancia)}
                        </span>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                        <Badge variant={metrics.roiNegocio >= 0 ? "default" : "destructive"}>
                          {formatPercentage(metrics.roiNegocio)}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                        {formatCurrency(metrics.impuestosIIBB)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">
                        {formatCurrency(metrics.totalFacturado)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Totales generales */}
      {finanzasData && finanzasData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Ganancia Total</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(Object.values(resumenPorMarca).reduce((sum, marca) => sum + marca.totalGanancia, 0))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Inversión Total</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(Object.values(resumenPorMarca).reduce((sum, marca) => sum + marca.totalInversion, 0))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Facturado</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(Object.values(resumenPorMarca).reduce((sum, marca) => sum + marca.totalFacturado, 0))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">ROI Promedio</p>
                <p className="text-2xl font-bold">
                  {formatPercentage(
                    Object.values(resumenPorMarca).reduce((sum, marca) => sum + marca.roiPorMarca, 0) / 
                    Object.values(resumenPorMarca).length || 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}