import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { RoleBasedRoute } from "@/components/RoleBasedRoute";
import NotFound from "@/pages/not-found";

// Páginas de autenticación
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";
import GerentesManagementPage from "@/pages/gerentes-management-page";

// Página de usuario normal
import UserHomePage from "@/pages/user-home-pages";

// Páginas de administrador
import DatosDiariosDashboard from "@/pages/datos-diarios-dashboard";
import DatosDiariosCentralized from "@/pages/datos-diarios-centralized";
import DashboardSimple from "@/pages/dashboard-simple";
import DatosDiariosMatching from "@/pages/datos-diarios-matching";
import CampanasPendientes from "@/pages/campanas-pendientes";
import CampanasFinalizadas from "@/pages/campanas-finalizadas";
import LeadDetails from "@/pages/lead-details";
import ClientesManagement from "@/pages/clientes-management";
import ClientesOpLeads from "@/pages/clientes-op-leads";
import CampanasManagement from "@/pages/campanas-management";
import LeadsPage from "@/pages/leads";
import MetaAdsDashboard from "@/pages/meta-ads-dashboard";
import MetaAdsConfig from "@/pages/meta-ads-config";
import FinanzasDashboard from "@/pages/finanzas-dashboard-meta-ads";
import ReportesDashboard from "@/pages/reportes-dashboard-simple";
import ReportesGraficos from "@/pages/reportes-graficos";
import CPLSimple from "@/pages/cpl-simple";
import CPLDirecto from "@/pages/cpl-directo";
import CplAnalysis from "@/pages/cpl-analysis";

function Router() {
  return (
    <Switch>
      {/* Rutas públicas (sin autenticación) */}
      <Route path="/login" component={LoginPage} />
      {/*<Route path="/register" component={RegisterPage} />*/}
      <Route path="/gerentes-management">
        <RoleBasedRoute allowedRoles={["admin"]}>
          <GerentesManagementPage />
        </RoleBasedRoute>
      </Route>

      {/* Ruta para usuarios normales */}
      <Route path="/user-home">
        <RoleBasedRoute allowedRoles={["gerente", "asesor"]}>
          <UserHomePage />
        </RoleBasedRoute>
      </Route>

      {/* Rutas de administrador (dashboard completo) */}
      <Route path="/">
        <RoleBasedRoute requireAdmin>
          <CampanasPendientes />
        </RoleBasedRoute>
      </Route>

      <Route path="/datos-diarios">
        <RoleBasedRoute requireAdmin>
          <DatosDiariosDashboard />
        </RoleBasedRoute>
      </Route>

      <Route path="/datos-diarios-dashboard">
        <RoleBasedRoute requireAdmin>
          <DatosDiariosDashboard />
        </RoleBasedRoute>
      </Route>

      <Route path="/datos-diarios-centralized">
        <RoleBasedRoute requireAdmin>
          <DatosDiariosCentralized />
        </RoleBasedRoute>
      </Route>

      <Route path="/simple">
        <RoleBasedRoute requireAdmin>
          <DashboardSimple />
        </RoleBasedRoute>
      </Route>

      <Route path="/campanas-pendientes">
        <RoleBasedRoute requireAdmin>
          <CampanasPendientes />
        </RoleBasedRoute>
      </Route>

      <Route path="/campanas-finalizadas">
        <RoleBasedRoute requireAdmin>
          <CampanasFinalizadas />
        </RoleBasedRoute>
      </Route>

      <Route path="/matching">
        <RoleBasedRoute requireAdmin>
          <DatosDiariosMatching />
        </RoleBasedRoute>
      </Route>

      <Route path="/clientes">
        <RoleBasedRoute requireAdmin>
          <ClientesManagement />
        </RoleBasedRoute>
      </Route>

      <Route path="/clientes-op-leads">
        <RoleBasedRoute requireAdmin>
          <ClientesOpLeads />
        </RoleBasedRoute>
      </Route>

      <Route path="/campanas">
        <RoleBasedRoute requireAdmin>
          <CampanasManagement />
        </RoleBasedRoute>
      </Route>

      <Route path="/meta-ads">
        <RoleBasedRoute requireAdmin>
          <MetaAdsDashboard />
        </RoleBasedRoute>
      </Route>

      <Route path="/meta-ads-dashboard">
        <RoleBasedRoute requireAdmin>
          <MetaAdsDashboard />
        </RoleBasedRoute>
      </Route>

      <Route path="/meta-ads-config">
        <RoleBasedRoute requireAdmin>
          <MetaAdsConfig />
        </RoleBasedRoute>
      </Route>

      <Route path="/finanzas">
        <RoleBasedRoute requireAdmin>
          <FinanzasDashboard />
        </RoleBasedRoute>
      </Route>

      <Route path="/finanzas-simple">
        <RoleBasedRoute requireAdmin>
          <FinanzasDashboard />
        </RoleBasedRoute>
      </Route>

      <Route path="/finanzas-dashboard-meta-ads">
        <RoleBasedRoute requireAdmin>
          <FinanzasDashboard />
        </RoleBasedRoute>
      </Route>

      <Route path="/reportes">
        <RoleBasedRoute requireAdmin>
          <ReportesDashboard />
        </RoleBasedRoute>
      </Route>

      <Route path="/reportes-graficos">
        <RoleBasedRoute requireAdmin>
          <ReportesGraficos />
        </RoleBasedRoute>
      </Route>

      <Route path="/cpl-simple">
        <RoleBasedRoute requireAdmin>
          <CPLSimple />
        </RoleBasedRoute>
      </Route>

      <Route path="/cpl-directo">
        <RoleBasedRoute requireAdmin>
          <CPLDirecto />
        </RoleBasedRoute>
      </Route>

      <Route path="/cpl-analysis">
        <RoleBasedRoute requireAdmin>
          <CplAnalysis />
        </RoleBasedRoute>
      </Route>

      <Route path="/leads">
        <RoleBasedRoute requireAdmin>
          <LeadsPage />
        </RoleBasedRoute>
      </Route>

      <Route path="/leads/:id">
        <RoleBasedRoute requireAdmin>
          <LeadDetails />
        </RoleBasedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
