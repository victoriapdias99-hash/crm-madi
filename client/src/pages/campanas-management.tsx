import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Calendar, Target, Package, Copy, Clock, Edit2, Check, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<Omit<InsertCampanaComercial, 'fechaFin' | 'numeroCampana'>>({
    resolver: zodResolver(insertCampanaComercialSchema.omit({ fechaFin: true, numeroCampana: true })),
    defaultValues: {
      clienteId: 0,
      cantidadDatosSolicitados: 0,
      marca: "",
      zona: "",
      fechaCampana: "",
      pedidosPorDia: 0,
      facturacionBruta: 0,
    },
  });

  // Fetch campañas comerciales
  const { data: campanas = [], isLoading } = useQuery({
    queryKey: ['/api/campanas-comerciales'],
  });

  // Fetch clientes para el dropdown
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<InsertCampanaComercial, 'fechaFin' | 'numeroCampana'>) => {
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
      // Invalidar múltiples queries para actualizar todos los dashboards
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Campaña creada exitosamente - aparecerá en Datos Diarios inmediatamente" });
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
      // Invalidar múltiples queries para actualización inmediata en todos los dashboards
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/finanzas'] });
      setIsDialogOpen(false);
      setEditingCampana(null);
      toast({ 
        title: "Campaña actualizada exitosamente", 
        description: "Los cambios se reflejarán inmediatamente en Datos Diarios" 
      });
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
    
    if (editingCampana) {
      updateMutation.mutate({ id: editingCampana.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openDialog = (campana?: CampanaComercial) => {
    if (campana) {
      setEditingCampana(campana);
      form.reset({
        clienteId: campana.clienteId,
        cantidadDatosSolicitados: campana.cantidadDatosSolicitados,
        marca: campana.marca,
        zona: campana.zona,
        fechaCampana: campana.fechaCampana || "",
        pedidosPorDia: campana.pedidosPorDia || 0,
        facturacionBruta: parseFloat(campana.facturacionBruta || "0"),
      });
    } else {
      setEditingCampana(null);
      form.reset({
        clienteId: 0,
        cantidadDatosSolicitados: 0,
        marca: "",
        zona: "",
        fechaCampana: "",
        pedidosPorDia: 0,
        facturacionBruta: 0,
      });
    }
    setIsDialogOpen(true);
  };

  const duplicateCampana = (campana: CampanaComercial) => {
    setEditingCampana(null); // No editing, creating new
    form.reset({
      clienteId: campana.clienteId,
      cantidadDatosSolicitados: campana.cantidadDatosSolicitados,
      marca: campana.marca,
      zona: campana.zona,
      fechaCampana: "", // Clear date for new campaign
      pedidosPorDia: campana.pedidosPorDia || 0,
      facturacionBruta: parseFloat(campana.facturacionBruta || "0"),
    });
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

  // Filtrar campañas por cliente
  const campanasFiltradas = useMemo(() => {
    if (!Array.isArray(campanas)) return [];
    
    if (clienteFiltro === 'todos') {
      return campanas;
    }
    
    return campanas.filter((campana: CampanaComercial) => 
      campana.clienteId.toString() === clienteFiltro
    );
  }, [campanas, clienteFiltro]);

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
            <span className="text-sm font-medium">Filtrar por cliente:</span>
            <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {clientes.map(cliente => (
                  <SelectItem key={cliente.id} value={cliente.id.toString()}>
                    {cliente.nombreCliente}
                  </SelectItem>
                ))}
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                          {clientes.map((cliente) => (
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
                          value={field.value}
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

                <div className="grid grid-cols-2 gap-4">
                  {/* Marca */}
                  <FormField
                    control={form.control}
                    name="marca"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                    name="zona"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provincia/Zona *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        <p className="text-xs text-muted-foreground">
                          Selecciona la provincia de Argentina o AMBA/NACIONAL
                        </p>
                      </FormItem>
                    )}
                  />
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
                            placeholder="Ej: 20" 
                            {...field} 
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

                  {/* Facturación Bruta */}
                  <FormField
                    control={form.control}
                    name="facturacionBruta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facturación Bruta</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.01"
                            placeholder="Ej: 600000" 
                            {...field} 
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-sm text-muted-foreground">
                          Monto total de facturación bruta por campaña
                        </p>
                      </FormItem>
                    )}
                  />
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

      {/* Lista de Campañas */}
      <div className="grid gap-4">
        {campanasFiltradas && campanasFiltradas.length > 0 ? campanasFiltradas.map((campana: CampanaComercial) => (
          <Card key={campana.id} className="card-elevated hover-lift">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{getClienteNombre(campana.clienteId)}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 font-mono">
                    Campaña: {campana.numeroCampana}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDialog(campana)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => duplicateCampana(campana)}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(campana.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                {/* Marca */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Marca</h4>
                  </div>
                  <Badge variant="secondary" className="status-success">
                    {campana.marca}
                  </Badge>
                </div>

                {/* Zona */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Zona</h4>
                  </div>
                  <Badge variant="outline" className="status-info">
                    {campana.zona}
                  </Badge>
                </div>

                {/* Cantidad de Datos */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Datos Solicitados</h4>
                  </div>
                  <p className="text-sm font-semibold">{campana.cantidadDatosSolicitados.toLocaleString()}</p>
                </div>

                {/* Pedidos por Día - EDITABLE */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Pedidos/día</h4>
                  </div>
                  <EditablePedidosPorDia campana={campana} />
                </div>

                {/* Fecha de Inicio */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Inicio</h4>
                  </div>
                  <p className="text-sm">
                    {campana.fechaCampana ? formatDateForDisplay(campana.fechaCampana) : 'No especificada'}
                  </p>
                </div>

                {/* Fecha de Fin */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-red-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Fin</h4>
                  </div>
                  <p className="text-sm">
                    {campana.fechaFin ? formatDateForDisplay(campana.fechaFin) : 'No especificada'}
                  </p>
                </div>

                {/* Fecha de Creación */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Creación</h4>
                  </div>
                  <p className="text-sm">
                    {campana.fechaCreacion ? new Date(campana.fechaCreacion).toLocaleDateString('es-AR') : 'No especificada'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Filter className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                {Array.isArray(campanas) && campanas.length === 0 
                  ? "No hay campañas registradas" 
                  : "No hay campañas para el cliente seleccionado"
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                {Array.isArray(campanas) && campanas.length === 0 
                  ? "Comienza creando tu primera campaña comercial."
                  : clienteFiltro !== 'todos' 
                    ? "Prueba seleccionando otro cliente o crea una nueva campaña."
                    : "Comienza creando tu primera campaña comercial."
                }
              </p>
              {Array.isArray(campanas) && campanas.length === 0 ? (
                <Button onClick={() => openDialog()} className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primera Campaña
                </Button>
              ) : (
                <div className="flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => setClienteFiltro('todos')}
                  >
                    Ver Todas las Campañas
                  </Button>
                  <Button onClick={() => openDialog()} className="btn-gradient">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Campaña
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}