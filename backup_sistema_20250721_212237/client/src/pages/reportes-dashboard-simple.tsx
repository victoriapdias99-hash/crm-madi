import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BarChart3, Filter, Download, DollarSign, Users, Activity, Target } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from 'recharts';

interface CampanaData {
  cliente: string;
  clienteNombre: string;
  marca: string;
  zona: string;
  numeroCampana: number;
  enviados: number;
  pedidosTotal: number;
  cpl: number;
  inversionRealizada: number;
  inversionPendiente: number;
  fechaCampana: string;
  estadoCampana: string;
  porcentajeDatosEnviados: number;
}

interface FinanzasData {
  cliente: string;
  clienteNombre: string;
  marca: string;
  zona: string;
  numeroCampana: number;
  totalLeads: number;
  cpl: number;
  ventaPorCampana: number;
  inversionTotal: number;
  inversionRealizada: number;
  inversionPendiente: number;
}

interface Filtros {
  marca: string;
  campana: string;
  fechaInicio: string;
  fechaFin: string;
}

const COLORES_MARCAS = {
  'Fiat': '#FF6B6B',
  'Peugeot': '#4ECDC4', 
  'Toyota': '#45B7D1',
  'Chevrolet': '#96CEB4',
  'Renault': '#FECA57',
  'Citroen': '#FF9FF3',
  'Otros': '#BDC3C7'
};

export default function ReportesDashboard() {
  const [filtros, setFiltros] = useState<Filtros>({
    marca: 'todas',
    campana: 'todas',
    fechaInicio: '',
    fechaFin: ''
  });

  const { data: campanasData, isLoading } = useQuery({
    queryKey: ['/api/dashboard/datos-diarios'],
    refetchInterval: 300000,
  });

  const { data: finanzasData, isLoading: isLoadingFinanzas } = useQuery({
    queryKey: ['/api/dashboard/finanzas'],
    refetchInterval: 300000,
  });

  // Filtrar datos según criterios seleccionados
  const datosFiltrados = useMemo(() => {
    if (!campanasData) return [];

    return campanasData.filter((campana: CampanaData) => {
      const fechaCampana = new Date(campana.fechaCampana);
      const fechaInicio = filtros.fechaInicio ? new Date(filtros.fechaInicio) : null;
      const fechaFin = filtros.fechaFin ? new Date(filtros.fechaFin) : null;

      if (filtros.marca !== 'todas' && campana.marca && campana.marca.toLowerCase() !== filtros.marca.toLowerCase()) {
        return false;
      }

      if (filtros.campana !== 'todas' && campana.clienteNombre && campana.clienteNombre.toLowerCase() !== filtros.campana.toLowerCase()) {
        return false;
      }

      if (fechaInicio && fechaCampana < fechaInicio) return false;
      if (fechaFin && fechaCampana > fechaFin) return false;

      return true;
    });
  }, [campanasData, filtros]);

  // Métricas avanzadas de rentabilidad
  const calcularMetricasAvanzadas = useMemo(() => {
    if (!finanzasData || !datosFiltrados) return null;

    const totalInversion = datosFiltrados.reduce((sum, c) => sum + (c.inversionRealizada || 0), 0);
    const totalLeads = datosFiltrados.reduce((sum, c) => sum + (c.enviados || 0), 0);
    const totalVenta = finanzasData
      .filter((f: FinanzasData) => datosFiltrados.some(d => d.clienteNombre === f.clienteNombre && d.numeroCampana === f.numeroCampana))
      .reduce((sum: number, f: FinanzasData) => sum + (f.totalLeads * f.cpl * f.ventaPorCampana), 0);
    
    const gananciaTotal = totalVenta - totalInversion;
    const roiPromedio = totalInversion > 0 ? ((gananciaTotal / totalInversion) * 100) : 0;
    const cplPromedio = totalLeads > 0 ? (totalInversion / totalLeads) : 0;
    const conversionPromedio = datosFiltrados.reduce((sum, c) => sum + c.porcentajeDatosEnviados, 0) / Math.max(datosFiltrados.length, 1);

    return {
      totalInversion,
      totalLeads,
      totalVenta,
      gananciaTotal,
      roiPromedio,
      cplPromedio,
      conversionPromedio,
      campanasActivas: datosFiltrados.filter(c => c.porcentajeDatosEnviados < 100).length,
      campanasFinalizadas: datosFiltrados.filter(c => c.porcentajeDatosEnviados >= 100).length
    };
  }, [finanzasData, datosFiltrados]);

  // Datos para gráfico de barras por marca
  const datosBarrasPorMarca = useMemo(() => {
    const resumenMarcas = datosFiltrados.reduce((acc: any, campana: CampanaData) => {
      const marca = campana.marca;
      if (!acc[marca]) {
        acc[marca] = {
          marca,
          totalLeads: 0,
          totalInversion: 0,
          campañas: 0
        };
      }
      
      acc[marca].totalLeads += campana.enviados;
      acc[marca].totalInversion += campana.inversionRealizada;
      acc[marca].campañas += 1;
      
      return acc;
    }, {});

    return Object.values(resumenMarcas);
  }, [datosFiltrados]);

  // Datos para gráfico de pie de distribución por marca
  const datosPieMarcas = useMemo(() => {
    const totalLeads = datosFiltrados.reduce((sum, campana) => sum + campana.enviados, 0);
    
    const distribucion = datosFiltrados.reduce((acc: any, campana: CampanaData) => {
      const marca = campana.marca;
      if (!acc[marca]) {
        acc[marca] = { marca, leads: 0, porcentaje: 0 };
      }
      acc[marca].leads += campana.enviados;
      return acc;
    }, {});

    return Object.values(distribucion).map((item: any) => ({
      ...item,
      porcentaje: totalLeads > 0 ? (item.leads / totalLeads * 100) : 0
    }));
  }, [datosFiltrados]);

  // Opciones únicas para filtros
  const marcasUnicas = useMemo(() => {
    if (!campanasData) return [];
    return [...new Set(campanasData.map((c: CampanaData) => c.marca).filter(Boolean))];
  }, [campanasData]);

  const campanasUnicas = useMemo(() => {
    if (!campanasData) return [];
    return [...new Set(campanasData.map((c: CampanaData) => c.clienteNombre).filter(Boolean))];
  }, [campanasData]);

  // Función para exportar reportes
  const exportarReporte = () => {
    if (!datosFiltrados) return;

    const csv = [
      ['Cliente', 'Marca', 'Zona', 'Campaña', 'Leads', 'Inversión', 'CPL', '% Completado'],
      ...datosFiltrados.map(c => [
        c.clienteNombre,
        c.marca,
        c.zona,
        c.numeroCampana,
        c.enviados,
        c.inversionRealizada,
        c.cpl,
        c.porcentajeDatosEnviados
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-campanas-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const limpiarFiltros = () => {
    setFiltros({
      marca: 'todas',
      campana: 'todas',
      fechaInicio: '',
      fechaFin: ''
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading || isLoadingFinanzas) {
    return (
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando análisis avanzados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Navigation />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Dashboard de Reportes Avanzados
          </h1>
          <p className="text-muted-foreground">Análisis integral de rentabilidad, tendencias y performance empresarial</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{datosFiltrados.length} de {campanasData?.length || 0} campañas</Badge>
          <Button onClick={exportarReporte} size="sm" variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Dashboard Ejecutivo */}
      {calcularMetricasAvanzadas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Ganancia Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">
                {formatCurrency(calcularMetricasAvanzadas.gananciaTotal)}
              </div>
              <p className="text-xs text-blue-600">
                ROI: {calcularMetricasAvanzadas.roiPromedio.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">
                {calcularMetricasAvanzadas.totalLeads.toLocaleString()}
              </div>
              <p className="text-xs text-green-600">
                CPL Promedio: {formatCurrency(calcularMetricasAvanzadas.cplPromedio)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Campañas Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">
                {calcularMetricasAvanzadas.campanasActivas}
              </div>
              <p className="text-xs text-purple-600">
                {calcularMetricasAvanzadas.campanasFinalizadas} finalizadas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Conversión Promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">
                {calcularMetricasAvanzadas.conversionPromedio.toFixed(1)}%
              </div>
              <p className="text-xs text-orange-600">
                Inversión: {formatCurrency(calcularMetricasAvanzadas.totalInversion)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Panel de Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Análisis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="marca">Marca</Label>
              <Select value={filtros.marca} onValueChange={(value) => setFiltros(prev => ({ ...prev, marca: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las marcas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las marcas</SelectItem>
                  {marcasUnicas.map(marca => (
                    <SelectItem key={marca} value={marca.toLowerCase()}>{marca}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="campana">Campaña</Label>
              <Select value={filtros.campana} onValueChange={(value) => setFiltros(prev => ({ ...prev, campana: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las campañas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las campañas</SelectItem>
                  {campanasUnicas.map(campana => (
                    <SelectItem key={campana} value={campana.toLowerCase()}>{campana}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fechaInicio">Fecha Inicio</Label>
              <Input
                type="date"
                value={filtros.fechaInicio}
                onChange={(e) => setFiltros(prev => ({ ...prev, fechaInicio: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="fechaFin">Fecha Fin</Label>
              <Input
                type="date"
                value={filtros.fechaFin}
                onChange={(e) => setFiltros(prev => ({ ...prev, fechaFin: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={limpiarFiltros} variant="outline" size="sm">
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras por Marca */}
        <Card>
          <CardHeader>
            <CardTitle>Leads e Inversión por Marca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosBarrasPorMarca}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="marca" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value, name) => [
                    name === 'totalLeads' ? value : formatCurrency(Number(value)),
                    name === 'totalLeads' ? 'Total Leads' : 'Inversión Total'
                  ]} />
                  <Bar yAxisId="left" dataKey="totalLeads" fill="#8884d8" />
                  <Bar yAxisId="right" dataKey="totalInversion" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Pie Distribución por Marca */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Leads por Marca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={datosPieMarcas}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="leads"
                    label={({ marca, porcentaje }) => `${marca}: ${porcentaje.toFixed(1)}%`}
                  >
                    {datosPieMarcas.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORES_MARCAS[entry.marca as keyof typeof COLORES_MARCAS] || COLORES_MARCAS.Otros} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Leads']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Datos Filtrados */}
      <Card>
        <CardHeader>
          <CardTitle>Datos Detallados</CardTitle>
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
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Inversión</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">CPL</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Estado</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 text-center">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {datosFiltrados.map((campana: CampanaData, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="border border-gray-300 dark:border-gray-600 p-2">{campana.clienteNombre}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                      <Badge variant="outline">{campana.marca}</Badge>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">#{campana.numeroCampana}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-medium">{campana.enviados}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{formatCurrency(campana.inversionRealizada)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">{formatCurrency(parseFloat(campana.cpl.toString()))}</td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                      <Badge variant={campana.estadoCampana === 'Completada' ? 'default' : 'secondary'}>
                        {campana.estadoCampana}
                      </Badge>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                      {new Date(campana.fechaCampana).toLocaleDateString('es-AR')}
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