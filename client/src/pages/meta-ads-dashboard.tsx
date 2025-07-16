import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings, 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  Eye, 
  MousePointer, 
  Target,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Navigation } from "@/components/navigation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CampaignData {
  campaignId: string;
  campaignName: string;
  spend: number;
  accountCurrency: string;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  frequency: number;
  dateStart: string;
  dateStop: string;
  lastUpdated: string;
}

interface BudgetData {
  campaignId: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  budgetRemaining?: number;
  spend: number;
  budgetUtilization: number;
}

interface AccountSummary {
  totalSpend: number;
  currency: string;
  campaignCount: number;
  lastUpdated: string;
}

interface ServiceStatus {
  configured: boolean;
  tokenValid?: boolean;
  autoSyncEnabled: boolean;
  cacheStats: {
    cachedCampaigns: number;
    lastSyncTime: string | null;
    cacheAge: number | null;
  } | null;
}

export default function MetaAdsDashboard() {
  const [accessToken, setAccessToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  // Obtener estado del servicio
  const { data: status, isLoading: statusLoading } = useQuery<ServiceStatus>({
    queryKey: ['/api/meta-ads/status'],
    refetchInterval: 60000, // Cada minuto
  });

  // Obtener campañas
  const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignData[]>({
    queryKey: ['/api/meta-ads/campaigns'],
    enabled: status?.configured || false,
    refetchInterval: 5 * 60 * 1000, // Cada 5 minutos
  });

  // Obtener presupuestos
  const { data: budgets } = useQuery<BudgetData[]>({
    queryKey: ['/api/meta-ads/budgets'],
    enabled: status?.configured || false,
    refetchInterval: 5 * 60 * 1000,
  });

  // Obtener resumen de cuenta
  const { data: accountSummary } = useQuery<AccountSummary>({
    queryKey: ['/api/meta-ads/account-summary'],
    enabled: status?.configured || false,
    refetchInterval: 5 * 60 * 1000,
  });

  // Configurar servicio
  const configMutation = useMutation({
    mutationFn: async (config: { accessToken: string; accountId: string }) => {
      await apiRequest('/api/meta-ads/config', 'POST', config);
    },
    onSuccess: () => {
      setIsConfigured(true);
      toast({ title: "Meta Ads API configurado exitosamente" });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/status'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error de configuración", 
        description: error.message || "Token o Account ID inválidos",
        variant: "destructive" 
      });
    }
  });

  // Sincronización manual
  const syncMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/meta-ads/sync', 'POST');
    },
    onSuccess: () => {
      toast({ title: "Sincronización completada" });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/account-summary'] });
    },
    onError: () => {
      toast({ title: "Error en sincronización", variant: "destructive" });
    }
  });

  const handleConfigure = () => {
    if (!accessToken.trim() || !accountId.trim()) {
      toast({ 
        title: "Campos requeridos", 
        description: "Access Token y Account ID son obligatorios",
        variant: "destructive" 
      });
      return;
    }
    configMutation.mutate({ accessToken: accessToken.trim(), accountId: accountId.trim() });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-AR').format(num);
  };

  const getCacheAgeText = (cacheAge: number | null) => {
    if (!cacheAge) return 'Sin datos';
    const minutes = Math.floor(cacheAge / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    setIsConfigured(status?.configured || false);
  }, [status]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Navigation />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Meta Ads Dashboard</h1>
          <p className="text-muted-foreground">Integración en tiempo real con Meta Ads API</p>
        </div>
        
        {isConfigured && (
          <div className="flex gap-2">
            <Button 
              onClick={() => syncMutation.mutate()} 
              disabled={syncMutation.isPending}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          </div>
        )}
      </div>

      {/* Estado del servicio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Estado del Servicio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              {status?.configured ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                {status?.configured ? 'Configurado' : 'No configurado'}
              </span>
            </div>
            
            {status?.configured && (
              <>
                <div className="flex items-center gap-2">
                  {status.tokenValid ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-sm">
                    Token {status.tokenValid ? 'válido' : 'inválido'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {status.autoSyncEnabled ? (
                    <Clock className="w-4 h-4 text-blue-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm">
                    Auto-sync {status.autoSyncEnabled ? 'activo' : 'inactivo'}
                  </span>
                </div>
                
                <div className="text-sm">
                  <span className="font-medium">Cache: </span>
                  {status.cacheStats?.cachedCampaigns || 0} campañas
                  {status.cacheStats?.cacheAge && (
                    <span className="text-muted-foreground ml-1">
                      ({getCacheAgeText(status.cacheStats.cacheAge)})
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuración */}
      {!isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>Configurar Meta Ads API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Para usar esta funcionalidad necesitas un Access Token de Meta Ads y el Account ID de tu cuenta publicitaria.
                Puedes obtenerlos desde Meta Business Suite → Configuración → API de Marketing.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="EAAxxxxxxxxxxxxx"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accountId">Account ID</Label>
                <Input
                  id="accountId"
                  placeholder="act_1234567890"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                />
              </div>
            </div>
            
            <Button 
              onClick={handleConfigure} 
              disabled={configMutation.isPending}
              className="w-full"
            >
              {configMutation.isPending ? 'Configurando...' : 'Configurar API'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resumen de cuenta */}
      {isConfigured && accountSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Gasto Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(accountSummary.totalSpend, accountSummary.currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Última actualización: {new Date(accountSummary.lastUpdated).toLocaleString('es-AR')}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                Campañas Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accountSummary.campaignCount}</div>
              <p className="text-xs text-muted-foreground">Campañas monitoreadas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Promedio CPM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {campaigns && campaigns.length > 0 
                  ? formatCurrency(campaigns.reduce((sum, c) => sum + c.cpm, 0) / campaigns.length, accountSummary.currency)
                  : '$0.00'
                }
              </div>
              <p className="text-xs text-muted-foreground">Costo por mil impresiones</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de campañas */}
      {isConfigured && campaigns && campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Campañas ({campaigns.length})</span>
              <Badge variant="secondary">
                Actualizado: {getCacheAgeText(status?.cacheStats?.cacheAge || null)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campaigns.map((campaign) => {
                const budget = budgets?.find(b => b.campaignId === campaign.campaignId);
                
                return (
                  <div key={campaign.campaignId} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium">{campaign.campaignName}</h3>
                        <p className="text-sm text-muted-foreground">ID: {campaign.campaignId}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          {formatCurrency(campaign.spend, campaign.accountCurrency)}
                        </div>
                        {budget && budget.budgetUtilization > 0 && (
                          <Badge variant={budget.budgetUtilization > 80 ? "destructive" : "default"}>
                            {budget.budgetUtilization.toFixed(1)}% del presupuesto
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <span>{formatNumber(campaign.impressions)} impresiones</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MousePointer className="w-4 h-4 text-green-500" />
                        <span>{formatNumber(campaign.clicks)} clics</span>
                      </div>
                      <div>
                        <span className="font-medium">CPC: </span>
                        {formatCurrency(campaign.cpc, campaign.accountCurrency)}
                      </div>
                      <div>
                        <span className="font-medium">CPM: </span>
                        {formatCurrency(campaign.cpm, campaign.accountCurrency)}
                      </div>
                    </div>
                    
                    {budget && (
                      <>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          {budget.dailyBudget && (
                            <div>
                              <span className="font-medium">Presupuesto diario: </span>
                              {formatCurrency(budget.dailyBudget, campaign.accountCurrency)}
                            </div>
                          )}
                          {budget.lifetimeBudget && (
                            <div>
                              <span className="font-medium">Presupuesto total: </span>
                              {formatCurrency(budget.lifetimeBudget, campaign.accountCurrency)}
                            </div>
                          )}
                          {budget.budgetRemaining && (
                            <div>
                              <span className="font-medium">Restante: </span>
                              {formatCurrency(budget.budgetRemaining, campaign.accountCurrency)}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado de carga */}
      {(statusLoading || campaignsLoading) && (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Cargando datos de Meta Ads...</p>
          </CardContent>
        </Card>
      )}

      {/* Sin campañas */}
      {isConfigured && campaigns && campaigns.length === 0 && !campaignsLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No se encontraron campañas</h3>
            <p className="text-muted-foreground mb-4">
              No hay campañas activas en tu cuenta de Meta Ads o necesitas ajustar los permisos del token.
            </p>
            <Button onClick={() => syncMutation.mutate()} variant="outline">
              Intentar nueva sincronización
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}