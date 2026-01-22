import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Target,
  Users,
  TrendingUp,
  Plus,
  LogOut,
  User,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function UserHomePage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados para formularios
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);

  // Estados de formulario de cliente
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDescription, setClientDescription] = useState("");

  // Estados de formulario de campaña
  const [campaignName, setCampaignName] = useState("");
  const [campaignBudget, setCampaignBudget] = useState("");
  const [campaignStartDate, setCampaignStartDate] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");

  // Estados para eliminación de clientes
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<any>(null);

  // Estados para edición de clientes
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<any>(null);

  // Estados del formulario de edición
  const [editClientName, setEditClientName] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editClientDescription, setEditClientDescription] = useState("");

  // Queries para estadísticas (optimizadas)
  const { data: clientesStats, isLoading: loadingClientesStats } = useQuery({
    queryKey: ["/api/clientes/stats"],
    queryFn: async () => {
      const res = await fetch("/api/clientes/stats", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al obtener estadísticas de clientes");
      return res.json();
    },
  });

  const { data: campanasStats, isLoading: loadingCampanasStats } = useQuery({
    queryKey: ["/api/campanas-comerciales/stats"],
    queryFn: async () => {
      const res = await fetch("/api/campanas-comerciales/stats", {
        credentials: "include",
      });
      if (!res.ok) {
        //Si el endpoint no existe, retornar 0
        return { total: 0 };
      }
      return res.json();
    },
  });

  // Queries para listas (solo últimos 5 para mostrar)
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["/api/clientes"],
  });

  const { data: campanas = [], isLoading: loadingCampanas } = useQuery({
    queryKey: ["/api/campanas-comerciales"],
  });

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(clientData),
      });
      if (!response.ok) throw new Error("Error al crear cliente");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/stats"] });

      // ✅ TOAST ACTUALIZADO
      toast({
        title: "🎉 ¡Cliente creado!",
        description: `${clientName} ha sido registrado exitosamente.`,
        className:
          "bg-green-100 border-green-300 shadow-lg dark:bg-green-800 dark:border-green-600",
      });

      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setClientDescription("");
      setClientDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el cliente. Intenta nuevamente.",
        variant: "destructive", // Esto ya es rojo
      });
    },
  });

  // Mutation para eliminar cliente
  const deleteClienteMutation = useMutation({
    mutationFn: async (clienteId: number) => {
      const response = await fetch(`/api/clientes/${clienteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al eliminar cliente");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/stats"] });

      // ✅ TOAST ACTUALIZADO
      toast({
        title: "🗑️ ¡Cliente eliminado!",
        description: `${clienteToDelete?.nombreCliente} ha sido eliminado exitosamente.`,
        className:
          "bg-blue-100 border-blue-300 shadow-lg dark:bg-blue-800 dark:border-blue-600",
      });

      setDeleteDialogOpen(false);
      setClienteToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el cliente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para actualizar cliente
  const updateClienteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al actualizar cliente");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/stats"] });
      toast({
        title: "✏️ ¡Cliente actualizado!",
        description: `${editClientName} ha sido actualizado exitosamente.`,
        className:
          "bg-amber-100 border-amber-300 shadow-lg dark:bg-amber-800 dark:border-amber-600",
      });
      setEditDialogOpen(false);
      setClienteToEdit(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el cliente.",
        variant: "destructive",
      });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const response = await fetch("/api/campanas-comerciales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(campaignData),
      });
      if (!response.ok) throw new Error("Error al crear campaña");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/campanas-comerciales"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/campanas-comerciales/stats"],
      });

      // ✅ TOAST ACTUALIZADO
      toast({
        title: "🚀 ¡Campaña creada!",
        description: `${campaignName} ha sido creada exitosamente.`,
        className:
          "bg-purple-100 border-purple-300 shadow-lg dark:bg-purple-800 dark:border-purple-600",
      });

      setCampaignName("");
      setCampaignBudget("");
      setCampaignStartDate("");
      setCampaignDescription("");
      setCampaignDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la campaña. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  // Función para abrir el dialog de edición
  const handleEditClick = (cliente: any) => {
    setClienteToEdit(cliente);
    setEditClientName(cliente.nombreCliente || "");
    setEditClientEmail(cliente.email || "");
    setEditClientPhone(cliente.telefono || "");
    setEditClientDescription(cliente.descripcion || "");
    setEditDialogOpen(true);
  };

  // Función para manejar el submit del formulario de edición
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteToEdit) return;

    updateClienteMutation.mutate({
      id: clienteToEdit.id,
      data: {
        nombreCliente: editClientName,
        email: editClientEmail,
        telefono: editClientPhone,
        descripcion: editClientDescription,
      },
    });
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    createClientMutation.mutate({
      nombreCliente: clientName,
      email: clientEmail,
      telefono: clientPhone,
      descripcion: clientDescription,
    });
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaignMutation.mutate({
      nombre: campaignName,
      presupuesto: parseFloat(campaignBudget),
      fechaInicio: campaignStartDate,
      descripcion: campaignDescription,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="border-b bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">CRM MADI</h1>
              <p className="text-sm text-muted-foreground">Panel de Usuario</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {user?.role}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            ¡Bienvenido, {user?.username}! 👋
          </h2>
          <p className="text-muted-foreground">
            Gestiona tus clientes y campañas desde un solo lugar
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clientes Activos
              </CardTitle>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingClientesStats ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {clientesStats?.total || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {clientesStats?.total === 0
                      ? "Aún no has creado clientes"
                      : "Clientes registrados"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Campañas en Curso
              </CardTitle>
              <Target className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingCampanasStats ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {campanasStats?.total || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {campanasStats?.total === 0
                      ? "Comienza tu primera campaña"
                      : "Campañas activas"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads Generados
              </CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tus campañas generarán leads
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Crear Cliente */}
          <Card className="hover:shadow-xl transition-all border-2 border-transparent hover:border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Crear Cliente</CardTitle>
                  <CardDescription>
                    Registra un nuevo cliente en el sistema
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Los clientes son la base de tu negocio. Registra sus datos para
                comenzar a gestionar sus campañas publicitarias.
              </p>

              <Dialog
                open={clientDialogOpen}
                onOpenChange={setClientDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="w-full" size="lg">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Cliente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Cliente</DialogTitle>
                    <DialogDescription>
                      Completa la información del cliente
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateClient} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName">
                        Nombre del Cliente{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="clientName"
                        placeholder="Ej: Empresa XYZ"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clientEmail">Email</Label>
                      <Input
                        id="clientEmail"
                        type="email"
                        placeholder="contacto@empresa.com"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clientPhone">Teléfono</Label>
                      <Input
                        id="clientPhone"
                        type="tel"
                        placeholder="+54 11 1234-5678"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clientDescription">Descripción</Label>
                      <Textarea
                        id="clientDescription"
                        placeholder="Información adicional sobre el cliente..."
                        value={clientDescription}
                        onChange={(e) => setClientDescription(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setClientDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createClientMutation.isPending}
                      >
                        {createClientMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          "Crear Cliente"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Crear Campaña */}
          <Card className="hover:shadow-xl transition-all border-2 border-transparent hover:border-purple-200">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle>Crear Campaña</CardTitle>
                  <CardDescription>
                    Lanza una nueva campaña publicitaria
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Las campañas te ayudan a generar leads y expandir tu negocio.
                Define objetivos claros y presupuesto para mejores resultados.
              </p>

              <Dialog
                open={campaignDialogOpen}
                onOpenChange={setCampaignDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="w-full" size="lg" variant="secondary">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Campaña
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Crear Nueva Campaña</DialogTitle>
                    <DialogDescription>
                      Define los parámetros de tu campaña
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateCampaign} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="campaignName">
                        Nombre de la Campaña{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="campaignName"
                        placeholder="Ej: Campaña Verano 2025"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="campaignBudget">
                        Presupuesto (USD){" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="campaignBudget"
                        type="number"
                        placeholder="1000"
                        min="0"
                        step="0.01"
                        value={campaignBudget}
                        onChange={(e) => setCampaignBudget(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="campaignStartDate">
                        Fecha de Inicio <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="campaignStartDate"
                        type="date"
                        value={campaignStartDate}
                        onChange={(e) => setCampaignStartDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="campaignDescription">Descripción</Label>
                      <Textarea
                        id="campaignDescription"
                        placeholder="Objetivos y detalles de la campaña..."
                        value={campaignDescription}
                        onChange={(e) => setCampaignDescription(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setCampaignDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createCampaignMutation.isPending}
                      >
                        {createCampaignMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          "Crear Campaña"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Lists Section */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Mis Clientes */}
          <Card>
            <CardHeader>
              <CardTitle>Mis Clientes</CardTitle>
              <CardDescription>
                {loadingClientesStats
                  ? "Cargando..."
                  : `${clientesStats?.total || 0} cliente${clientesStats?.total !== 1 ? "s" : ""} registrado${clientesStats?.total !== 1 ? "s" : ""}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClientes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : clientes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Aún no has creado clientes. ¡Crea tu primer cliente arriba!
                </p>
              ) : (
                <div className="space-y-2">
                  {clientes.slice(0, 5).map((cliente: any) => (
                    <div
                      key={cliente.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{cliente.nombreCliente}</p>
                        {cliente.email && (
                          <p className="text-xs text-muted-foreground">
                            {cliente.email}
                          </p>
                        )}
                      </div>

                      {/* Botones de acción */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Botón de editar */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(cliente)}
                        >
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>

                        {/* Botón de eliminar */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setClienteToDelete(cliente);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {clientes.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      +{clientes.length - 5} más
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mis Campañas */}
          <Card>
            <CardHeader>
              <CardTitle>Mis Campañas</CardTitle>
              <CardDescription>
                {loadingCampanasStats
                  ? "Cargando..."
                  : `${campanasStats?.total || 0} campaña${campanasStats?.total !== 1 ? "s" : ""} activa${campanasStats?.total !== 1 ? "s" : ""}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCampanas ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : campanas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Aún no has creado campañas. ¡Lanza tu primera campaña arriba!
                </p>
              ) : (
                <div className="space-y-2">
                  {campanas.slice(0, 5).map((campana: any) => (
                    <div
                      key={campana.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <p className="font-medium">{campana.nombre}</p>
                      {campana.presupuesto && (
                        <p className="text-xs text-muted-foreground">
                          Presupuesto: ${campana.presupuesto}
                        </p>
                      )}
                    </div>
                  ))}
                  {campanas.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      +{campanas.length - 5} más
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-8 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Información de tu cuenta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Usuario</p>
                <p className="font-medium">{user?.username}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">
                  {user?.email || "No especificado"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Rol</p>
                <p className="font-medium capitalize">{user?.role}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Miembro desde</p>
                <p className="font-medium">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("es-ES")
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Dialog de confirmación de eliminación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar Cliente?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El cliente "
              {clienteToDelete?.nombreCliente}" será eliminado permanentemente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDeleteDialogOpen(false);
                setClienteToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (clienteToDelete) {
                  deleteClienteMutation.mutate(clienteToDelete.id);
                }
              }}
              disabled={deleteClienteMutation.isPending}
            >
              {deleteClienteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de edición de cliente */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Actualiza la información de {clienteToEdit?.nombreCliente}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editClientName">
                Nombre del Cliente <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editClientName"
                placeholder="Ej: Empresa XYZ"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editClientEmail">Email</Label>
              <Input
                id="editClientEmail"
                type="email"
                placeholder="contacto@empresa.com"
                value={editClientEmail}
                onChange={(e) => setEditClientEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editClientPhone">Teléfono</Label>
              <Input
                id="editClientPhone"
                type="tel"
                placeholder="+54 11 1234-5678"
                value={editClientPhone}
                onChange={(e) => setEditClientPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editClientDescription">Descripción</Label>
              <Textarea
                id="editClientDescription"
                placeholder="Información adicional sobre el cliente..."
                value={editClientDescription}
                onChange={(e) => setEditClientDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditDialogOpen(false);
                  setClienteToEdit(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={updateClienteMutation.isPending}
              >
                {updateClienteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
