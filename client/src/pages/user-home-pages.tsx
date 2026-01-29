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
  UserPlus,
  Target,
  Users,
  TrendingUp,
  Plus,
  LogOut,
  User,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
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
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function UserHomePage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados para el formulario de crear asesor
  const [asesorDialogOpen, setAsesorDialogOpen] = useState(false);
  const [asesorUsername, setAsesorUsername] = useState("");
  const [asesorEmail, setAsesorEmail] = useState("");
  const [asesorPassword, setAsesorPassword] = useState("");
  const [asesorConfirmPassword, setAsesorConfirmPassword] = useState("");
  const [asesorError, setAsesorError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados para eliminación de asesores
  const [deleteAsesorDialogOpen, setDeleteAsesorDialogOpen] = useState(false);
  const [asesorToDelete, setAsesorToDelete] = useState<any>(null);

  // Estados de formulario de campaña
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignBudget, setCampaignBudget] = useState("");
  const [campaignStartDate, setCampaignStartDate] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");

  // Query para obtener asesores del gerente
  const { data: asesores = [], isLoading: loadingAsesores } = useQuery({
    queryKey: ["/api/gerente/asesores"],
    queryFn: async () => {
      const res = await fetch("/api/gerente/asesores", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Error al obtener asesores");
      }
      const data = await res.json();
      return data.asesores || [];
    },
  });

  // Query para campañas
  const { data: campanasStats, isLoading: loadingCampanasStats } = useQuery({
    queryKey: ["/api/campanas-comerciales/stats"],
    queryFn: async () => {
      const res = await fetch("/api/campanas-comerciales/stats", {
        credentials: "include",
      });
      if (!res.ok) {
        return { total: 0 };
      }
      return res.json();
    },
  });

  const { data: campanas = [], isLoading: loadingCampanas } = useQuery({
    queryKey: ["/api/campanas-comerciales"],
  });

  // Query para estadísticas de leads
  const { data: leadsStats } = useQuery({
    queryKey: ["/api/gerente/leads/stats"],
    queryFn: async () => {
      const res = await fetch("/api/gerente/leads/stats", {
        credentials: "include",
      });
      if (!res.ok) {
        return { total: 0 };
      }
      return res.json();
    },
  });

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  // Mutation para crear asesor
  const createAsesorMutation = useMutation({
    mutationFn: async (data: {
      username: string;
      password: string;
      email?: string;
    }) => {
      const response = await fetch("/api/gerente/create-asesor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Error al crear asesor");
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gerente/asesores"] });
      toast({
        title: "👤 ¡Asesor creado!",
        description: `${data.user.username} ha sido creado exitosamente.`,
        className:
          "bg-green-100 border-green-300 shadow-lg dark:bg-green-800 dark:border-green-600",
      });
      resetAsesorForm();
      setAsesorDialogOpen(false);
    },
    onError: (error: Error) => {
      setAsesorError(error.message);
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo crear el asesor.",
        variant: "destructive",
      });
    },
  });

  // Mutation para eliminar asesor
  const deleteAsesorMutation = useMutation({
    mutationFn: async (asesorId: number) => {
      const response = await fetch(`/api/gerente/asesor/${asesorId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al eliminar asesor");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gerente/asesores"] });
      toast({
        title: "🗑️ ¡Asesor eliminado!",
        description: `${asesorToDelete?.username} ha sido eliminado exitosamente.`,
        className:
          "bg-blue-100 border-blue-300 shadow-lg dark:bg-blue-800 dark:border-blue-600",
      });
      setDeleteAsesorDialogOpen(false);
      setAsesorToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el asesor.",
        variant: "destructive",
      });
    },
  });

  // Mutation para crear campaña
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

  const resetAsesorForm = () => {
    setAsesorUsername("");
    setAsesorEmail("");
    setAsesorPassword("");
    setAsesorConfirmPassword("");
    setAsesorError("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleCreateAsesor = (e: React.FormEvent) => {
    e.preventDefault();
    setAsesorError("");

    // Validaciones
    if (asesorPassword !== asesorConfirmPassword) {
      setAsesorError("Las contraseñas no coinciden");
      return;
    }

    if (asesorPassword.length < 6) {
      setAsesorError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (asesorUsername.length < 3) {
      setAsesorError("El nombre de usuario debe tener al menos 3 caracteres");
      return;
    }

    createAsesorMutation.mutate({
      username: asesorUsername,
      password: asesorPassword,
      email: asesorEmail || undefined,
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
              <p className="text-sm text-muted-foreground">Panel de Gerente</p>
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
            Gestiona tus asesores y campañas desde un solo lugar
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Asesores Activos
              </CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingAsesores ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {asesores?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {asesores?.length === 0
                      ? "Crea tu primer asesor"
                      : "Miembros del equipo"}
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
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leadsStats?.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tus campañas generarán leads
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Crear Asesor */}
          <Card className="hover:shadow-xl transition-all border-2 border-transparent hover:border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Crear Asesor</CardTitle>
                  <CardDescription>
                    Registra un nuevo asesor para tu equipo
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Los asesores te ayudarán a gestionar y dar seguimiento a los
                leads. Cada asesor tendrá acceso a visualizar tus leads.
              </p>

              <Dialog
                open={asesorDialogOpen}
                onOpenChange={setAsesorDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="w-full" size="lg">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Asesor
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Asesor</DialogTitle>
                    <DialogDescription>
                      El asesor podrá visualizar y gestionar tus leads
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateAsesor} className="space-y-4">
                    {asesorError && (
                      <Alert variant="destructive">
                        <AlertDescription>{asesorError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="asesorUsername">
                        Nombre de usuario{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="asesorUsername"
                        type="text"
                        placeholder="juanperez"
                        value={asesorUsername}
                        onChange={(e) => setAsesorUsername(e.target.value)}
                        disabled={createAsesorMutation.isPending}
                        required
                        autoFocus
                        minLength={3}
                        maxLength={50}
                      />
                      <p className="text-xs text-muted-foreground">
                        Mínimo 3 caracteres. Solo letras, números y guiones
                        bajos.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="asesorEmail">
                        Email{" "}
                        <span className="text-muted-foreground">
                          (opcional)
                        </span>
                      </Label>
                      <Input
                        id="asesorEmail"
                        type="email"
                        placeholder="asesor@empresa.com"
                        value={asesorEmail}
                        onChange={(e) => setAsesorEmail(e.target.value)}
                        disabled={createAsesorMutation.isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="asesorPassword">
                        Contraseña <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="asesorPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={asesorPassword}
                          onChange={(e) => setAsesorPassword(e.target.value)}
                          disabled={createAsesorMutation.isPending}
                          required
                          minLength={6}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Mínimo 6 caracteres.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="asesorConfirmPassword">
                        Confirmar Contraseña{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="asesorConfirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={asesorConfirmPassword}
                          onChange={(e) =>
                            setAsesorConfirmPassword(e.target.value)
                          }
                          disabled={createAsesorMutation.isPending}
                          required
                          minLength={6}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>Nota:</strong> El asesor podrá iniciar sesión
                        con estas credenciales y visualizar todos tus leads.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setAsesorDialogOpen(false);
                          resetAsesorForm();
                        }}
                        disabled={createAsesorMutation.isPending}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={
                          createAsesorMutation.isPending ||
                          !asesorUsername ||
                          !asesorPassword ||
                          !asesorConfirmPassword ||
                          asesorPassword !== asesorConfirmPassword
                        }
                      >
                        {createAsesorMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Crear Asesor
                          </>
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
          {/* Mis Asesores */}
          <Card>
            <CardHeader>
              <CardTitle>Mis Asesores</CardTitle>
              <CardDescription>
                {loadingAsesores
                  ? "Cargando..."
                  : `${asesores?.length || 0} asesor${asesores?.length !== 1 ? "es" : ""} registrado${asesores?.length !== 1 ? "s" : ""}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAsesores ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : asesores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    No hay asesores registrados
                  </p>
                  <p className="text-sm">
                    Crea tu primer asesor usando el botón "Nuevo Asesor"
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {asesores.slice(0, 5).map((asesor: any) => (
                    <div
                      key={asesor.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{asesor.username}</p>
                        {asesor.email && (
                          <p className="text-xs text-muted-foreground">
                            {asesor.email}
                          </p>
                        )}
                      </div>

                      {/* Botón de eliminar */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAsesorToDelete(asesor);
                            setDeleteAsesorDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {asesores.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      +{asesores.length - 5} más
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

      {/* Dialog de confirmación de eliminación de asesor */}
      <Dialog
        open={deleteAsesorDialogOpen}
        onOpenChange={setDeleteAsesorDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar Asesor?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El asesor "
              {asesorToDelete?.username}" será eliminado permanentemente y ya no
              tendrá acceso al sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDeleteAsesorDialogOpen(false);
                setAsesorToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (asesorToDelete) {
                  deleteAsesorMutation.mutate(asesorToDelete.id);
                }
              }}
              disabled={deleteAsesorMutation.isPending}
            >
              {deleteAsesorMutation.isPending ? (
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
    </div>
  );
}
