import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import CampaignDashboard from "@/pages/campaign-dashboard";
import DatosDiariosDashboard from "@/pages/datos-diarios-dashboard";
import Login from "@/pages/login";
import LeadDetails from "@/pages/lead-details";
import ClientesManagement from "@/pages/clientes-management";
import CampanasManagement from "@/pages/campanas-management";
import MetaAdsDashboard from "@/pages/meta-ads-dashboard";
import FinanzasDashboard from "@/pages/finanzas-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DatosDiariosDashboard} />
      <Route path="/dashboard" component={CampaignDashboard} />
      <Route path="/clientes" component={ClientesManagement} />
      <Route path="/campanas" component={CampanasManagement} />
      <Route path="/meta-ads" component={MetaAdsDashboard} />
      <Route path="/finanzas" component={FinanzasDashboard} />
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
