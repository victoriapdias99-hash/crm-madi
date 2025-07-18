import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Settings, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";

interface ConfigFormData {
  accessToken: string;
  accountId: string;
  appSecret: string;
}

export default function MetaAdsConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<ConfigFormData>({
    accessToken: 'EAARsFyVZAqz0BPNpiFxX7X5ZCnbF1xxB6X5Is4uhizndOgUUZBIxbP7s8ZAdfw6ZARMGrMTsGgxJ2ZC1gELyQcZCilMxRtqeKdYsU0XVGboMhrrDI7l0odZAaz7jdP7KZCph0ik4cvdBvaW8fer3zMlWJPZC2gJZANBnfY2fAnfmGBkslN3lzpGcgsBLqHHC60NlvW4ZChFqRyTqYNPENxOWkAqzQwvLbBc4fLGDNdJCwSp8BkuI',
    accountId: 'act_9696169217103588',
    appSecret: ''
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
                  {formData.accessToken ? '✓ Configurado' : '⚠ Pendiente'}
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