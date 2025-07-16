import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, DollarSign, Target, Search, Filter, Eye } from "lucide-react";
import { Link } from "wouter";

interface DashboardStats {
  leadsCount: number;
  totalSpend: number;
  conversionRate: number;
  costPerLead: number;
}

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  interest: string | null;
  budget: string | null;
  status: string;
  cost: string | null;
  campaignName: string | null;
  leadDate: string | null;
  createdAt: string;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  budget: string | null;
}

export default function Dashboard() {
  console.log("Dashboard component rendering");
  const [timeframe, setTimeframe] = useState("today");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats', timeframe],
    queryFn: () => fetch(`/api/dashboard/stats?timeframe=${timeframe}`).then(res => res.json())
  });

  // Fetch leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads', statusFilter, campaignFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (campaignFilter && campaignFilter !== 'all') params.append('campaignId', campaignFilter);
      params.append('limit', '50');
      return fetch(`/api/leads?${params}`).then(res => res.json());
    }
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    queryFn: () => fetch('/api/campaigns').then(res => res.json())
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Dashboard WebSocket connected');
      setIsConnected(true);
      socket.send(JSON.stringify({
        type: 'join_dashboard',
        userId: 1,
        dashboardId: 'main'
      }));
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    socket.onerror = () => {
      setIsConnected(false);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'dashboard_update') {
        // Re-fetch stats when updates come in
        window.location.reload(); // Simple refresh for now
      }
    };

    return () => socket.close();
  }, []);

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (lead.firstName?.toLowerCase().includes(search)) ||
      (lead.lastName?.toLowerCase().includes(search)) ||
      (lead.email?.toLowerCase().includes(search)) ||
      (lead.phone?.includes(search)) ||
      (lead.city?.toLowerCase().includes(search))
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-purple-100 text-purple-800';
      case 'converted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  console.log("About to render dashboard UI", { stats, leads, isConnected });
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Meta Ads</h1>
          <p className="text-gray-600">Panel de control para gestión de leads en tiempo real</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Hoy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.leadsCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">Nuevos leads generados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${statsLoading ? "..." : stats?.totalSpend?.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">Inversión en campañas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa Conversión</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : `${stats?.conversionRate?.toFixed(1) || 0}%`}
              </div>
              <p className="text-xs text-muted-foreground">Leads convertidos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Costo por Lead</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${statsLoading ? "..." : stats?.costPerLead?.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">CPL promedio</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="leads" className="space-y-6">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="campaigns">Campañas</TabsTrigger>
            <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          </TabsList>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
                <CardDescription>Filtra y busca leads específicos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nombre, email..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="new">Nuevo</SelectItem>
                      <SelectItem value="contacted">Contactado</SelectItem>
                      <SelectItem value="qualified">Calificado</SelectItem>
                      <SelectItem value="converted">Convertido</SelectItem>
                      <SelectItem value="rejected">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Campaña" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las campañas</SelectItem>
                      {campaigns.map(campaign => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setStatusFilter("all");
                      setCampaignFilter("all");
                      setSearchTerm("");
                    }}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Limpiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Leads Table */}
            <Card>
              <CardHeader>
                <CardTitle>Lista de Leads ({filteredLeads.length})</CardTitle>
                <CardDescription>Leads ordenados por fecha más reciente</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="text-center py-8">Cargando leads...</div>
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No se encontraron leads</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Nombre</th>
                          <th className="text-left p-3">Email</th>
                          <th className="text-left p-3">Teléfono</th>
                          <th className="text-left p-3">Ciudad</th>
                          <th className="text-left p-3">Interés</th>
                          <th className="text-left p-3">Estado</th>
                          <th className="text-left p-3">Costo</th>
                          <th className="text-left p-3">Fecha</th>
                          <th className="text-left p-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads.map(lead => (
                          <tr key={lead.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <div className="font-medium">
                                {lead.firstName} {lead.lastName}
                              </div>
                            </td>
                            <td className="p-3">{lead.email || "-"}</td>
                            <td className="p-3">{lead.phone || "-"}</td>
                            <td className="p-3">{lead.city || "-"}</td>
                            <td className="p-3">{lead.interest || "-"}</td>
                            <td className="p-3">
                              <Badge className={getStatusColor(lead.status)}>
                                {lead.status}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {lead.cost ? `$${lead.cost}` : "-"}
                            </td>
                            <td className="p-3">
                              {lead.leadDate ? 
                                new Date(lead.leadDate).toLocaleDateString('es-ES') : 
                                new Date(lead.createdAt).toLocaleDateString('es-ES')
                              }
                            </td>
                            <td className="p-3">
                              <Link href={`/leads/${lead.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campañas Activas</CardTitle>
                <CardDescription>Lista de campañas de Meta Ads</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.map(campaign => (
                    <div key={campaign.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">{campaign.name}</h3>
                          <p className="text-sm text-gray-600">
                            Presupuesto: ${campaign.budget || "No definido"}
                          </p>
                        </div>
                        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                          {campaign.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analíticas Avanzadas</CardTitle>
                <CardDescription>Próximamente: gráficos y métricas detalladas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                  <p>Las analíticas avanzadas estarán disponibles próximamente</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}