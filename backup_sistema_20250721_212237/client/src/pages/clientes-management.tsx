import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2, Mail, Phone, MapPin, Globe, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  insertClienteSchema, 
  type Cliente, 
  type InsertCliente,
  TIPO_FACTURACION,
  MARCAS_DISPONIBLES,
  ZONAS,

  TIPOS_INTEGRACION,
  TIPOS_CLIENTE
} from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ClientesManagement() {
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['/api/clientes'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCliente) => {
      console.log('Frontend: Sending cliente data:', data);
      await apiRequest('/api/clientes', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Cliente creado exitosamente" });
    },
    onError: (error: any) => {
      console.error('Frontend: Error creating cliente:', error);
      const errorMessage = error?.message || "Error desconocido al crear cliente";
      toast({ 
        title: "Error al crear cliente", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Cliente> }) => {
      await apiRequest(`/api/clientes/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      setIsDialogOpen(false);
      setEditingCliente(null);
      toast({ title: "Cliente actualizado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar cliente", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/clientes/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      toast({ title: "Cliente eliminado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar cliente", variant: "destructive" });
    }
  });

  const form = useForm<InsertCliente>({
    resolver: zodResolver(insertClienteSchema),
    defaultValues: {
      nombreCliente: "",
      nombreComercial: "",
      telefono: "",
      email: "",
      cuitCliente: "",
      tipoFacturacion: "C",
      marcasSolicitadas: [],
      zonas: [],
      zonasExcluyentes: "",
      exclusionesGeograficas: [],
      integracion: "",
      tipoCliente: "",
    },
  });

  const openDialog = (cliente?: Cliente) => {
    if (cliente) {
      setEditingCliente(cliente);
      form.reset({
        nombreCliente: cliente.nombreCliente,
        nombreComercial: cliente.nombreComercial,
        telefono: cliente.telefono || "",
        email: cliente.email || "",
        cuitCliente: cliente.cuitCliente || "",
        tipoFacturacion: cliente.tipoFacturacion,
        marcasSolicitadas: cliente.marcasSolicitadas || [],
        zonas: cliente.zonas || [],
        zonasExcluyentes: cliente.zonasExcluyentes || "",
        exclusionesGeograficas: cliente.exclusionesGeograficas || [],
        integracion: cliente.integracion || "",
        tipoCliente: cliente.tipoCliente || "",
      });
    } else {
      setEditingCliente(null);
      form.reset({
        nombreCliente: "",
        nombreComercial: "",
        telefono: "",
        email: "",
        cuitCliente: "",
        tipoFacturacion: "C",
        marcasSolicitadas: [],
        zonas: [],
        zonasExcluyentes: "",
        provinciaBuenosAires: "",
        exclusionesGeograficas: [],
        integracion: "",
        tipoCliente: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar este cliente?")) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: InsertCliente) => {
    console.log('Form submitted with data:', data);
    console.log('Form errors:', form.formState.errors);
    
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Cargando clientes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          onClick={() => setLocation('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Gestión de Clientes
          </h1>
          <p className="text-muted-foreground">
            Administra la información comercial y datos de targeting de tus clientes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? "Editar Cliente" : "Nuevo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="form-modern">
                {/* Información Básica */}
                <div className="form-section">
                  <h3>📋 Información Básica</h3>
                  <div className="form-grid">
                    <FormField
                      control={form.control}
                      name="nombreCliente"
                      render={({ field }) => (
                        <FormItem className="form-field-enhanced">
                          <FormLabel>Nombre Cliente *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: NOVO GROUP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nombreComercial"
                      render={({ field }) => (
                        <FormItem className="form-field-enhanced">
                          <FormLabel>Nombre Comercial *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Novo Automotores" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="form-grid">
                    <FormField
                      control={form.control}
                      name="telefono"
                      render={({ field }) => (
                        <FormItem className="form-field-enhanced">
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: +54 11 1234-5678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="form-field-enhanced">
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Ej: contacto@novo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="form-grid">
                    <FormField
                      control={form.control}
                      name="cuitCliente"
                      render={({ field }) => (
                        <FormItem className="form-field-enhanced">
                          <FormLabel>CUIT</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: 20-12345678-9" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tipoFacturacion"
                      render={({ field }) => (
                        <FormItem className="form-field-enhanced">
                          <FormLabel>Tipo Facturación *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(TIPO_FACTURACION).map(([key, value]) => (
                                <SelectItem key={key} value={value}>
                                  {value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="form-grid">
                    <FormField
                      control={form.control}
                      name="integracion"
                      render={({ field }) => (
                        <FormItem className="form-field-enhanced">
                          <FormLabel>Integración</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar integración" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIPOS_INTEGRACION.map((tipo) => (
                                <SelectItem key={tipo} value={tipo}>
                                  {tipo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tipoCliente"
                      render={({ field }) => (
                        <FormItem className="form-field-enhanced">
                          <FormLabel>Tipo de Cliente</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIPOS_CLIENTE.map((tipo) => (
                                <SelectItem key={tipo} value={tipo}>
                                  {tipo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Marcas y Targeting */}
                <div className="form-section">
                  <h3>🎯 Marcas y Targeting</h3>
                  <FormField
                    control={form.control}
                    name="marcasSolicitadas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marcas Solicitadas</FormLabel>
                        <div className="checkbox-group">
                          {MARCAS_DISPONIBLES.map((marca) => (
                            <div key={marca} className="checkbox-item">
                              <Checkbox
                                checked={field.value?.includes(marca)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, marca]);
                                  } else {
                                    field.onChange(current.filter((m) => m !== marca));
                                  }
                                }}
                              />
                              <FormLabel className="text-sm font-normal cursor-pointer">
                                {marca}
                              </FormLabel>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zonas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zonas de Cobertura</FormLabel>
                        <div className="checkbox-group">
                          {Object.values(ZONAS).map((zona) => (
                            <div key={zona} className="checkbox-item">
                              <Checkbox
                                checked={field.value?.includes(zona)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, zona]);
                                  } else {
                                    field.onChange(current.filter((z) => z !== zona));
                                  }
                                }}
                              />
                              <FormLabel className="text-sm font-normal cursor-pointer">
                                {zona}
                              </FormLabel>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                  )}
                />

                  <FormField
                    control={form.control}
                    name="zonasExcluyentes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zonas Excluyentes</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ej: Villa Carlos Paz, La Falda, Capilla del Monte..."
                            className="form-field-enhanced"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Información Adicional */}
                <div className="form-section">
                  <h3>📝 Información Adicional</h3>
                  <FormField
                    control={form.control}
                    name="informacionAdicional"
                    render={({ field }) => (
                      <FormItem className="form-field-enhanced">
                        <FormLabel>Información Adicional</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            placeholder="Información adicional sobre el cliente, notas comerciales, observaciones, etc."
                            maxLength={500}
                            rows={4}
                            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                          />
                        </FormControl>
                        <div className="text-xs text-muted-foreground">
                          {field.value?.length || 0}/500 caracteres
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="hover:bg-secondary transition-colors">
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn-gradient"
                  >
                    {editingCliente ? "Actualizar" : "Crear"} Cliente
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {clientes && clientes.length > 0 ? clientes.map((cliente: Cliente) => (
          <Card key={cliente.id} className="dashboard-card">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {cliente.nombreCliente}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{cliente.nombreComercial}</p>
                  {cliente.tipoCliente && (
                    <Badge variant="outline" className="text-xs status-info">
                      {cliente.tipoCliente}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openDialog(cliente)} className="hover:bg-primary hover:text-primary-foreground transition-colors">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleDelete(cliente.id)}
                    disabled={deleteMutation.isPending}
                    className="hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Contacto */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Contacto</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4" />
                    <span>{cliente.telefono || "No especificado"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{cliente.email || "No especificado"}</span>
                  </div>
                </div>

                {/* Información Comercial */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Comercial</h4>
                  <p className="text-sm"><strong>CUIT:</strong> {cliente.cuitCliente || "No especificado"}</p>
                  <p className="text-sm"><strong>Facturación:</strong> {cliente.tipoFacturacion}</p>
                  {cliente.integracion && (
                    <p className="text-sm"><strong>Integración:</strong> {cliente.integracion}</p>
                  )}
                </div>

                {/* Marcas */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Marcas</h4>
                  <div className="flex flex-wrap gap-1">
                    {cliente.marcasSolicitadas?.length ? 
                      cliente.marcasSolicitadas.slice(0, 4).map(marca => (
                        <Badge key={marca} variant="secondary" className="text-xs status-success">{marca}</Badge>
                      )) : 
                      <span className="text-xs text-muted-foreground">Sin marcas</span>
                    }
                    {cliente.marcasSolicitadas && cliente.marcasSolicitadas.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{cliente.marcasSolicitadas.length - 4}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Zonas y Ubicación */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Cobertura</h4>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {cliente.zonas?.length ? 
                      cliente.zonas.map(zona => (
                        <Badge key={zona} variant="outline" className="text-xs status-warning">{zona}</Badge>
                      )) : 
                      <span className="text-xs text-muted-foreground">Sin zonas</span>
                    }
                  </div>

                </div>

                {/* Exclusiones */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Exclusiones</h4>
                  {cliente.exclusionesGeograficas && cliente.exclusionesGeograficas.length > 0 ? (
                    <div className="flex items-center gap-1 text-xs">
                      <Globe className="w-3 h-3" />
                      <span>{cliente.exclusionesGeograficas.length} área(s) excluida(s)</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin exclusiones</span>
                  )}
                </div>
              </div>

              {(cliente.informacionAdicional || cliente.fechaAlta) && (
                <div className="mt-4 pt-3 border-t space-y-2">
                  {cliente.informacionAdicional && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Información Adicional:</h5>
                      <p className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        {cliente.informacionAdicional}
                      </p>
                    </div>
                  )}
                  {cliente.fechaAlta && (
                    <p className="text-xs text-muted-foreground">
                      Cliente desde: {new Date(cliente.fechaAlta).toLocaleDateString('es-AR')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )) : null}
      </div>

      {clientes && clientes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No hay clientes registrados</h3>
            <p className="text-muted-foreground mb-4">
              Comienza agregando tu primer cliente para gestionar sus datos comerciales.
            </p>
            <Button onClick={() => openDialog()} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer Cliente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}