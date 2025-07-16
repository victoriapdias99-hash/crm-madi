import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import SimpleDashboard from "@/pages/simple-dashboard";
import Login from "@/pages/login";
import LeadDetails from "@/pages/lead-details";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SimpleDashboard} />
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
