import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Navigation } from '@/components/navigation';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Settings, Eye, Trash2, Globe, Zap, Users, BarChart3 } from 'lucide-react';

interface ManychatWebhook {
  id: number;
  marca: string;
  webhookUrl: string;
  localizacionField: string;
  clienteField: string;
  activo: boolean;
  descripcion?: string;
  createdAt: string;
  updatedAt: string;
}

interface IntegracionManychat {
  id: number;
  webhookId: number;
  fecha: string;
  nombre: string;
  telefono: string;
  localidad?: string;
  modelo?: string;
  horarioComentarios?: string;
  origen: string;
  localizacion?: string;
  marca: string;
  createdAt: string;
  updatedAt: string;
}

export default function IntegracionManychat() {
  const [selectedWebhook, setSelectedWebhook] = useState<ManychatWebhook | null>(null);
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    marca: '',
    webhookUrl: '',
    localizacionField: '',
    clienteField: '',
    activo: true,
    descripcion: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: webhooks = [], isLoading: loadingWebhooks } = useQuery({
    queryKey: ['/api/integracion-manychat/webhooks'],
    queryFn: () => apiRequest('/api/integracion-manychat/webhooks')
  });

  const { data: integraciones = [], isLoading: loadingIntegraciones } = useQuery({
    queryKey: ['/api/integracion-manychat/datos'],
    queryFn: () => apiRequest('/api/integracion-manychat/datos?limit=50')
  });

  // Mutations
  const createWebhookMutation = useMutation({
    mutationFn: (webhook: any) => apiRequest('/api/integracion-manychat/webhooks', {
      method: 'POST',
      body: JSON.stringify(webhook),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integracion-manychat/webhooks'] });
      toast({ description: 'Webhook creado correctamente' });
      setIsCreatingWebhook(false);
      setNewWebhook({
        marca: '',
        webhookUrl: '',
        localizacionField: '',
        clienteField: '',
        activo: true,
        descripcion: ''
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: `Error al crear webhook: ${error.message}`
      });
    }
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/integracion-manychat/webhooks/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integracion-manychat/webhooks'] });
      toast({ description: 'Webhook eliminado correctamente' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: `Error al eliminar webhook: ${error.message}`
      });
    }
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => 
      apiRequest(`/api/integracion-manychat/webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ activo }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integracion-manychat/webhooks'] });
      toast({ description: 'Estado del webhook actualizado' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: `Error al actualizar webhook: ${error.message}`
      });
    }
  });

  const handleCreateWebhook = () => {
    if (!newWebhook.marca || !newWebhook.webhookUrl || !newWebhook.localizacionField || !newWebhook.clienteField) {
      toast({
        variant: 'destructive',
        description: 'Todos los campos obligatorios deben completarse'
      });
      return;
    }

    createWebhookMutation.mutate(newWebhook);
  };

  const handleDeleteWebhook = (id: number) => {
    if (confirm('¿Está seguro que desea eliminar este webhook?')) {
      deleteWebhookMutation.mutate(id);
    }
  };

  const handleToggleWebhook = (webhook: ManychatWebhook) => {
    toggleWebhookMutation.mutate({
      id: webhook.id,
      activo: !webhook.activo
    });
  };

  const getWebhookUrl = (webhookUrl: string) => {
    // Extraer el ID del webhook para mostrar la URL pública
    const parts = webhookUrl.split('/');
    const webhookId = parts[parts.length - 1];
    return `${window.location.origin}/webhook/manychat/${webhookId}`;
  };

  const statsData = {
    totalWebhooks: webhooks.length,
    activeWebhooks: webhooks.filter((w: ManychatWebhook) => w.activo).length,
    totalLeads: integraciones.length,
    marcasActivas: [...new Set(webhooks.filter((w: ManychatWebhook) => w.activo).map((w: ManychatWebhook) => w.marca))].length
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      
      <div className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Integración v2 - Manychat
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Gestiona webhooks de Manychat para recibir leads de diferentes marcas y escenarios
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Globe className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Webhooks</p>
                  <p className="text-2xl font-bold">{statsData.totalWebhooks}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Zap className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Webhooks Activos</p>
                  <p className="text-2xl font-bold">{statsData.activeWebhooks}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Leads</p>
                  <p className="text-2xl font-bold">{statsData.totalLeads}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Marcas Activas</p>
                  <p className="text-2xl font-bold">{statsData.marcasActivas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="webhooks" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="webhooks" data-testid="tab-webhooks">Configuración de Webhooks</TabsTrigger>
            <TabsTrigger value="datos" data-testid="tab-datos">Visualizar Datos</TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Webhooks Configurados
                  </CardTitle>
                  <Dialog open={isCreatingWebhook} onOpenChange={setIsCreatingWebhook}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2" data-testid="button-create-webhook">
                        <Plus className="w-4 h-4" />
                        Nuevo Webhook
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Crear Nuevo Webhook</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="marca">Marca *</Label>
                          <Input
                            id="marca"
                            placeholder="ej: Chevrolet AMBA"
                            value={newWebhook.marca}
                            onChange={(e) => setNewWebhook(prev => ({ ...prev, marca: e.target.value }))}
                            data-testid="input-marca"
                          />
                        </div>
                        <div>
                          <Label htmlFor="webhookUrl">URL del Webhook de Make.com *</Label>
                          <Input
                            id="webhookUrl"
                            placeholder="https://hook.eu2.make.com/..."
                            value={newWebhook.webhookUrl}
                            onChange={(e) => setNewWebhook(prev => ({ ...prev, webhookUrl: e.target.value }))}
                            data-testid="input-webhook-url"
                          />
                        </div>
                        <div>
                          <Label htmlFor="localizacionField">Campo Localización *</Label>
                          <Input
                            id="localizacionField"
                            placeholder="ej: Amba, Nacional, Córdoba"
                            value={newWebhook.localizacionField}
                            onChange={(e) => setNewWebhook(prev => ({ ...prev, localizacionField: e.target.value }))}
                            data-testid="input-localizacion"
                          />
                        </div>
                        <div>
                          <Label htmlFor="clienteField">Campo Cliente *</Label>
                          <Input
                            id="clienteField"
                            placeholder="ej: Chevrolet AMBA"
                            value={newWebhook.clienteField}
                            onChange={(e) => setNewWebhook(prev => ({ ...prev, clienteField: e.target.value }))}
                            data-testid="input-cliente"
                          />
                        </div>
                        <div>
                          <Label htmlFor="descripcion">Descripción</Label>
                          <Textarea
                            id="descripcion"
                            placeholder="Descripción opcional del webhook"
                            value={newWebhook.descripcion}
                            onChange={(e) => setNewWebhook(prev => ({ ...prev, descripcion: e.target.value }))}
                            data-testid="input-descripcion"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <DialogClose asChild>
                            <Button variant="outline" data-testid="button-cancel">Cancelar</Button>
                          </DialogClose>
                          <Button onClick={handleCreateWebhook} data-testid="button-save">
                            Crear Webhook
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingWebhooks ? (
                  <p className="text-center text-gray-500">Cargando webhooks...</p>
                ) : webhooks.length === 0 ? (
                  <div className="text-center py-8">
                    <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No hay webhooks configurados</p>
                    <Button 
                      onClick={() => setIsCreatingWebhook(true)}
                      className="flex items-center gap-2"
                      data-testid="button-create-first"
                    >
                      <Plus className="w-4 h-4" />
                      Crear primer webhook
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {webhooks.map((webhook: ManychatWebhook) => (
                      <div 
                        key={webhook.id} 
                        className="border rounded-lg p-4 space-y-3"
                        data-testid={`webhook-${webhook.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{webhook.marca}</h3>
                            <Badge variant={webhook.activo ? 'default' : 'secondary'} data-testid={`badge-status-${webhook.id}`}>
                              {webhook.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={webhook.activo}
                              onCheckedChange={() => handleToggleWebhook(webhook)}
                              data-testid={`switch-${webhook.id}`}
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteWebhook(webhook.id)}
                              data-testid={`button-delete-${webhook.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-600 dark:text-gray-400">Localización:</p>
                            <p>{webhook.localizacionField}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-600 dark:text-gray-400">Cliente:</p>
                            <p>{webhook.clienteField}</p>
                          </div>
                        </div>

                        {webhook.descripcion && (
                          <div className="text-sm">
                            <p className="font-medium text-gray-600 dark:text-gray-400">Descripción:</p>
                            <p>{webhook.descripcion}</p>
                          </div>
                        )}

                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            URL para configurar en Make.com:
                          </p>
                          <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded border select-all">
                            {getWebhookUrl(webhook.webhookUrl)}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="datos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Datos Recibidos de Manychat
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingIntegraciones ? (
                  <p className="text-center text-gray-500">Cargando datos...</p>
                ) : integraciones.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No se han recibido datos aún</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Los datos aparecerán aquí cuando se reciban webhooks de Manychat
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-200 dark:border-gray-700">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800">
                          <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left">Fecha</th>
                          <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left">Nombre</th>
                          <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left">Teléfono</th>
                          <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left">Localidad</th>
                          <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left">Modelo</th>
                          <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left">Origen</th>
                          <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left">Localización</th>
                          <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left">Marca</th>
                        </tr>
                      </thead>
                      <tbody>
                        {integraciones.map((integracion: IntegracionManychat) => (
                          <tr key={integracion.id} data-testid={`row-integracion-${integracion.id}`}>
                            <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm">
                              {new Date(integracion.fecha).toLocaleDateString('es-AR')}
                            </td>
                            <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">{integracion.nombre}</td>
                            <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">{integracion.telefono}</td>
                            <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">{integracion.localidad || '-'}</td>
                            <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">{integracion.modelo || '-'}</td>
                            <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">
                              <Badge variant="outline">{integracion.origen}</Badge>
                            </td>
                            <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">{integracion.localizacion || '-'}</td>
                            <td className="border border-gray-200 dark:border-gray-700 px-4 py-2">
                              <Badge>{integracion.marca}</Badge>
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
        </Tabs>
      </div>
    </div>
  );
}