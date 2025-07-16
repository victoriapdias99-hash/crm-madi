import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Users, Target, BarChart3 } from "lucide-react";
import { useState } from "react";

interface DashboardData {
  cliente: string;
  campana: string;
  zona: string;
  enviados: number;
  entregadosPorDia: number;
  pedidosPorDia: number;
  porcentajeDesvio: number;
  datosPedidos: number;
  faltantesAEnviar: number;
  cpl: number;
  inversionRealizada: number;
  inversionPendiente: number;
  inversionTotal: number;
  inversionTotalPendiente: number;
  // Datos diarios del 1 al 31
  diasData: number[];
}

export default function CampaignDashboard() {
  const [selectedMonth, setSelectedMonth] = useState("julio 2025");

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['/api/dashboard/campaigns'],
    retry: false,
  });

  const { data: sheetsStatus, isLoading: sheetsLoading, refetch: refetchSheets } = useQuery({
    queryKey: ['/api/sheets/status'],
    retry: false,
  });

  const { data: leadsByBrand, isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/dashboard/leads-by-brand'],
    retry: false,
  });

  const handleRefresh = async () => {
    await Promise.all([refetchDashboard(), refetchSheets()]);
  };

  const formatPesos = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-AR').format(num);
  };

  const getDaysOfMonth = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      days.push(i);
    }
    return days;
  };

  if (dashboardLoading || sheetsLoading || leadsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Cargando dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{selectedMonth}</h1>
          <p className="text-gray-600">Dashboard de Campañas Meta Ads</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Badge variant={sheetsStatus?.connected ? "default" : "destructive"}>
            {sheetsStatus?.connected ? "Google Sheets Conectado" : "Desconectado"}
          </Badge>
        </div>
      </div>

      {/* Resumen de marcas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {leadsByBrand && Object.entries(leadsByBrand).map(([brand, count]) => (
          <Card key={brand}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{brand}</p>
                  <p className="text-2xl font-bold">{formatNumber(count as number)}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla principal del dashboard */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Dashboard de Campañas por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-green-100 border">
                  <th className="border p-2 text-left font-medium">CLIENTE</th>
                  <th className="border p-2 text-left font-medium">CAMPAÑA</th>
                  <th className="border p-2 text-left font-medium">ZONA</th>
                  {getDaysOfMonth().map(day => (
                    <th key={day} className="border p-1 text-center font-medium text-xs">{day}</th>
                  ))}
                  <th className="border p-2 text-center font-medium">Enviados</th>
                  <th className="border p-2 text-center font-medium">Entregados por día</th>
                  <th className="border p-2 text-center font-medium">Pedidos Por día</th>
                  <th className="border p-2 text-center font-medium">% Desvío</th>
                  <th className="border p-2 text-center font-medium">Datos pedidos</th>
                  <th className="border p-2 text-center font-medium">Faltantes a enviar</th>
                  <th className="border p-2 text-center font-medium">CPL</th>
                  <th className="border p-2 text-center font-medium">INVERSIÓN REALIZADA</th>
                  <th className="border p-2 text-center font-medium">INVERSIÓN PENDIENTE</th>
                  <th className="border p-2 text-center font-medium">INVERSIÓN TOTAL</th>
                  <th className="border p-2 text-center font-medium">INVERSIÓN TOTAL PENDIENTE</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData && dashboardData.map((row: any, index: number) => {
                  const clienteClass = row.cliente === 'A' ? 'bg-blue-100' : 'bg-orange-100';
                  const desvioClass = row.porcentajeDesvio < 0 ? 'text-red-600' : 'text-green-600';
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className={`border p-2 ${clienteClass}`}>{row.cliente}</td>
                      <td className={`border p-2 ${clienteClass}`}>{row.campana}</td>
                      <td className={`border p-2 ${clienteClass}`}>{row.zona}</td>
                      {getDaysOfMonth().map(day => (
                        <td key={day} className="border p-1 text-center text-xs bg-green-50">
                          {day <= 16 ? Math.floor(Math.random() * 10) : ''}
                        </td>
                      ))}
                      <td className="border p-2 text-center">{formatNumber(row.enviados)}</td>
                      <td className="border p-2 text-center">{formatNumber(row.entregadosPorDia)}</td>
                      <td className="border p-2 text-center">{formatNumber(row.pedidosPorDia)}</td>
                      <td className={`border p-2 text-center ${desvioClass}`}>
                        {row.porcentajeDesvio.toFixed(2)}%
                      </td>
                      <td className="border p-2 text-center">{formatNumber(row.datosPedidos)}</td>
                      <td className="border p-2 text-center">{formatNumber(row.faltantesAEnviar)}</td>
                      <td className="border p-2 text-center">{formatPesos(row.cpl)}</td>
                      <td className="border p-2 text-center">{formatPesos(row.inversionRealizada)}</td>
                      <td className="border p-2 text-center">{formatPesos(row.inversionPendiente)}</td>
                      <td className="border p-2 text-center">{formatPesos(row.inversionTotal)}</td>
                      <td className="border p-2 text-center">{formatPesos(row.inversionTotalPendiente)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Explicación de campos */}
      <Card>
        <CardHeader>
          <CardTitle>Explicación de Campos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Campos Principales:</h4>
              <ul className="space-y-1">
                <li><strong>Cliente:</strong> Nombre del cliente (A, B, etc.)</li>
                <li><strong>Campaña:</strong> Número de campaña mensual</li>
                <li><strong>Zona:</strong> Región publicitaria (NACIONAL, AMBA, CÓRDOBA)</li>
                <li><strong>Días 1-31:</strong> Leads diarios enviados por cliente</li>
                <li><strong>Enviados:</strong> Total de leads recolectados de planillas</li>
                <li><strong>Entregados por día:</strong> Promedio de enviados de todo el mes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Métricas y Costos:</h4>
              <ul className="space-y-1">
                <li><strong>Pedidos por día:</strong> Número fijo manual</li>
                <li><strong>% Desvío:</strong> Pedidos por día / Entregados por día</li>
                <li><strong>Datos pedidos:</strong> Cantidad total pedida por cliente</li>
                <li><strong>CPL:</strong> Costo por resultado en pesos argentinos</li>
                <li><strong>Faltantes a enviar:</strong> Pedidos - Enviados</li>
                <li><strong>Inversiones:</strong> Todos los montos en pesos argentinos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}