import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarChart3, Building2, Calendar, Settings, TrendingUp, Calculator, Target, Home, ArrowLeft, Link2, PieChart } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

  const goBack = () => {
    window.history.back();
  };

  const navItems = [
    {
      href: "/",
      label: "Datos Diarios",
      icon: BarChart3,
      active: location === "/"
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: Calendar,
      active: location === "/dashboard"
    },
    {
      href: "/matching",
      label: "Matching",
      icon: Link2,
      active: location === "/matching"
    },
    {
      href: "/clientes",
      label: "Clientes",
      icon: Building2,
      active: location === "/clientes"
    },
    {
      href: "/campanas",
      label: "Campañas",
      icon: Target,
      active: location === "/campanas"
    },
    {
      href: "/meta-ads",
      label: "Meta Ads",
      icon: TrendingUp,
      active: location === "/meta-ads"
    },
    {
      href: "/finanzas",
      label: "Finanzas",
      icon: Calculator,
      active: location === "/finanzas"
    },
    {
      href: "/reportes",
      label: "Reportes",
      icon: PieChart,
      active: location === "/reportes"
    }
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
        <Button 
          variant="outline"
          size="sm"
          onClick={goBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </Button>
        
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
      </div>
    </Card>
  );
}