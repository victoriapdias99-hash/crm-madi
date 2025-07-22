import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navigation } from "@/components/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart3, Activity, Filter } from "lucide-react";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function ReportesGraficos() {
  const [marcaSeleccionada, setMarcaSeleccionada] = useState<string>("todas");
  const [campannaSeleccionada, setCampannaSeleccionada] = useState<string>("todas");
  
  // Fetch datos diarios
  const { data: datosDiarios = [], isLoading } = useQuery({
    queryKey: ['/api/dashboard/datos-diarios'],
  });

  // Datos filtrados según selecciones
  const datosFiltrados = useMemo(() => {
    return datosDiarios.filter((dato: any) => {
      // Filtro por marca
      if (marcaSeleccionada !== "todas") {
        const clienteNombre = (dato.clienteNombre || dato.cliente || '').toLowerCase();
        let marca = dato.marca || '';
        
        // Siempre extraer marca del nombre del cliente ya que dato.marca viene null
        if (clienteNombre.includes('fiat')) marca = 'Fiat';
        else if (clienteNombre.includes('peugeot')) marca = 'Peugeot';
        else if (clienteNombre.includes('toyota')) marca = 'Toyota';
        else if (clienteNombre.includes('chevrolet')) marca = 'Chevrolet';
        else if (clienteNombre.includes('renault')) marca = 'Renault';
        else if (clienteNombre.includes('citroen')) marca = 'Citroen';
        else marca = 'Otros';
        
        if (marca !== marcaSeleccionada) return false;
      }
      
      // Filtro por campaña
      if (campannaSeleccionada !== "todas") {
        if (dato.numeroCampana?.toString() !== campannaSeleccionada) return false;
      }
      
      return true;
    });
  }, [datosDiarios, marcaSeleccionada, campannaSeleccionada]);

  // Obtener marcas disponibles
  const marcasDisponibles = useMemo(() => {
    const marcas = new Set<string>();
    datosDiarios.forEach((dato: any) => {
      const clienteNombre = (dato.clienteNombre || dato.cliente || '').toLowerCase();
      let marca = dato.marca || '';
      
      // Siempre extraer marca del nombre del cliente ya que dato.marca viene null
      if (clienteNombre.includes('fiat')) marca = 'Fiat';
      else if (clienteNombre.includes('peugeot')) marca = 'Peugeot';
      else if (clienteNombre.includes('toyota')) marca = 'Toyota';
      else if (clienteNombre.includes('chevrolet')) marca = 'Chevrolet';
      else if (clienteNombre.includes('renault')) marca = 'Renault';
      else if (clienteNombre.includes('citroen')) marca = 'Citroen';
      else marca = 'Otros';
      
      if (marca && marca !== 'Otros') {
        marcas.add(marca);
      }
    });
    return Array.from(marcas).sort();
  }, [datosDiarios]);

  // Obtener campañas disponibles  
  const campanasDisponibles = useMemo(() => {
    const campanas = new Set(datosDiarios.map((dato: any) => dato.numeroCampana?.toString()).filter(Boolean));
    return Array.from(campanas).sort((a, b) => parseInt(a) - parseInt(b));
  }, [datosDiarios]);

  // Procesar datos para gráficos (usando datos filtrados)
  const procesarDatosPorMarca = () => {
    const datosPorMarca = datosFiltrados.reduce((acc: any, dato: any) => {
      // Mapear marca desde el cliente si no está presente
      let marca = dato.marca || 'Sin marca';
      
      // Siempre extraer marca del nombre del cliente ya que dato.marca viene null
      const clienteNombre = (dato.clienteNombre || dato.cliente || '').toLowerCase();
      if (clienteNombre.includes('fiat')) marca = 'Fiat';
      else if (clienteNombre.includes('peugeot')) marca = 'Peugeot';
      else if (clienteNombre.includes('toyota')) marca = 'Toyota';
      else if (clienteNombre.includes('chevrolet')) marca = 'Chevrolet';
      else if (clienteNombre.includes('renault')) marca = 'Renault';
      else if (clienteNombre.includes('citroen')) marca = 'Citroen';
      else marca = 'Otros';
      if (!acc[marca]) {
        acc[marca] = {
          marca,
          totalLeads: 0,
          totalInversion: 0,
          totalPedidos: 0,
          campanas: 0
        };
      }
      acc[marca].totalLeads += dato.cantidad || 0;
      acc[marca].totalInversion += (dato.cantidad || 0) * (dato.cpl || 0);
      acc[marca].totalPedidos += dato.pedidosTotal || 0;
      acc[marca].campanas += 1;
      return acc;
    }, {});

    return Object.values(datosPorMarca);
  };

  const procesarDatosPorCliente = () => {
    const datosPorCliente = datosFiltrados.reduce((acc: any, dato: any) => {
      const cliente = dato.cliente || 'Sin cliente';
      if (!acc[cliente]) {
        acc[cliente] = {
          cliente,
          totalLeads: 0,
          totalInversion: 0,
          cplPromedio: 0,
          registros: 0
        };
      }
      acc[cliente].totalLeads += dato.cantidad || 0;
      acc[cliente].totalInversion += (dato.cantidad || 0) * (dato.cpl || 0);
      acc[cliente].registros += 1;
      return acc;
    }, {});

    // Calcular CPL promedio
    Object.values(datosPorCliente).forEach((cliente: any) => {
      cliente.cplPromedio = cliente.totalLeads > 0 ? cliente.totalInversion / cliente.totalLeads : 0;
    });

    return Object.values(datosPorCliente).slice(0, 8); // Top 8 clientes
  };

  const procesarEvolucionTemporal = () => {
    const datosPorFecha = datosFiltrados.reduce((acc: any, dato: any) => {
      const fecha = dato.fecha || 'Sin fecha';
      if (!acc[fecha]) {
        acc[fecha] = {
          fecha,
          totalLeads: 0,
          totalInversion: 0,
          registros: 0
        };
      }
      acc[fecha].totalLeads += dato.cantidad || 0;
      acc[fecha].totalInversion += (dato.cantidad || 0) * (dato.cpl || 0);
      acc[fecha].registros += 1;
      return acc;
    }, {});

    return Object.values(datosPorFecha)
      .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .slice(-30); // Últimos 30 registros
  };

  const datosPorMarca = procesarDatosPorMarca();
  const datosPorCliente = procesarDatosPorCliente();
  const evolucionTemporal = procesarEvolucionTemporal();

  // Estadísticas generales (usando datos filtrados)
  const totalLeads = datosFiltrados.reduce((sum: number, dato: any) => sum + (dato.cantidad || 0), 0);
  const totalInversion = datosFiltrados.reduce((sum: number, dato: any) => sum + ((dato.cantidad || 0) * (dato.cpl || 0)), 0);
  const cplPromedio = totalLeads > 0 ? totalInversion / totalLeads : 0;
  const totalCampanas = new Set(datosFiltrados.map((dato: any) => dato.numeroCampana)).size;

  if (isLoading) {
    return (
      <div className="p-6">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Cargando reportes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Navigation />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Reportes Gráficos
          </h1>
          <p className="text-muted-foreground">
            Análisis visual de los datos diarios de campañas
          </p>
        </div>
      </div>

      {/* Filtros de Análisis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Análisis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Marca</label>
              <Select value={marcaSeleccionada} onValueChange={setMarcaSeleccionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las marcas</SelectItem>
                  {marcasDisponibles.map((marca) => (
                    <SelectItem key={marca} value={marca}>
                      {marca}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Campaña</label>
              <Select value={campannaSeleccionada} onValueChange={setCampannaSeleccionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar campaña" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las campañas</SelectItem>
                  {campanasDisponibles.map((campana) => (
                    <SelectItem key={campana} value={campana}>
                      Campaña #{campana}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Filtros Activos</label>
              <div className="flex flex-wrap gap-2">
                {marcaSeleccionada !== "todas" && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">
                    Marca: {marcaSeleccionada}
                  </span>
                )}
                {campannaSeleccionada !== "todas" && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs">
                    Campaña #{campannaSeleccionada}
                  </span>
                )}
                {marcaSeleccionada === "todas" && campannaSeleccionada === "todas" && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
                    Sin filtros aplicados
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas Generales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {totalLeads.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Leads generados en total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalInversion.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Inversión acumulada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPL Promedio</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${cplPromedio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Costo promedio por lead
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
            <PieChartIcon className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalCampanas}
            </div>
            <p className="text-xs text-muted-foreground">
              Campañas diferentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Torta - Distribución por Marca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-blue-500" />
              Distribución de Leads por Marca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={datosPorMarca}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ marca, percent }) => `${marca} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="totalLeads"
                >
                  {datosPorMarca.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Leads']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Inversión por Marca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-500" />
              Inversión por Marca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosPorMarca}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="marca" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Inversión']} />
                <Legend />
                <Bar dataKey="totalInversion" fill="#00C49F" name="Inversión Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Top Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              Top Clientes por Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosPorCliente} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="cliente" type="category" width={120} />
                <Tooltip formatter={(value) => [value, 'Leads']} />
                <Legend />
                <Bar dataKey="totalLeads" fill="#FF8042" name="Total Leads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Línea - Evolución Temporal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              Evolución Temporal de Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucionTemporal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fecha" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('es-AR')}
                  formatter={(value) => [value, 'Leads']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="totalLeads" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Leads por Día"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Resumen */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen por Marca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Marca</th>
                  <th className="text-right p-2">Total Leads</th>
                  <th className="text-right p-2">Inversión</th>
                  <th className="text-right p-2">CPL Promedio</th>
                  <th className="text-right p-2">Campañas</th>
                </tr>
              </thead>
              <tbody>
                {datosPorMarca.map((marca: any, index: number) => (
                  <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="p-2 font-medium">{marca.marca}</td>
                    <td className="p-2 text-right">{marca.totalLeads.toLocaleString()}</td>
                    <td className="p-2 text-right">${marca.totalInversion.toLocaleString()}</td>
                    <td className="p-2 text-right">
                      ${marca.totalLeads > 0 ? (marca.totalInversion / marca.totalLeads).toFixed(2) : '0.00'}
                    </td>
                    <td className="p-2 text-right">{marca.campanas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Datos Detallados */}
      <Card>
        <CardHeader>
          <CardTitle>Datos Detallados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Marca</th>
                  <th className="text-left p-2">Fecha Inicio</th>
                  <th className="text-left p-2">Fecha Fin</th>
                  <th className="text-right p-2">Días de Campaña</th>
                  <th className="text-left p-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {datosFiltrados.map((dato: any, index: number) => {
                  // Extraer marca del nombre del cliente ya que dato.marca viene null
                  const clienteNombre = (dato.clienteNombre || dato.cliente || '').toLowerCase();
                  let marca = dato.marca || '';
                  if (clienteNombre.includes('fiat')) marca = 'Fiat';
                  else if (clienteNombre.includes('peugeot')) marca = 'Peugeot';
                  else if (clienteNombre.includes('toyota')) marca = 'Toyota';
                  else if (clienteNombre.includes('chevrolet')) marca = 'Chevrolet';
                  else if (clienteNombre.includes('renault')) marca = 'Renault';
                  else if (clienteNombre.includes('citroen')) marca = 'Citroen';
                  else marca = 'Otros';

                  // Calcular fechas de campaña basado en la fecha actual y duración estimada
                  const fechaActual = dato.fecha ? new Date(dato.fecha) : new Date();
                  const fechaInicio = dato.fechaInicio ? new Date(dato.fechaInicio) : new Date(fechaActual.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 días atrás por defecto
                  const fechaFin = dato.fechaFin ? new Date(dato.fechaFin) : fechaActual;
                  const diasCampana = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (24 * 60 * 60 * 1000));

                  return (
                    <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="p-2 font-medium">{dato.clienteNombre || dato.cliente || 'Sin cliente'}</td>
                      <td className="p-2">{marca}</td>
                      <td className="p-2">{fechaInicio.toLocaleDateString('es-AR')}</td>
                      <td className="p-2">{fechaFin.toLocaleDateString('es-AR')}</td>
                      <td className="p-2 text-right">{diasCampana} días</td>
                      <td className="p-2">{fechaActual.toLocaleDateString('es-AR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}