import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Settings, Key, RefreshCw, Clock, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";

interface TokenStatus {
  expiresAt: string | null;
  daysRemaining: number | null;
  lastRefreshed: string | null;
  tokenType: string;
  hasToken: boolean;
  isExpired?: boolean;
}

function TokenStatusBadge({ days, isExpired }: { days: number | null; isExpired?: boolean }) {
  if (isExpired) {
    return <Badge className="bg-red-600 text-white animate-pulse">VENCIDO</Badge>;
  }
  if (days === null) {
    return <Badge variant="secondary">Sin vencimiento conocido</Badge>;
  }
  if (days <= 0) {
    return <Badge className="bg-red-600 text-white animate-pulse">VENCIDO</Badge>;
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

  const [newToken, setNewToken] = useState('');
  const [fullConfigData, setFullConfigData] = useState({
    accessToken: '',
    accountId: 'act_9696169217103588',
    appSecret: ''
  });

  const tokenStatusQuery = useQuery<TokenStatus>({
    queryKey: ['/api/meta-ads/token-status'],
    retry: false,
    refetchInterval: 30000,
  });

  const tokenStatus = tokenStatusQuery.data;
  const tokenExpiredOrLow = tokenStatus && (tokenStatus.isExpired || (tokenStatus.daysRemaining !== null && tokenStatus.daysRemaining < 10));

  // Mutación para actualizar solo el token
  const updateTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      return await apiRequest('/api/meta-ads/update-token', {
        method: 'POST',
        body: JSON.stringify({ accessToken: token }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Token actualizado",
        description: data?.message || "El token fue actualizado y verificado correctamente",
      });
      setNewToken('');
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/token-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar token",
        description: error.message || "No se pudo actualizar el token",
        variant: "destructive",
      });
    },
  });

  const refreshTokenMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/meta-ads/token-refresh', { method: 'POST' });
    },
    onSuccess: () => {
      toast({
        title: "Verificación completada",
        description: "Se verificó el estado del token",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/token-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo verificar el token",
        variant: "destructive",
      });
    },
  });

  const configMutation = useMutation({
    mutationFn: async (data: typeof fullConfigData) => {
      return await apiRequest('/api/meta-ads/config', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: "Configuración exitosa",
        description: "Meta Ads API configurado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/token-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error de configuración",
        description: error.message || "No se pudo configurar Meta Ads API",
        variant: "destructive",
      });
    },
  });

  const handleUpdateToken = () => {
    if (!newToken.trim()) {
      toast({
        title: "Token requerido",
        description: "Pega el nuevo access token en el campo",
        variant: "destructive",
      });
      return;
    }
    updateTokenMutation.mutate(newToken.trim());
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <Navigation />

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Configuración Meta Ads API
          </h1>
          <p className="text-gray-600 mt-2">
            Administrá las credenciales de Meta Ads para datos de gasto y campañas
          </p>
        </div>

        {/* ALERTA: Token vencido o por vencer */}
        {tokenExpiredOrLow && (
          <Alert className="border-red-400 bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>
                {tokenStatus?.isExpired || (tokenStatus?.daysRemaining !== null && tokenStatus?.daysRemaining! <= 0)
                  ? '⚠️ El token de Meta Ads ha VENCIDO.'
                  : `⚠️ El token vence en ${tokenStatus?.daysRemaining} días.`}
              </strong>
              <br />
              Generá un nuevo token en el Graph API Explorer y pegalo en la sección de abajo para restablecer la conexión.
            </AlertDescription>
          </Alert>
        )}

        {/* SECCIÓN PRINCIPAL: Actualizar Token */}
        <Card className={`shadow-lg border-2 ${tokenExpiredOrLow ? 'border-red-300' : 'border-blue-200'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className={`h-5 w-5 ${tokenExpiredOrLow ? 'text-red-600' : 'text-blue-600'}`} />
              Actualizar Access Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription>
                <strong>¿Cómo obtener un nuevo token?</strong>
                <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
                  <li>
                    Ir al{' '}
                    <a
                      href="https://developers.facebook.com/tools/explorer/?app_id=1282943593506408"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline inline-flex items-center gap-1"
                    >
                      Graph API Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Seleccionar la app <strong>MADI</strong> (App ID: 1282943593506408)</li>
                  <li>Hacer clic en <strong>"Generate Access Token"</strong></li>
                  <li>Conceder los permisos: <code className="bg-gray-100 px-1 rounded">ads_read</code>, <code className="bg-gray-100 px-1 rounded">ads_management</code></li>
                  <li>Copiar el token generado y pegarlo abajo</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="newToken">Nuevo Access Token</Label>
              <Textarea
                id="newToken"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="EAAxxxxxxxxxx..."
                className="mt-1 font-mono text-sm"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                El sistema intentará canjearlo por un token de larga duración (~60 días) automáticamente.
              </p>
            </div>

            <Button
              onClick={handleUpdateToken}
              disabled={updateTokenMutation.isPending || !newToken.trim()}
              className={`w-full ${tokenExpiredOrLow ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
            >
              {updateTokenMutation.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Verificando y guardando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" />Actualizar Token</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Estado del token actual */}
        <Card className="shadow-lg border-2 border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
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
                  <TokenStatusBadge days={tokenStatus.daysRemaining} isExpired={tokenStatus.isExpired} />
                </div>
                {tokenStatus.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Vence:</span>
                    <span className="text-sm text-gray-600">
                      {new Date(tokenStatus.expiresAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {!tokenStatus.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Vencimiento:</span>
                    <span className="text-sm text-amber-600 font-medium">No determinado — puede estar vencido</span>
                  </div>
                )}
                {tokenStatus.lastRefreshed && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Último update:</span>
                    <span className="text-sm text-gray-600">
                      {new Date(tokenStatus.lastRefreshed).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Tipo:</span>
                  <span className="text-sm text-gray-600 capitalize font-mono">{tokenStatus.tokenType}</span>
                </div>
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshTokenMutation.mutate()}
                    disabled={refreshTokenMutation.isPending}
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshTokenMutation.isPending ? 'animate-spin' : ''}`} />
                    {refreshTokenMutation.isPending ? 'Verificando...' : 'Verificar Token con Meta'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">No hay token almacenado. Actualizá el token arriba.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuración completa (avanzada) */}
        <Card className="shadow-lg border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-700">
              <Settings className="h-5 w-5" />
              Configuración Completa (Avanzada)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!fullConfigData.accessToken || !fullConfigData.accountId || !fullConfigData.appSecret) {
                  toast({ title: "Campos requeridos", description: "Completá todos los campos", variant: "destructive" });
                  return;
                }
                configMutation.mutate(fullConfigData);
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="accessToken">Access Token</Label>
                <Input
                  id="accessToken"
                  type="password"
                  value={fullConfigData.accessToken}
                  onChange={(e) => setFullConfigData(p => ({ ...p, accessToken: e.target.value }))}
                  placeholder="EAA..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="accountId">Account ID</Label>
                <Input
                  id="accountId"
                  value={fullConfigData.accountId}
                  onChange={(e) => setFullConfigData(p => ({ ...p, accountId: e.target.value }))}
                  placeholder="act_123456789"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="appSecret">App Secret</Label>
                <Input
                  id="appSecret"
                  type="password"
                  value={fullConfigData.appSecret}
                  onChange={(e) => setFullConfigData(p => ({ ...p, appSecret: e.target.value }))}
                  placeholder="Desde developers.facebook.com"
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                disabled={configMutation.isPending}
                variant="outline"
                className="w-full"
              >
                {configMutation.isPending ? "Configurando..." : "Reconfigurar servicio completo"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info de configuración actual */}
        <Card className="shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">Configuración del servidor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium">App ID</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 font-mono">1282943593506408</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium">Account ID</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 font-mono">act_9696169217103588</p>
              </div>
              <div className={`p-3 rounded-lg ${tokenStatus?.hasToken ? 'bg-green-50' : 'bg-orange-50'}`}>
                <div className="flex items-center gap-2">
                  {tokenStatus?.hasToken
                    ? <CheckCircle className="h-4 w-4 text-green-600" />
                    : <XCircle className="h-4 w-4 text-orange-600" />}
                  <span className="text-xs font-medium">Access Token</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{tokenStatus?.hasToken ? '✓ Almacenado en servidor' : '⚠ Pendiente'}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium">App Secret</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">✓ Configurado en servidor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
