import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface RoleBasedRouteProps {
  children: ReactNode;
  allowedRoles?: string[]; // ["admin", "gerente", "asesor"] por defecto
  requireAdmin?: boolean; // true = solo admin
}

/**
 * Componente que protege rutas basado en roles de usuario
 *
 * Uso:
 * <RoleBasedRoute requireAdmin>
 *   <AdminDashboard />
 * </RoleBasedRoute>
 *
 * <RoleBasedRoute allowedRoles={["gerente", "admin"]}>
 *   <PublicFeature />
 * </RoleBasedRoute>
 */
export function RoleBasedRoute({
  children,
  allowedRoles = ["admin", "gerente", "asesor"], // ✅ ACTUALIZADO
  requireAdmin = false,
}: RoleBasedRouteProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">
            Verificando permisos...
          </p>
        </div>
      </div>
    );
  }

  // Redirigir a login si no está autenticado
  if (!isAuthenticated || !user) {
    setLocation("/login");
    return null;
  }

  // Verificar permisos de rol
  const userRole = user.role;
  const hasPermission = requireAdmin
    ? userRole === "admin"
    : allowedRoles.includes(userRole);

  // ✅ FUNCIÓN PARA OBTENER HOME SEGÚN ROL
  const getHomeRoute = (role: string): string => {
    if (role === "admin") return "/";
    if (role === "gerente") return "/user-home";
    if (role === "asesor") return "/asesor-home";
    return "/";
  };

  // Si no tiene permisos, mostrar página de acceso denegado
  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md shadow-xl border-red-200">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900 rounded-full w-fit">
              <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl">Acceso Denegado</CardTitle>
            <CardDescription>
              No tienes permisos para acceder a esta sección
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-muted-foreground">
                <strong>Tu rol actual:</strong> {userRole}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Roles permitidos:</strong>{" "}
                {requireAdmin ? "Administrador" : allowedRoles.join(", ")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLocation(getHomeRoute(userRole))} // ✅ ACTUALIZADO
              >
                Volver al Inicio
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  await logout();
                  setLocation("/login");
                }}
              >
                Cerrar Sesión
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Si crees que esto es un error, contacta al administrador del
              sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si tiene permisos, renderizar el contenido
  return <>{children}</>;
}
