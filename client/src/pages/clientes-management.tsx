import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2, Mail, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClienteSchema, type Cliente, type InsertCliente, TIPO_FACTURACION, MARCAS, ZONAS } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ClientesManagement() {
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['/api/clientes'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCliente) => {
      await apiRequest('/api/clientes', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      setIsDialogOpen(false);
      toast({ title: "Cliente creado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al crear cliente", variant: "destructive" });
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
      zonas: []
    }
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
        zonas: cliente.zonas || []
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
        zonas: []
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertCliente) => {
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar este cliente?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
          <p className="text-muted-foreground">Administra tus clientes y su información comercial</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? "Editar Cliente" : "Nuevo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nombreCliente"
                    render={({ field }) => (
                      <FormItem>
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
                      <FormItem>
                        <FormLabel>Nombre Comercial *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Novo Automotores" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
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
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Ej: contacto@novo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cuitCliente"
                    render={({ field }) => (
                      <FormItem>
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
                      <FormItem>
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

                <FormField
                  control={form.control}
                  name="marcasSolicitadas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marcas Solicitadas</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(MARCAS).map(([key, value]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={field.value?.includes(value)}
                              onCheckedChange={(checked) => {
                                const newValue = checked
                                  ? [...(field.value || []), value]
                                  : field.value?.filter(m => m !== value) || [];
                                field.onChange(newValue);
                              }}
                            />
                            <label htmlFor={key} className="text-sm font-medium">
                              {value}
                            </label>
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
                      <FormLabel>Zonas</FormLabel>
                      <div className="flex gap-4">
                        {Object.entries(ZONAS).map(([key, value]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`zona-${key}`}
                              checked={field.value?.includes(value)}
                              onCheckedChange={(checked) => {
                                const newValue = checked
                                  ? [...(field.value || []), value]
                                  : field.value?.filter(z => z !== value) || [];
                                field.onChange(newValue);
                              }}
                            />
                            <label htmlFor={`zona-${key}`} className="text-sm font-medium">
                              {value}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
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
        {clientes.map((cliente: Cliente) => (
          <Card key={cliente.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {cliente.nombreCliente}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{cliente.nombreComercial}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openDialog(cliente)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleDelete(cliente.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4" />
                    <span>{cliente.telefono || "No especificado"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4" />
                    <span>{cliente.email || "No especificado"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm"><strong>CUIT:</strong> {cliente.cuitCliente || "No especificado"}</p>
                  <p className="text-sm"><strong>Facturación:</strong> {cliente.tipoFacturacion}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Marcas:</p>
                  <div className="flex flex-wrap gap-1">
                    {cliente.marcasSolicitadas?.length ? 
                      cliente.marcasSolicitadas.map(marca => (
                        <Badge key={marca} variant="secondary" className="text-xs">{marca}</Badge>
                      )) : 
                      <span className="text-xs text-muted-foreground">Sin marcas</span>
                    }
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Zonas:</p>
                  <div className="flex flex-wrap gap-1">
                    {cliente.zonas?.length ? 
                      cliente.zonas.map(zona => (
                        <Badge key={zona} variant="outline" className="text-xs">{zona}</Badge>
                      )) : 
                      <span className="text-xs text-muted-foreground">Sin zonas</span>
                    }
                  </div>
                </div>
              </div>
              {cliente.fechaAlta && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Cliente desde: {new Date(cliente.fechaAlta).toLocaleDateString('es-AR')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {clientes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No hay clientes registrados</h3>
            <p className="text-muted-foreground mb-4">
              Comienza agregando tu primer cliente para gestionar sus datos comerciales.
            </p>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer Cliente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}