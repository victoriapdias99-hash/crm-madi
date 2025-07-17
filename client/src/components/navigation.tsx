import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarChart3, Building2, Calendar, Settings, TrendingUp, Calculator } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

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
      href: "/clientes",
      label: "Clientes",
      icon: Building2,
      active: location === "/clientes"
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
      href: "/simple",
      label: "Simple",
      icon: Settings,
      active: location === "/simple"
    }
  ];

  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap gap-2">
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