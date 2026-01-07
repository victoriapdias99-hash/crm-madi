import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Componente que protege rutas que requieren autenticación
 * Si el usuario no está autenticado, lo redirige a /login
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Redirigir a login si no está autenticado
  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  // Renderizar children si está autenticado
  return <>{children}</>;
}
