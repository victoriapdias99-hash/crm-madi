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

export default function UserHomePage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nombreCliente: clientName,
          email: clientEmail,
          telefono: clientPhone,
          descripcion: clientDescription,
        }),
      });

      if (response.ok) {
        toast({
          title: "¡Cliente creado!",
          description: `${clientName} ha sido registrado exitosamente.`,
        });

        // Limpiar formulario
        setClientName("");
        setClientEmail("");
        setClientPhone("");
        setClientDescription("");
        setClientDialogOpen(false);
      } else {
        throw new Error("Error al crear cliente");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el cliente. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nombre: campaignName,
          presupuesto: parseFloat(campaignBudget),
          fechaInicio: campaignStartDate,
          descripcion: campaignDescription,
        }),
      });

      if (response.ok) {
        toast({
          title: "¡Campaña creada!",
          description: `${campaignName} ha sido creada exitosamente.`,
        });

        // Limpiar formulario
        setCampaignName("");
        setCampaignBudget("");
        setCampaignStartDate("");
        setCampaignDescription("");
        setCampaignDialogOpen(false);
      } else {
        throw new Error("Error al crear campaña");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la campaña. Intenta nuevamente.",
        variant: "destructive",
      });
    }
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
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aún no has creado clientes
              </p>
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
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Comienza tu primera campaña
              </p>
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
        <div className="grid md:grid-cols-2 gap-6">
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
                      <Button type="submit" className="flex-1">
                        Crear Cliente
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
                      <Button type="submit" className="flex-1">
                        Crear Campaña
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
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
    </div>
  );
}
