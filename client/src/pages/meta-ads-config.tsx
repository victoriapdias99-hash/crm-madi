import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Settings, Key, RefreshCw, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";

interface ConfigFormData {
  accessToken: string;
  accountId: string;
  appSecret: string;
}

interface TokenStatus {
  expiresAt: string | null;
  daysRemaining: number | null;
  lastRefreshed: string | null;
  tokenType: string;
  hasToken: boolean;
}

function TokenStatusBadge({ days }: { days: number | null }) {
  if (days === null) {
    return <Badge variant="secondary">Sin vencimiento</Badge>;
  }
  if (days < 5) {
    return <Badge className="bg-red-500 text-white">{days} días restantes</Badge>;
  }
  if (days < 15) {
    return <Badge className="bg-orange-500 text-white">{days} días restantes</Badge>;
  }
  return <Badge className="bg-green-600 text-white">{days} días restantes</Badge>;
}

export default function MetaAdsConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<ConfigFormData>({
    accessToken: '',
    accountId: 'act_9696169217103588',
    appSecret: ''
  });

  const tokenStatusQuery = useQuery<TokenStatus>({
    queryKey: ['/api/meta-ads/token-status'],
    retry: false,
    refetchInterval: 60000,
  });

  const configMutation = useMutation({
    mutationFn: async (data: ConfigFormData) => {
      return await apiRequest('/api/meta-ads/config', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Configuración exitosa",
        description: "Meta Ads API configurado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error de configuración",
        description: error.message || "No se pudo configurar Meta Ads API",
        variant: "destructive",
      });
    },
  });

  const refreshTokenMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/meta-ads/token-refresh', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Token refrescado",
        description: "El token de Meta Ads fue renovado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/token-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al refrescar token",
        description: error.message || "No se pudo renovar el token",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accessToken || !formData.accountId || !formData.appSecret) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }
    configMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof ConfigFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const tokenStatus = tokenStatusQuery.data;

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <Navigation />
      
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Configuración Meta Ads API
          </h1>
          <p className="text-gray-600 mt-2">
            Configura las credenciales para conectar con Meta Ads
          </p>
        </div>

        {/* Estado del token actual */}
        <Card className="shadow-lg border-2 border-blue-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Estado del Token Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tokenStatusQuery.isLoading ? (
              <p className="text-sm text-gray-500">Cargando estado del token...</p>
            ) : tokenStatus ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Estado:</span>
                  <TokenStatusBadge days={tokenStatus.daysRemaining} />
                </div>
                {tokenStatus.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Vence:</span>
                    <span className="text-sm text-gray-600">
                      {new Date(tokenStatus.expiresAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {tokenStatus.lastRefreshed && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Último refresco:</span>
                    <span className="text-sm text-gray-600">
                      {new Date(tokenStatus.lastRefreshed).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Tipo:</span>
                  <span className="text-sm text-gray-600 capitalize">{tokenStatus.tokenType}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500 mb-2">
                    El token se renueva automáticamente cuando quedan menos de 15 días para vencer.
                    También puedes forzar un refresco manual:
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshTokenMutation.mutate()}
                    disabled={refreshTokenMutation.isPending}
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshTokenMutation.isPending ? 'animate-spin' : ''}`} />
                    {refreshTokenMutation.isPending ? 'Refrescando...' : 'Refrescar Token Ahora'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">No hay token almacenado. Configure las credenciales abajo.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Credenciales API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="accessToken">Access Token</Label>
                <Input
                  id="accessToken"
                  type="password"
                  value={formData.accessToken}
                  onChange={(e) => handleInputChange('accessToken', e.target.value)}
                  placeholder="EAA..."
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Token del Graph API Explorer con permisos ads_management
                </p>
              </div>

              <div>
                <Label htmlFor="accountId">Account ID</Label>
                <Input
                  id="accountId"
                  value={formData.accountId}
                  onChange={(e) => handleInputChange('accountId', e.target.value)}
                  placeholder="act_123456789"
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  ID de tu cuenta publicitaria (formato: act_123456789)
                </p>
              </div>

              <div>
                <Label htmlFor="appSecret">App Secret</Label>
                <Input
                  id="appSecret"
                  type="password"
                  value={formData.appSecret}
                  onChange={(e) => handleInputChange('appSecret', e.target.value)}
                  placeholder="Obtén desde: developers.facebook.com/apps/..."
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Secret de tu aplicación Meta (opcional para funcionalidad básica)
                </p>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <Key className="h-4 w-4" />
                <AlertDescription>
                  <strong>Para obtener App Secret:</strong>
                  <br />
                  1. Ve a: <a href="https://developers.facebook.com/apps/1282943593506408/settings/basic/" target="_blank" className="text-blue-600 underline">developers.facebook.com/apps/1282943593506408/settings/basic/</a>
                  <br />
                  2. En "App Secret", haz clic en "Mostrar"
                  <br />
                  3. Copia el valor que aparece
                </AlertDescription>
              </Alert>

              <Button
                type="submit"
                disabled={configMutation.isPending}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {configMutation.isPending ? (
                  "Configurando..."
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Configurar Meta Ads API
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Información de Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">App ID</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">1282943593506408</p>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Account ID</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">act_9696169217103588</p>
              </div>
              
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Access Token</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {tokenStatus?.hasToken ? '✓ Configurado en servidor' : '⚠ Pendiente'}
                </p>
              </div>
              
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">App Secret</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {formData.appSecret ? '✓ Configurado' : '⚠ Pendiente'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
