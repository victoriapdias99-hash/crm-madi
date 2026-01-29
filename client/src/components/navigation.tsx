import { Link, useLocation } from "wouter";
import { Users, LogOut, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  Building2,
  Calculator,
  Target,
  Home,
  ArrowLeft,
  PieChart,
  BarChart,
  Clock,
  CheckCircle,
  TrendingUp,
} from "lucide-react";

export function Navigation() {
  const [location, setLocation] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();

  const goBack = () => {
    window.history.back();
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const navItems = [
    {
      href: "/",
      label: "Datos Diarios",
      icon: BarChart3,
      active: location === "/",
    },
    {
      href: "/campanas-pendientes",
      label: "Campañas Pendientes",
      icon: Clock,
      active: location === "/campanas-pendientes",
    },
    {
      href: "/campanas-finalizadas",
      label: "Campañas Finalizadas",
      icon: CheckCircle,
      active: location === "/campanas-finalizadas",
    },
    {
      href: "/leads",
      label: "Leads",
      icon: Users,
      active: location === "/leads",
    },
    {
      href: "/clientes",
      label: "Clientes",
      icon: Building2,
      active: location === "/clientes",
    },
    {
      href: "/campanas",
      label: "Campañas",
      icon: Target,
      active: location === "/campanas",
    },
    {
      href: "/meta-ads",
      label: "Meta Ads",
      icon: TrendingUp,
      active: location === "/meta-ads",
    },
    {
      href: "/finanzas",
      label: "Finanzas",
      icon: Calculator,
      active: location === "/finanzas",
    },
    {
      href: "/reportes",
      label: "Reportes",
      icon: PieChart,
      active: location === "/reportes",
    },
    {
      href: "/cpl-directo",
      label: "CPL Directo",
      icon: Calculator,
      active: location === "/cpl-directo",
    },
    {
      href: "/cpl-analysis",
      label: "CPL Analysis",
      icon: BarChart,
      active: location === "/cpl-analysis",
    },
  ];

  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap gap-2">
        {/* Botones de navegación especiales */}
        <Link href="/">
          <Button
            variant={location === "/" ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Inicio
          </Button>
        </Link>
        {location !== "/" && (
          <Button
            variant="outline"
            size="sm"
            onClick={goBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Atrás
          </Button>
        )}

        {/* Resto de items de navegación */}
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={item.active ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}

        {/* Botón de Administrar Usuarios - Después de CPL Analysis */}
        {isAuthenticated && user ? (
          /* Usuario autenticado - Mostrar dropdown con información */
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                {user.username}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm">
                <p className="text-muted-foreground">
                  Usuario:{" "}
                  <span className="font-medium text-foreground">
                    {user.username}
                  </span>
                </p>
                {user.email && (
                  <p className="text-muted-foreground mt-1">
                    Email:{" "}
                    <span className="font-medium text-foreground">
                      {user.email}
                    </span>
                  </p>
                )}
                <p className="text-muted-foreground mt-1">
                  Rol:{" "}
                  <span className="font-medium text-foreground capitalize">
                    {user.role}
                  </span>
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          /* Usuario NO autenticado - Mostrar botón para ir a login/registro */
          <Link href="/login">
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Administrar Usuarios
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
