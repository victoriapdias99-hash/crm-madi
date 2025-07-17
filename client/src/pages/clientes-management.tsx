import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2, Mail, Phone, MapPin, Globe } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  insertClienteSchema, 
  type Cliente, 
  type InsertCliente
} from "@shared/schema";
import ClienteForm from "@/components/cliente-form";
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
      zonas: [],
      provinciaBuenosAires: "",
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
        provinciaBuenosAires: cliente.provinciaBuenosAires || "",
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Clientes</h1>
          <p className="text-muted-foreground">
            Administra la información comercial y datos de targeting de tus clientes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? "Editar Cliente" : "Nuevo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <ClienteForm
              form={form}
              onSubmit={onSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              isEditing={!!editingCliente}
            />
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
                  {cliente.tipoCliente && (
                    <Badge variant="outline" className="text-xs">
                      {cliente.tipoCliente}
                    </Badge>
                  )}
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
                        <Badge key={marca} variant="secondary" className="text-xs">{marca}</Badge>
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
                        <Badge key={zona} variant="outline" className="text-xs">{zona}</Badge>
                      )) : 
                      <span className="text-xs text-muted-foreground">Sin zonas</span>
                    }
                  </div>
                  {cliente.provinciaBuenosAires && (
                    <div className="flex items-center gap-1 text-xs">
                      <MapPin className="w-3 h-3" />
                      <span>{cliente.provinciaBuenosAires}</span>
                    </div>
                  )}
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

              {cliente.fechaAlta && (
                <div className="mt-4 pt-3 border-t">
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