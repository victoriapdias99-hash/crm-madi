import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Calendar, Target, Package, Copy } from "lucide-react";
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

export default function CampanasManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampana, setEditingCampana] = useState<CampanaComercial | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertCampanaComercial>({
    resolver: zodResolver(insertCampanaComercialSchema),
    defaultValues: {
      clienteId: 0,
      numeroCampana: "",
      cantidadDatosSolicitados: 0,
      marca: "",
      zona: "",
      fechaCampana: "",
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
    mutationFn: async (data: InsertCampanaComercial) => {
      console.log('Frontend: Sending campaña data:', data);
      await apiRequest('/api/campanas-comerciales', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
      toast({ title: "Campaña eliminada exitosamente" });
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
        numeroCampana: campana.numeroCampana,
        cantidadDatosSolicitados: campana.cantidadDatosSolicitados,
        marca: campana.marca,
        zona: campana.zona,
        fechaCampana: campana.fechaCampana || "",
        fechaFin: campana.fechaFin || "",
      });
    } else {
      setEditingCampana(null);
      form.reset({
        clienteId: 0,
        numeroCampana: "",
        cantidadDatosSolicitados: 0,
        marca: "",
        zona: "",
        fechaCampana: "",
        fechaFin: "",
      });
    }
    setIsDialogOpen(true);
  };

  const duplicateCampana = (campana: CampanaComercial) => {
    setEditingCampana(null); // No editing, creating new
    form.reset({
      clienteId: campana.clienteId,
      numeroCampana: `${campana.numeroCampana} - Copia`,
      cantidadDatosSolicitados: campana.cantidadDatosSolicitados,
      marca: campana.marca,
      zona: campana.zona,
      fechaCampana: "", // Clear date for new campaign
      fechaFin: "",
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
            Administra las campañas comerciales de tus clientes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Campaña
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
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

                <div className="grid grid-cols-2 gap-4">
                  {/* Número de Campaña */}
                  <FormField
                    control={form.control}
                    name="numeroCampana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Campaña *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: CAMP-2025-001" {...field} />
                        </FormControl>
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
                </div>

                {/* Fechas de Campaña */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fechaCampana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Inicio</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="fechaFin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Fin</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                        <FormLabel>Zona *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar zona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ZONAS_DISPONIBLES.map((zona) => (
                              <SelectItem key={zona} value={zona}>
                                {zona}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
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

      {/* Lista de Campañas */}
      <div className="grid gap-4">
        {campanas && campanas.length > 0 ? campanas.map((campana: CampanaComercial) => (
          <Card key={campana.id} className="card-elevated hover-lift">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{campana.numeroCampana}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getClienteNombre(campana.clienteId)}
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
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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

                {/* Fecha de Inicio */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Inicio</h4>
                  </div>
                  <p className="text-sm">
                    {campana.fechaCampana ? new Date(campana.fechaCampana).toLocaleDateString('es-AR') : 'No especificada'}
                  </p>
                </div>

                {/* Fecha de Fin */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-red-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Fin</h4>
                  </div>
                  <p className="text-sm">
                    {campana.fechaFin ? new Date(campana.fechaFin).toLocaleDateString('es-AR') : 'No especificada'}
                  </p>
                </div>

                {/* Fecha de Creación */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Creación</h4>
                  </div>
                  <p className="text-sm">
                    {new Date(campana.fechaCreacion).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : null}
      </div>

      {campanas && campanas.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No hay campañas registradas</h3>
            <p className="text-muted-foreground mb-4">
              Comienza creando tu primera campaña comercial.
            </p>
            <Button onClick={() => openDialog()} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera Campaña
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}