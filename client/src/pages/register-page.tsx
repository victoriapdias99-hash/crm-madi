import { useState } from "react";
import { useAuth, getHomeRoute } from "@/lib/auth-context";
import { useLocation } from "wouter";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserPlus, LogIn } from "lucide-react";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { register, isAuthenticated } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirigir si ya está autenticado
  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validaciones del lado del cliente
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

    setIsLoading(true);

    try {
      const { role } = await register(username, password, email);

      // Redirigir según el rol del usuario
      const homeRoute = getHomeRoute(role);
      setLocation(homeRoute);
    } catch (err: any) {
      setError(err.message || "Error al registrar usuario");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Crear Cuenta
          </CardTitle>
          <CardDescription className="text-center">
            Completa el formulario para registrarte en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                placeholder="usuario123"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
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
                Email <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
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
                disabled={isLoading}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 6 caracteres.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmar Contraseña <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                !username ||
                !password ||
                !confirmPassword ||
                password !== confirmPassword
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear Cuenta
                </>
              )}
            </Button>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                ¿Ya tienes una cuenta?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => setLocation("/login")}
                >
                  <LogIn className="mr-1 h-3 w-3" />
                  Inicia sesión aquí
                </Button>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
