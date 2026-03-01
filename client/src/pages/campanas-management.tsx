import { useState, useMemo, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Calendar, Target, Package, Copy, Clock, Edit2, Check, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";
import { 
  insertCampanaComercialSchema, 
  type CampanaComercial, 
  type InsertCampanaComercial,
  type Cliente,
  MARCAS_DISPONIBLES,
  ZONAS_DISPONIBLES
} from "@shared/schema";

// Función para formatear fechas sin problemas de timezone
function formatDateForDisplay(dateString: string): string {
  if (!dateString) return 'No especificada';
  
  // Si viene en formato YYYY-MM-DD, convertir a DD/MM/YYYY
  if (dateString.includes('-') && dateString.length === 10) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  
  // Si ya viene en formato DD/MM/YYYY, devolverlo tal como está
  return dateString;
}

// Componente para editar pedidos por día inline
function EditablePedidosPorDia({ campana }: { campana: CampanaComercial }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(campana.pedidosPorDia || 0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updatePedidosPorDia = useMutation({
    mutationFn: async (newValue: number) => {
      await apiRequest(`/api/campanas-comerciales/${campana.id}/pedidos-por-dia`, 'PUT', { pedidosPorDia: newValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      setIsEditing(false);
      toast({ title: "Pedidos por día actualizado correctamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar pedidos por día", variant: "destructive" });
      setValue(campana.pedidosPorDia || 0); // Revertir valor
    }
  });

  const handleSave = () => {
    updatePedidosPorDia.mutate(value);
  };

  const handleCancel = () => {
    setValue(campana.pedidosPorDia || 0);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value) || 0)}
          className="w-20 h-8 text-sm"
          min="0"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={updatePedidosPorDia.isPending}
          className="h-8 w-8 p-0"
        >
          <Check className="w-4 h-4 text-green-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="status-warning">
        {campana.pedidosPorDia || 0}
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="h-8 w-8 p-0"
      >
        <Edit2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

export default function CampanasManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampana, setEditingCampana] = useState<CampanaComercial | null>(null);
  const [clienteFiltro, setClienteFiltro] = useState<string>('todos');
  const [fechaFiltro, setFechaFiltro] = useState<string>('');
  const [mesFiltro, setMesFiltro] = useState<string>('todos');
  const [marcaFiltro, setMarcaFiltro] = useState<string>('todas');
  const [marcasCount, setMarcasCount] = useState(1); // Número de pares marca/zona visibles
  const [facturacionManual, setFacturacionManual] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<Omit<InsertCampanaComercial, 'fechaFin'>>({
    resolver: zodResolver(insertCampanaComercialSchema.omit({ fechaFin: true })),
    defaultValues: {
      clienteId: 0,
      numeroCampana: "",
      cantidadDatosSolicitados: 0,
      marca: "",
      zona: "",
      marca2: "",
      zona2: "",
      marca3: "",
      zona3: "",
      marca4: "",
      zona4: "",
      marca5: "",
      zona5: "",
      porcentaje: 100,
      porcentaje2: 0,
      porcentaje3: 0,
      porcentaje4: 0,
      porcentaje5: 0,
      asignacionAutomatica: false,
      fechaCampana: "",
      pedidosPorDia: 10,
      tipoFacturacion: "C",
      costeVenta: "0",
      facturacionBruta: "0",
      metaCampanaFiltro: "",
      metaFechaFin: "",
    },
  });

  const watchedCosteVenta = form.watch("costeVenta");
  const watchedCantidad = form.watch("cantidadDatosSolicitados");
  const watchedTipoFact = form.watch("tipoFacturacion");

  const facturacionCalculada = useMemo(() => {
    const coste = parseFloat(String(watchedCosteVenta || "0")) || 0;
    const cantidad = parseInt(String(watchedCantidad || "0")) || 0;
    const base = coste * cantidad;
    return watchedTipoFact === "A" ? base * 1.21 : base;
  }, [watchedCosteVenta, watchedCantidad, watchedTipoFact]);

  // Sync facturacionBruta con el valor calculado (solo si no está en modo manual)
  useEffect(() => {
    if (!facturacionManual) {
      form.setValue("facturacionBruta", String(facturacionCalculada));
    }
  }, [facturacionCalculada, facturacionManual]);

  // Fetch campañas comerciales
  const { data: campanas = [], isLoading } = useQuery({
    queryKey: ['/api/campanas-comerciales'],
  });

  // Fetch clientes para el dropdown
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<InsertCampanaComercial, 'fechaFin'>) => {
      // Asegurar que la fecha se envía en formato correcto
      const dataToSend = {
        ...data,
        fechaCampana: data.fechaCampana // Mantener formato YYYY-MM-DD tal como viene del input
      };
      console.log('Frontend: Sending campaña data:', dataToSend);
      console.log('Frontend: Fecha original:', data.fechaCampana);
      await apiRequest('/api/campanas-comerciales', 'POST', dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/campanas-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Campaña creada exitosamente" });
    },
    onError: (error: any) => {
      console.error('Frontend: Error creating campaña:', error);
      const errorMessage = error?.message || "Error desconocido al crear campaña";
      toast({ 
        title: "Error al crear campaña", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CampanaComercial> }) => {
      await apiRequest(`/api/campanas-comerciales/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/campanas-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/finanzas'] });
      setIsDialogOpen(false);
      setEditingCampana(null);
      toast({ title: "Campaña actualizada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar campaña", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/campanas-comerciales/${id}`, 'DELETE');
    },
    onSuccess: () => {
      // Invalidar múltiples queries para actualización inmediata en todos los dashboards
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/finanzas'] });
      toast({ 
        title: "Campaña eliminada exitosamente", 
        description: "Los cambios se reflejarán inmediatamente en todos los dashboards" 
      });
    },
    onError: () => {
      toast({ title: "Error al eliminar campaña", variant: "destructive" });
    }
  });

  const onSubmit = (data: InsertCampanaComercial) => {
    console.log('Form submitted with data:', data);
    console.log('Form errors:', form.formState.errors);

    // Validación de porcentajes si asignación automática está desactivada y hay más de una marca
    if (!data.asignacionAutomatica && marcasCount > 1) {
      const porcentajes = [
        data.porcentaje || 0,
        data.porcentaje2 || 0,
        data.porcentaje3 || 0,
        data.porcentaje4 || 0,
        data.porcentaje5 || 0,
      ];

      // Solo sumar porcentajes de marcas activas
      let totalPorcentaje = 0;
      for (let i = 0; i < marcasCount; i++) {
        totalPorcentaje += porcentajes[i];
      }

      if (totalPorcentaje !== 100) {
        toast({
          title: "Error en porcentajes",
          description: `La suma de porcentajes debe ser exactamente 100%. Actual: ${totalPorcentaje}%`,
          variant: "destructive"
        });
        return;
      }
    }

    // Si es asignación automática o una sola marca, asegurar que porcentaje principal sea 100
    if (data.asignacionAutomatica || marcasCount === 1) {
      data.porcentaje = 100;
      data.porcentaje2 = 0;
      data.porcentaje3 = 0;
      data.porcentaje4 = 0;
      data.porcentaje5 = 0;
    }

    if (editingCampana) {
      updateMutation.mutate({ id: editingCampana.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Funciones para manejar marcas dinámicas
  const addMarca = () => {
    if (marcasCount < 5) {
      setMarcasCount(marcasCount + 1);
    }
  };

  const removeMarca = (index: number) => {
    if (marcasCount > 1) {
      // Limpiar los valores del par que se va a eliminar
      if (index === 0) {
        form.setValue('marca', '');
        form.setValue('zona', '');
        form.setValue('porcentaje', 100);
      } else if (index === 1) {
        form.setValue('marca2', '');
        form.setValue('zona2', '');
        form.setValue('porcentaje2', 0);
      } else if (index === 2) {
        form.setValue('marca3', '');
        form.setValue('zona3', '');
        form.setValue('porcentaje3', 0);
      } else if (index === 3) {
        form.setValue('marca4', '');
        form.setValue('zona4', '');
        form.setValue('porcentaje4', 0);
      } else if (index === 4) {
        form.setValue('marca5', '');
        form.setValue('zona5', '');
        form.setValue('porcentaje5', 0);
      }

      setMarcasCount(marcasCount - 1);
    }
  };

  const openDialog = (campana?: CampanaComercial) => {
    if (campana) {
      setEditingCampana(campana);

      // Contar cuántas marcas tiene la campaña existente
      let count = 1;
      if (campana.marca2) count = 2;
      if (campana.marca3) count = 3;
      if (campana.marca4) count = 4;
      if (campana.marca5) count = 5;
      setMarcasCount(count);

      // Detectar si el valor de facturación fue hardcodeado manualmente
      const coste = parseFloat(String(campana.costeVenta || "0")) || 0;
      const cantidad = campana.cantidadDatosSolicitados || 0;
      const base = coste * cantidad;
      const tipoFact = campana.tipoFacturacion || "C";
      const autoCalc = tipoFact === "A" ? base * 1.21 : base;
      const stored = parseFloat(String(campana.facturacionBruta || "0")) || 0;
      const esManual = Math.abs(stored - autoCalc) > 0.01;
      setFacturacionManual(esManual);

      form.reset({
        clienteId: campana.clienteId,
        numeroCampana: campana.numeroCampana,
        cantidadDatosSolicitados: campana.cantidadDatosSolicitados,
        marca: campana.marca,
        zona: campana.zona,
        marca2: campana.marca2 || "",
        zona2: campana.zona2 || "",
        marca3: campana.marca3 || "",
        zona3: campana.zona3 || "",
        marca4: campana.marca4 || "",
        zona4: campana.zona4 || "",
        marca5: campana.marca5 || "",
        zona5: campana.zona5 || "",
        porcentaje: campana.porcentaje || 100,
        porcentaje2: campana.porcentaje2 || 0,
        porcentaje3: campana.porcentaje3 || 0,
        porcentaje4: campana.porcentaje4 || 0,
        porcentaje5: campana.porcentaje5 || 0,
        asignacionAutomatica: campana.asignacionAutomatica || false,
        fechaCampana: campana.fechaCampana || "",
        pedidosPorDia: campana.pedidosPorDia || 0,
        tipoFacturacion: (campana.tipoFacturacion as "C" | "A") || "C",
        costeVenta: campana.costeVenta || "0",
        facturacionBruta: campana.facturacionBruta || "0",
        metaCampanaFiltro: campana.metaCampanaFiltro || "",
        metaFechaFin: campana.metaFechaFin || "",
      });
    } else {
      setEditingCampana(null);
      setMarcasCount(1);
      setFacturacionManual(false);
      form.reset({
        clienteId: 0,
        numeroCampana: "",
        cantidadDatosSolicitados: 0,
        marca: "",
        zona: "",
        marca2: "",
        zona2: "",
        marca3: "",
        zona3: "",
        marca4: "",
        zona4: "",
        marca5: "",
        zona5: "",
        porcentaje: 100,
        porcentaje2: 0,
        porcentaje3: 0,
        porcentaje4: 0,
        porcentaje5: 0,
        asignacionAutomatica: false,
        fechaCampana: "",
        pedidosPorDia: 10,
        tipoFacturacion: "C",
        costeVenta: "0",
        facturacionBruta: "0",
        metaCampanaFiltro: "",
        metaFechaFin: "",
      });
    }
    setIsDialogOpen(true);
  };

  const duplicateCampana = (campana: CampanaComercial) => {
    setEditingCampana(null); // No editing, creating new
    form.reset({
      clienteId: campana.clienteId,
      numeroCampana: "", // Clear campaign number for new campaign
      cantidadDatosSolicitados: campana.cantidadDatosSolicitados,
      marca: campana.marca,
      zona: campana.zona,
      fechaCampana: "", // Clear date for new campaign
      pedidosPorDia: campana.pedidosPorDia || 0,
      tipoFacturacion: (campana.tipoFacturacion as "C" | "A") || "C",
      costeVenta: campana.costeVenta || "0",
      facturacionBruta: campana.facturacionBruta || "0",
      metaCampanaFiltro: campana.metaCampanaFiltro || "",
      metaFechaFin: "",
    });
    setFacturacionManual(false);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta campaña?")) {
      deleteMutation.mutate(id);
    }
  };

  const getClienteNombre = (clienteId: number) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nombreCliente : `Cliente #${clienteId}`;
  };

  // Filtrar y ordenar campañas
  const campanasFiltradas = useMemo(() => {
    if (!Array.isArray(campanas)) return [];
    
    let resultado = [...campanas];
    
    // Filtrar por cliente
    if (clienteFiltro !== 'todos') {
      resultado = resultado.filter((campana: CampanaComercial) => 
        campana.clienteId.toString() === clienteFiltro
      );
    }
    
    // Filtrar por fecha específica
    if (fechaFiltro) {
      resultado = resultado.filter((campana: CampanaComercial) => {
        if (!campana.fechaCampana) return false;
        const fechaCampana = campana.fechaCampana.split('T')[0];
        return fechaCampana === fechaFiltro;
      });
    }
    
    // Filtrar por mes
    if (mesFiltro !== 'todos') {
      resultado = resultado.filter((campana: CampanaComercial) => {
        if (!campana.fechaCampana) return false;
        const fecha = new Date(campana.fechaCampana);
        return (fecha.getMonth() + 1).toString() === mesFiltro;
      });
    }
    
    // Filtrar por marca
    if (marcaFiltro !== 'todas') {
      resultado = resultado.filter((campana: CampanaComercial) =>
        campana.marca === marcaFiltro ||
        campana.marca2 === marcaFiltro ||
        campana.marca3 === marcaFiltro ||
        campana.marca4 === marcaFiltro ||
        campana.marca5 === marcaFiltro
      );
    }

    // Ordenar por fecha de inicio (más recientes primero)
    resultado.sort((a: CampanaComercial, b: CampanaComercial) => {
      const fechaA = a.fechaCampana ? new Date(a.fechaCampana).getTime() : 0;
      const fechaB = b.fechaCampana ? new Date(b.fechaCampana).getTime() : 0;
      return fechaB - fechaA;
    });
    
    return resultado;
  }, [campanas, clienteFiltro, fechaFiltro, mesFiltro, marcaFiltro]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Cargando campañas...</p>
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
            Gestión de Campañas
          </h1>
          <p className="text-muted-foreground">
            Administra las campañas comerciales de tus clientes • {campanasFiltradas?.length || 0} campañas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Cliente:</span>
            <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {[...clientes].sort((a, b) => a.nombreCliente.localeCompare(b.nombreCliente)).map(cliente => (
                  <SelectItem key={cliente.id} value={cliente.id.toString()}>
                    {cliente.nombreCliente}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Marca:</span>
            <Select value={marcaFiltro} onValueChange={setMarcaFiltro}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todas las marcas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las marcas</SelectItem>
                {MARCAS_DISPONIBLES.map(marca => (
                  <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">Fecha:</span>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {fechaFiltro && (
              <button 
                onClick={() => setFechaFiltro('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Mes:</span>
            <Select value={mesFiltro} onValueChange={setMesFiltro}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="1">Enero</SelectItem>
                <SelectItem value="2">Febrero</SelectItem>
                <SelectItem value="3">Marzo</SelectItem>
                <SelectItem value="4">Abril</SelectItem>
                <SelectItem value="5">Mayo</SelectItem>
                <SelectItem value="6">Junio</SelectItem>
                <SelectItem value="7">Julio</SelectItem>
                <SelectItem value="8">Agosto</SelectItem>
                <SelectItem value="9">Septiembre</SelectItem>
                <SelectItem value="10">Octubre</SelectItem>
                <SelectItem value="11">Noviembre</SelectItem>
                <SelectItem value="12">Diciembre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()} className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Campaña
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>
                {editingCampana ? "Editar Campaña" : "Nueva Campaña"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 form-modern">
                {/* Cliente */}
                <FormField
                  control={form.control}
                  name="clienteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...clientes].sort((a, b) => a.nombreCliente.localeCompare(b.nombreCliente)).map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id.toString()}>
                              {cliente.nombreCliente}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Número de Campaña - Solo mostrar en edición */}
                {editingCampana && (
                  <FormField
                    control={form.control}
                    name="numeroCampana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Campaña *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ej: 1, 2, 3..." 
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-sm text-muted-foreground">
                          Número secuencial de la campaña para este cliente
                        </p>
                      </FormItem>
                    )}
                  />
                )}

                {/* Cantidad de Datos */}
                <FormField
                  control={form.control}
                  name="cantidadDatosSolicitados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad de Datos Solicitados *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          placeholder="Ej: 500" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fecha de Inicio */}
                <FormField
                  control={form.control}
                  name="fechaCampana"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Inicio *</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          value={field.value || ""}
                          onChange={(e) => {
                            // Asegurar que la fecha se mantenga exacta
                            const dateValue = e.target.value;
                            console.log('Date input value:', dateValue);
                            field.onChange(dateValue);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        La fecha de fin se calculará automáticamente según la cantidad de datos solicitados
                      </p>
                    </FormItem>
                  )}
                />

                {/* TOGGLE ASIGNACIÓN AUTOMÁTICA */}
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                  <FormField
                    control={form.control}
                    name="asignacionAutomatica"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-lg font-semibold text-blue-800">
                            🔄 Asignación Automática
                          </FormLabel>
                          <p className="text-sm text-blue-600">
                            Si está activada: distribución aleatoria automática. Si está desactivada: debes especificar porcentajes manualmente.
                          </p>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="w-6 h-6"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Marcas y Zonas Dinámicas */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Marcas y Zonas</h3>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addMarca}
                        disabled={marcasCount >= 5}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Agregar marca más
                      </Button>
                    </div>
                  </div>

                  {Array.from({ length: marcasCount }, (_, index) => {
                    // Helper para obtener nombres de campos tipados
                    const getFieldNames = (idx: number) => {
                      if (idx === 0) return { marca: 'marca' as const, zona: 'zona' as const, porcentaje: 'porcentaje' as const };
                      if (idx === 1) return { marca: 'marca2' as const, zona: 'zona2' as const, porcentaje: 'porcentaje2' as const };
                      if (idx === 2) return { marca: 'marca3' as const, zona: 'zona3' as const, porcentaje: 'porcentaje3' as const };
                      if (idx === 3) return { marca: 'marca4' as const, zona: 'zona4' as const, porcentaje: 'porcentaje4' as const };
                      if (idx === 4) return { marca: 'marca5' as const, zona: 'zona5' as const, porcentaje: 'porcentaje5' as const };
                      return { marca: 'marca' as const, zona: 'zona' as const, porcentaje: 'porcentaje' as const };
                    };

                    const { marca: marcaName, zona: zonaName, porcentaje: porcentajeName } = getFieldNames(index);

                    const asignacionAutomatica = form.watch('asignacionAutomatica');
                    const shouldShowPercentage = !asignacionAutomatica && (marcasCount > 1 || index === 0);

                    return (
                      <div key={index} className={`grid ${shouldShowPercentage ? 'grid-cols-3' : 'grid-cols-2'} gap-4 p-4 border border-gray-200 rounded-lg relative`}>
                        <div className="absolute top-2 right-2 flex items-center gap-2">
                          <span className="text-sm text-gray-500 font-medium">
                            Marca {index + 1}
                          </span>
                          {index > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMarca(index)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Marca */}
                        <FormField
                          control={form.control}
                          name={marcaName}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Marca {index === 0 ? '*' : '(opcional)'}
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar marca" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {MARCAS_DISPONIBLES.map((marca) => (
                                    <SelectItem key={marca} value={marca}>
                                      {marca}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Zona */}
                        <FormField
                          control={form.control}
                          name={zonaName}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Provincia/Zona {index === 0 ? '*' : '(opcional)'}
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar provincia" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-60">
                                  {ZONAS_DISPONIBLES.map((zona) => (
                                    <SelectItem key={zona} value={zona}>
                                      {zona}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                              {index === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Selecciona la provincia de Argentina o AMBA/NACIONAL
                                </p>
                              )}
                            </FormItem>
                          )}
                        />

                        {/* Porcentaje - Solo mostrar cuando asignación manual y más de una marca */}
                        {shouldShowPercentage && (
                          <FormField
                            control={form.control}
                            name={porcentajeName}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Porcentaje % {marcasCount === 1 ? '(automático)' : '*'}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder={marcasCount === 1 ? "100" : "Ej: 50"}
                                    {...field}
                                    value={field.value || (marcasCount === 1 ? 100 : 0)}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    disabled={marcasCount === 1}
                                  />
                                </FormControl>
                                <FormMessage />
                                {index === 0 && marcasCount > 1 && (
                                  <p className="text-xs text-muted-foreground">
                                    La suma de todos los porcentajes debe ser 100%
                                  </p>
                                )}
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Validación de porcentajes en tiempo real */}
                  {!form.watch('asignacionAutomatica') && marcasCount > 1 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                      {(() => {
                        const porcentajes = [
                          form.watch('porcentaje') || 0,
                          form.watch('porcentaje2') || 0,
                          form.watch('porcentaje3') || 0,
                          form.watch('porcentaje4') || 0,
                          form.watch('porcentaje5') || 0,
                        ];

                        // Solo sumar porcentajes de marcas activas
                        let totalPorcentaje = 0;
                        for (let i = 0; i < marcasCount; i++) {
                          totalPorcentaje += porcentajes[i];
                        }

                        const isValid = totalPorcentaje === 100;

                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Suma total de porcentajes:
                            </span>
                            <span className={`text-sm font-bold ${isValid ? 'text-green-600' : totalPorcentaje > 100 ? 'text-red-600' : 'text-orange-600'}`}>
                              {totalPorcentaje}% {isValid ? '✓' : totalPorcentaje > 100 ? '(excede 100%)' : '(falta para 100%)'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Campo Localizado */}
                <FormField
                  control={form.control}
                  name="localizado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localización Específica</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Ciudades específicas, zonas, radios de targeting..."
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        Opcional: Especifica targeting geográfico adicional o localización específica
                      </p>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  {/* Pedidos por Día */}
                  <FormField
                    control={form.control}
                    name="pedidosPorDia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pedidos por Día</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Ej: 10"
                            {...field}
                            value={field.value || 0}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-sm text-muted-foreground">
                          Cantidad de datos que se entregan por día
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Tipo de Facturación */}
                  <FormField
                    control={form.control}
                    name="tipoFacturacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Facturación *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "C"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="C">C — Sin IVA (facturación bruta sin cambios)</SelectItem>
                            <SelectItem value="A">A — Con IVA (se suma 21%)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Filtro Meta Ads */}
                  <FormField
                    control={form.control}
                    name="metaCampanaFiltro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filtro Meta Ads (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='Ej: "Toyota | Interaccion" — Si se deja vacío, usa la marca'
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Nombre exacto de la campaña en Meta Ads para filtrar el gasto. Útil cuando la marca aparece en múltiples campañas.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Fecha Fin Meta Ads */}
                  <FormField
                    control={form.control}
                    name="metaFechaFin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Fin Meta Ads (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Limita la consulta de gasto hasta esta fecha. Útil para campañas activas que solo deben mostrar el gasto de un período específico (ej: enero 2026).
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Coste de Venta */}
                  <FormField
                    control={form.control}
                    name="costeVenta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coste de Venta (por lead)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Ej: 3000"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-sm text-muted-foreground">
                          Precio por lead. La facturación bruta se calculará automáticamente.
                        </p>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Facturación Bruta — calculada o manual */}
                <div className="space-y-2">
                  {/* Checkbox para activar ingreso manual */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="facturacion-manual-check"
                      checked={facturacionManual}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setFacturacionManual(isChecked);
                        if (!isChecked) {
                          form.setValue("facturacionBruta", String(facturacionCalculada));
                        }
                      }}
                    />
                    <label
                      htmlFor="facturacion-manual-check"
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      Ingresar Facturación Bruta manualmente
                    </label>
                  </div>

                  {/* Panel de resultado */}
                  <div className={`border rounded-lg p-4 space-y-2 ${facturacionManual ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}>
                    <p className="text-sm font-medium text-gray-700">
                      Facturación Bruta
                      {facturacionManual
                        ? <span className="ml-2 text-xs text-amber-600 font-normal">(valor hardcodeado)</span>
                        : <span className="ml-2 text-xs text-gray-400 font-normal">(calculada automáticamente)</span>
                      }
                    </p>

                    {facturacionManual ? (
                      <FormField
                        control={form.control}
                        name="facturacionBruta"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Ej: 500000"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="text-lg font-bold border-amber-400 focus:border-amber-500"
                              />
                            </FormControl>
                            <p className="text-xs text-amber-600">
                              Valor automático (referencia): ${facturacionCalculada.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-green-700">
                          ${facturacionCalculada.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {watchedCosteVenta && Number(watchedCosteVenta) > 0
                            ? `$${Number(watchedCosteVenta).toLocaleString("es-AR")} × ${watchedCantidad || 0} leads${watchedTipoFact === "A" ? " × 1.21 (IVA 21%)" : ""}`
                            : "Ingresá el coste de venta para ver el cálculo"}
                        </p>
                        <input type="hidden" {...form.register("facturacionBruta")} />
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="btn-gradient"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingCampana ? "Actualizar" : "Crear"} Campaña
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Lista de Campañas - Formato Tabla */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {campanasFiltradas && campanasFiltradas.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Fecha Inicio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Marca</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Zona</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Datos</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Pedidos/día</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Fecha Fin</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campanasFiltradas.map((campana: CampanaComercial) => (
                  <tr key={campana.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {campana.fechaCampana ? formatDateForDisplay(campana.fechaCampana) : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 text-sm">{getClienteNombre(campana.clienteId)}</span>
                        <span className="text-xs text-slate-500">Campaña #{campana.numeroCampana}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        {campana.marca}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="border-green-300 text-green-700">
                        {campana.zona}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-slate-900">
                      {campana.cantidadDatosSolicitados.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <EditablePedidosPorDia campana={campana} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {campana.fechaFin ? formatDateForDisplay(campana.fechaFin) : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDialog(campana)}
                          className="h-8 w-8 p-0 hover:bg-blue-100"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => duplicateCampana(campana)}
                          className="h-8 w-8 p-0 hover:bg-green-100"
                        >
                          <Copy className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(campana.id)}
                          className="h-8 w-8 p-0 hover:bg-red-100"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <Filter className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                {Array.isArray(campanas) && campanas.length === 0 
                  ? "No hay campañas registradas" 
                  : "No hay campañas para los filtros seleccionados"
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                {Array.isArray(campanas) && campanas.length === 0 
                  ? "Comienza creando tu primera campaña comercial."
                  : "Prueba ajustando los filtros o crea una nueva campaña."
                }
              </p>
              <div className="flex gap-2 justify-center">
                {(clienteFiltro !== 'todos' || fechaFiltro || mesFiltro !== 'todos') && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setClienteFiltro('todos');
                      setFechaFiltro('');
                      setMesFiltro('todos');
                    }}
                  >
                    Limpiar Filtros
                  </Button>
                )}
                <Button onClick={() => openDialog()} className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Campaña
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}