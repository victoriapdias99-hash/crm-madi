import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Loader2, Users, Mail, Calendar } from "lucide-react";

interface Gerente {
  id: number;
  username: string;
  email: string | null;
  role: string;
  createdBy: number | null;
  createdAt: string | null;
}

export default function GerentesManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados del formulario
  const [dialogOpen, setDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // Query para obtener gerentes
  const {
    data: gerentes,
    isLoading,
    error: queryError,
  } = useQuery<Gerente[]>({
    queryKey: ["/api/admin/gerentes"],
    queryFn: async () => {
      const response = await fetch("/api/admin/gerentes", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Error al obtener gerentes");
      }

      const data = await response.json();
      return data.gerentes;
    },
  });

  // Mutation para crear gerente
  const createGerenteMutation = useMutation({
    mutationFn: async (data: {
      username: string;
      password: string;
      email?: string;
    }) => {
      const response = await fetch("/api/admin/create-gerente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Error al crear gerente");
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gerentes"] });
      toast({
        title: "✅ ¡Gerente creado!",
        description: `${data.user.username} ha sido creado exitosamente.`,
        className:
          "bg-green-100 border-green-300 shadow-lg dark:bg-green-800 dark:border-green-600",
      });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo crear el gerente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para eliminar gerente
  const deleteGerenteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/gerente/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al eliminar gerente");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gerentes"] });
      toast({
        title: "🗑️ Gerente eliminado",
        description: "El gerente ha sido eliminado exitosamente.",
        className:
          "bg-blue-100 border-blue-300 shadow-lg dark:bg-blue-800 dark:border-blue-600",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo eliminar el gerente.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validaciones
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (username.length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres");
      return;
    }

    createGerenteMutation.mutate({
      username,
      password,
      email: email || undefined,
    });
  };

  const handleDelete = (gerente: Gerente) => {
    if (
      window.confirm(
        `¿Estás seguro de eliminar al gerente "${gerente.username}"?\n\nEsto también eliminará todos sus asesores.`,
      )
    ) {
      deleteGerenteMutation.mutate(gerente.id);
    }
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
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">👔 Gestión de Gerentes</h1>
        <p className="text-muted-foreground">
          Administra los gerentes (clientes) de la agencia
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Gerentes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gerentes?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Clientes activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {gerentes?.filter((g) => {
                const date = new Date(g.createdAt || "");
                const now = new Date();
                return (
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear()
                );
              }).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Gerentes nuevos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {gerentes?.filter((g) => g.email).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Emails registrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Botón Crear Gerente */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Lista de Gerentes</h2>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Crear Gerente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Gerente</DialogTitle>
              <DialogDescription>
                El gerente podrá crear sus propios asesores y gestionar sus
                leads.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">
                  Nombre de usuario <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="cliente_abc"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={createGerenteMutation.isPending}
                  required
                  autoFocus
                  minLength={3}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 3 caracteres. Solo letras, números y guiones bajos.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email{" "}
                  <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="gerente@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={createGerenteMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Contraseña <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={createGerenteMutation.isPending}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 6 caracteres.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirmar Contraseña{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={createGerenteMutation.isPending}
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  disabled={createGerenteMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createGerenteMutation.isPending ||
                    !username ||
                    !password ||
                    !confirmPassword ||
                    password !== confirmPassword
                  }
                >
                  {createGerenteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Crear Gerente
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabla de Gerentes */}
      <Card>
        <CardHeader>
          <CardTitle>Gerentes Registrados</CardTitle>
          <CardDescription>
            Lista de todos los gerentes creados por el administrador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : queryError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Error al cargar gerentes. Por favor, intenta nuevamente.
              </AlertDescription>
            </Alert>
          ) : gerentes && gerentes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Fecha de Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gerentes.map((gerente) => (
                  <TableRow key={gerente.id}>
                    <TableCell className="font-medium">
                      {gerente.username}
                    </TableCell>
                    <TableCell>
                      {gerente.email || (
                        <span className="text-muted-foreground italic">
                          Sin email
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(gerente.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(gerente)}
                        disabled={deleteGerenteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                No hay gerentes registrados
              </p>
              <p className="text-sm">
                Crea el primer gerente usando el botón "Crear Gerente"
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
