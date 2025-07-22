import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import DatosDiariosDashboard from "@/pages/datos-diarios-dashboard";
import DatosDiariosCentralized from "@/pages/datos-diarios-centralized";
import DashboardSimple from "@/pages/dashboard-simple";
import DatosDiariosMatching from "@/pages/datos-diarios-matching";
import Login from "@/pages/login";
import LeadDetails from "@/pages/lead-details";
import ClientesManagement from "@/pages/clientes-management";
import CampanasManagement from "@/pages/campanas-management";
import MetaAdsDashboard from "@/pages/meta-ads-dashboard";
import MetaAdsConfig from "@/pages/meta-ads-config";
import FinanzasDashboard from "@/pages/finanzas-dashboard-simple";
import ReportesDashboard from "@/pages/reportes-dashboard-simple";
import ReportesGraficos from "@/pages/reportes-graficos";
import FunctionalAnalyst from "@/pages/functional-analyst";
import CPLSimple from "@/pages/cpl-simple";
import CPLDirecto from "@/pages/cpl-directo";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DatosDiariosCentralized} />
      <Route path="/datos-diarios" component={DatosDiariosDashboard} />
      <Route path="/datos-diarios-dashboard" component={DatosDiariosDashboard} />
      <Route path="/datos-diarios-centralized" component={DatosDiariosCentralized} />
      <Route path="/simple" component={DashboardSimple} />

      <Route path="/matching" component={DatosDiariosMatching} />
      <Route path="/clientes" component={ClientesManagement} />
      <Route path="/campanas" component={CampanasManagement} />
      <Route path="/meta-ads" component={MetaAdsDashboard} />
      <Route path="/meta-ads-config" component={MetaAdsConfig} />
      <Route path="/finanzas" component={FinanzasDashboard} />
      <Route path="/finanzas-simple" component={FinanzasDashboard} />
      <Route path="/reportes" component={ReportesDashboard} />
      <Route path="/reportes-graficos" component={ReportesGraficos} />
      <Route path="/pruebas" component={FunctionalAnalyst} />
      <Route path="/cpl-simple" component={CPLSimple} />
      <Route path="/cpl-directo" component={CPLDirecto} />
      <Route path="/login" component={Login} />
      <Route path="/leads/:id" component={LeadDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
