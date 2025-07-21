import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp, Calculator, Target } from "lucide-react";
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
  inversionRealizada: number;
  inversionPendiente: number;
  ganancia: number;
  roi: number;
  impuestosIIBB: number;
  totalFacturado: number;
}

export default function FinanzasDashboard() {
  const { data: finanzasData, isLoading } = useQuery({
    queryKey: ['/api/dashboard/finanzas'],
    refetchInterval: 300000,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando análisis financiero...</span>
        </div>
      </div>
    );
  }

  // Calcular métricas generales
  const metricsData = finanzasData ? {
    totalGanancia: finanzasData.reduce((sum: number, f: FinanzasData) => sum + (f?.ganancia || 0), 0),
    totalInversion: finanzasData.reduce((sum: number, f: FinanzasData) => sum + (f?.inversionRealizada || 0), 0),
    totalFacturado: finanzasData.reduce((sum: number, f: FinanzasData) => sum + (f.totalFacturado || 0), 0),
    totalLeads: finanzasData.reduce((sum: number, f: FinanzasData) => sum + (f.totalLeads || 0), 0),
    roiPromedio: 0
  } : null;

  if (metricsData && metricsData.totalInversion > 0) {
    metricsData.roiPromedio = (metricsData.totalGanancia / metricsData.totalInversion) * 100;
  }

  // Agrupar por marca
  const resumenPorMarca = finanzasData ? finanzasData.reduce((acc: any, f: FinanzasData) => {
    const marca = f.marca;
    if (!acc[marca]) {
      acc[marca] = {
        marca,
        totalGanancia: 0,
        totalInversion: 0,
        totalFacturado: 0,
        roiPorMarca: 0,
        campañas: 0,
        totalLeads: 0
      };
    }
    
    acc[marca].totalGanancia += f?.ganancia || 0;
    acc[marca].totalInversion += f?.inversionRealizada || 0;
    acc[marca].totalFacturado += f?.totalFacturado || f?.ventaPorCampana || 0;
    acc[marca].totalLeads += f?.totalLeads || 0;
    acc[marca].campañas += 1;
    
    if (acc[marca].totalInversion > 0) {
      acc[marca].roiPorMarca = (acc[marca].totalGanancia / acc[marca].totalInversion) * 100;
    }
    
    return acc;
  }, {}) : {};

  const marcasArray = Object.values(resumenPorMarca);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Navigation />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            <Calculator className="h-8 w-8 text-blue-600" />
            Dashboard Financiero - Solo Lectura
          </h1>
          <p className="text-muted-foreground">Análisis financiero automático basado en datos de campañas</p>
        </div>
      </div>

      {/* Métricas Principales */}
      {metricsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Ganancia Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">
                {formatCurrency(metricsData.totalGanancia)}
              </div>
              <p className="text-xs text-green-600">
                Ganancia neta del negocio
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                ROI Promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">
                {metricsData.roiPromedio.toFixed(1)}%
              </div>
              <p className="text-xs text-blue-600">
                Retorno de inversión
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Total Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">
                {metricsData.totalLeads.toLocaleString()}
              </div>
              <p className="text-xs text-purple-600">
                Leads generados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Total Facturado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">
                {formatCurrency(metricsData.totalFacturado)}
              </div>
              <p className="text-xs text-orange-600">
                Facturación bruta
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Análisis por Marca */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis Financiero por Marca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-600 p-3 text-left">Marca</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-3 text-center">Campañas</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-3 text-center">Leads</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-3 text-center">Inversión</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-3 text-center">Ganancia</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-3 text-center">ROI</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-3 text-center">Facturado</th>
                </tr>
              </thead>
              <tbody>
                {marcasArray.map((marca: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="border border-gray-300 dark:border-gray-600 p-3">
                      <Badge variant="outline">{marca.marca}</Badge>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">{marca.campañas}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-center font-medium">{marca.totalLeads.toLocaleString()}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">{formatCurrency(marca.totalInversion)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">
                      <span className={marca.totalGanancia >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {formatCurrency(marca.totalGanancia)}
                      </span>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">
                      <span className={marca.roiPorMarca >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {marca.roiPorMarca.toFixed(1)}%
                      </span>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">{formatCurrency(marca.totalFacturado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detalle por Campaña */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Campaña</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-left">Cliente</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Marca</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Campaña</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Leads</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">CPL</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Venta %</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Inversión</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Ganancia</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">ROI</th>
                </tr>
              </thead>
              <tbody>
                {finanzasData?.map((finanza: FinanzasData, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="border border-gray-300 dark:border-gray-600 p-2">{finanza.clienteNombre}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                      <Badge variant="secondary">{finanza.marca}</Badge>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">#{finanza.numeroCampana}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{finanza.totalLeads}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{formatCurrency(finanza.cpl)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{((finanza?.ventaPorCampana || 0) * 100).toFixed(1)}%</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{formatCurrency(finanza?.inversionRealizada || 0)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                      <span className={(finanza?.ganancia || 0) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {formatCurrency(finanza?.ganancia || 0)}
                      </span>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                      <span className={(finanza?.roiNegocio || 0) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {(finanza?.roiNegocio || 0).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}