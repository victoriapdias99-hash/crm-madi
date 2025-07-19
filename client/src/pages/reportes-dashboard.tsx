import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, BarChart3, Filter, Calendar, TrendingUp, PieChart, Target } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart, Line, Area, AreaChart } from 'recharts';

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

interface Filtros {
  marca: string;
  campana: string;
  fechaInicio: string;
  fechaFin: string;
  mes: string;
  año: string;
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
    fechaFin: '',
    mes: 'todos',
    año: 'todos'
  });

  const { data: campanasData, isLoading } = useQuery({
    queryKey: ['/api/dashboard/datos-diarios'],
    refetchInterval: 300000, // Refrescar cada 5 minutos
  });

  // Filtrar datos según criterios seleccionados
  const datosFiltrados = useMemo(() => {
    if (!campanasData) return [];

    return campanasData.filter((campana: CampanaData) => {
      const fechaCampana = new Date(campana.fechaCampana);
      const fechaInicio = filtros.fechaInicio ? new Date(filtros.fechaInicio) : null;
      const fechaFin = filtros.fechaFin ? new Date(filtros.fechaFin) : null;

      // Filtro por marca
      if (filtros.marca !== 'todas' && campana.marca.toLowerCase() !== filtros.marca.toLowerCase()) {
        return false;
      }

      // Filtro por campaña específica
      if (filtros.campana !== 'todas' && campana.clienteNombre.toLowerCase() !== filtros.campana.toLowerCase()) {
        return false;
      }

      // Filtro por rango de fechas
      if (fechaInicio && fechaCampana < fechaInicio) return false;
      if (fechaFin && fechaCampana > fechaFin) return false;

      // Filtro por mes
      if (filtros.mes !== 'todos' && fechaCampana.getMonth() !== parseInt(filtros.mes)) {
        return false;
      }

      // Filtro por año
      if (filtros.año !== 'todos' && fechaCampana.getFullYear() !== parseInt(filtros.año)) {
        return false;
      }

      return true;
    });
  }, [campanasData, filtros]);

  // Datos para gráfico de barras por marca
  const datosBarrasPorMarca = useMemo(() => {
    const resumenMarcas = datosFiltrados.reduce((acc: any, campana: CampanaData) => {
      const marca = campana.marca;
      if (!acc[marca]) {
        acc[marca] = {
          marca,
          totalLeads: 0,
          totalInversion: 0,
          campañas: 0,
          cplPromedio: 0
        };
      }
      
      acc[marca].totalLeads += campana.enviados;
      acc[marca].totalInversion += campana.inversionRealizada;
      acc[marca].campañas += 1;
      acc[marca].cplPromedio += parseFloat(campana.cpl.toString());
      
      return acc;
    }, {});

    // Calcular promedios
    Object.values(resumenMarcas).forEach((marca: any) => {
      marca.cplPromedio = marca.cplPromedio / marca.campañas;
    });

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

  // Datos para gráfico de área temporal
  const datosTemporales = useMemo(() => {
    const datosPorMes = datosFiltrados.reduce((acc: any, campana: CampanaData) => {
      const fecha = new Date(campana.fechaCampana);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[mesKey]) {
        acc[mesKey] = {
          mes: mesKey,
          leads: 0,
          inversion: 0,
          campañas: 0
        };
      }
      
      acc[mesKey].leads += campana.enviados;
      acc[mesKey].inversion += campana.inversionRealizada;
      acc[mesKey].campañas += 1;
      
      return acc;
    }, {});

    return Object.values(datosPorMes).sort((a: any, b: any) => a.mes.localeCompare(b.mes));
  }, [datosFiltrados]);

  // Opciones únicas para filtros
  const marcasUnicas = useMemo(() => {
    if (!campanasData) return [];
    return [...new Set(campanasData.map((c: CampanaData) => c.marca))];
  }, [campanasData]);

  const campanasUnicas = useMemo(() => {
    if (!campanasData) return [];
    return [...new Set(campanasData.map((c: CampanaData) => c.clienteNombre))];
  }, [campanasData]);

  const añosUnicos = useMemo(() => {
    if (!campanasData) return [];
    return [...new Set(campanasData.map((c: CampanaData) => new Date(c.fechaCampana).getFullYear()))].sort();
  }, [campanasData]);

  const limpiarFiltros = () => {
    setFiltros({
      marca: 'todas',
      campana: 'todas',
      fechaInicio: '',
      fechaFin: '',
      mes: 'todos',
      año: 'todos'
    });
  };

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
            <BarChart3 className="h-8 w-8" />
            Dashboard de Reportes
          </h1>
          <p className="text-muted-foreground">Análisis visual y filtrado de campañas por marca, fecha y rendimiento</p>
        </div>
        <Badge variant="secondary">{datosFiltrados.length} de {campanasData?.length || 0} campañas</Badge>
      </div>

      {/* Panel de Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Análisis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <Label htmlFor="mes">Mes</Label>
              <Select value={filtros.mes} onValueChange={(value) => setFiltros(prev => ({ ...prev, mes: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los meses</SelectItem>
                  <SelectItem value="0">Enero</SelectItem>
                  <SelectItem value="1">Febrero</SelectItem>
                  <SelectItem value="2">Marzo</SelectItem>
                  <SelectItem value="3">Abril</SelectItem>
                  <SelectItem value="4">Mayo</SelectItem>
                  <SelectItem value="5">Junio</SelectItem>
                  <SelectItem value="6">Julio</SelectItem>
                  <SelectItem value="7">Agosto</SelectItem>
                  <SelectItem value="8">Septiembre</SelectItem>
                  <SelectItem value="9">Octubre</SelectItem>
                  <SelectItem value="10">Noviembre</SelectItem>
                  <SelectItem value="11">Diciembre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="año">Año</Label>
              <Select value={filtros.año} onValueChange={(value) => setFiltros(prev => ({ ...prev, año: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los años" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los años</SelectItem>
                  {añosUnicos.map(año => (
                    <SelectItem key={año} value={año.toString()}>{año}</SelectItem>
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

      {/* Métricas Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Target className="h-5 w-5 text-blue-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{datosFiltrados.reduce((sum, c) => sum + c.enviados, 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Inversión Total</p>
                <p className="text-2xl font-bold">{formatCurrency(datosFiltrados.reduce((sum, c) => sum + c.inversionRealizada, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-purple-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Campañas Activas</p>
                <p className="text-2xl font-bold">{datosFiltrados.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <PieChart className="h-5 w-5 text-orange-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">CPL Promedio</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(datosFiltrados.length > 0 ? 
                    datosFiltrados.reduce((sum, c) => sum + parseFloat(c.cpl.toString()), 0) / datosFiltrados.length : 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)}%`, 'Porcentaje']} />
                  <RechartsPieChart data={datosPieMarcas}>
                    {datosPieMarcas.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORES_MARCAS[entry.marca as keyof typeof COLORES_MARCAS] || COLORES_MARCAS.Otros} />
                    ))}
                  </RechartsPieChart>
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico Temporal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolución Temporal de Leads e Inversión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={datosTemporales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value, name) => [
                    name === 'leads' ? value : formatCurrency(Number(value)),
                    name === 'leads' ? 'Leads' : 'Inversión'
                  ]} />
                  <Area yAxisId="left" type="monotone" dataKey="leads" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Area yAxisId="right" type="monotone" dataKey="inversion" stackId="2" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                </AreaChart>
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