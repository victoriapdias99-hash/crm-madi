import { useState, useEffect } from 'react';
import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Eye, Edit2, Power } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface DashboardData {
  cliente: string;
  clienteNombre: string;
  marca: string;
  zona: string;
  numeroCampana: string;
  enviados: number;
  entregadosPorDia: number;
  pedidosPorDia: number;
  pedidosTotal: number;
  porcentajeDesvio: number;
  porcentajeDatosEnviados: number;
  faltantesAEnviar: number;
  cpl: string;
  ventaPorCampana: string;
  inversionRealizada: number;
  inversionPendiente: number;
  fechaCampana: string;
  fechaFinReal: string;
  cantidadSolicitada: number;
  diasProcesados: number;
  estadoCampana: string;
}

// Esquema de validación para editar campaña
const editCampaignSchema = z.object({
  cantidadDatosSolicitados: z.number().min(1, "Debe ser mayor a 0"),
  marca: z.string().min(1, "Marca es requerida"),
  zona: z.string().min(1, "Zona es requerida"),
  localizado: z.string().optional(),
  pedidosPorDia: z.number().min(0, "Debe ser mayor o igual a 0"),
  facturacionBruta: z.number().min(0, "Debe ser mayor o igual a 0"),
});

type EditCampaignForm = z.infer<typeof editCampaignSchema>;

// Función para extraer marca del nombre del cliente
const extractMarca = (clienteNombre: string): string => {
  const marcaMap: Record<string, string> = {
    'PEUGEOT': 'Peugeot',
    'TOYOTA': 'Toyota',
    'VW': 'Volkswagen',
    'FIAT': 'Fiat',
    'FORD': 'Ford',
    'JEEP': 'Jeep',
    'CHEVROLET': 'Chevrolet',
    'CITROEN': 'Citroën',
    'RENAULT': 'Renault'
  };
  
  // Buscar marcas conocidas en cualquier parte del nombre (case insensitive)
  const nombreUpper = clienteNombre.toUpperCase();
  for (const [key, value] of Object.entries(marcaMap)) {
    if (nombreUpper.includes(key)) {
      return value;
    }
  }
  
  // Si no encuentra marca conocida, usar la primera palabra
  const match = clienteNombre.match(/^([A-Z]+)/);
  const marcaKey = match ? match[1] : clienteNombre.split(' ')[0].toUpperCase();
  return marcaMap[marcaKey] || marcaKey;
};

export default function DashboardSimple() {
  const [data, setData] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<DashboardData | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [closingCampaign, setClosingCampaign] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/dashboard/datos-diarios', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Datos cargados:', result.length, 'registros');
      setData(result);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refreshData = async () => {
    try {
      setLoading(true);
      
      // Primero ejecutar refresh completo
      const refreshResponse = await fetch('/api/dashboard/refresh-all-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (refreshResponse.ok) {
        console.log('Refresh completado, recargando datos...');
        await fetchData();
      } else {
        throw new Error('Error en refresh');
      }
    } catch (err) {
      console.error('Error en refresh:', err);
      setError('Error actualizando datos');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Navigation />
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Cargando datos del dashboard...</p>
            <p className="text-sm text-gray-500 mt-2">{data.length} registros cargados</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Navigation />
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <strong>Error:</strong> {error}
            </div>
            <button 
              onClick={fetchData}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Todas las campañas se consideran en proceso - sin finalización automática
  const campanasEnProceso = data;
  const campanasFinalizadas: any[] = [];

  // Funciones para manejar las acciones
  const handleCloseCampaign = async (campaign: DashboardData) => {
    try {
      setClosingCampaign(campaign.numeroCampana);
      
      // Buscar el cliente en el nombre de la campaña para hacer el cierre específico
      const clienteName = campaign.clienteNombre.toUpperCase().replace(/\s+/g, '_');
      const marca = extractMarca(campaign.cliente).toUpperCase();
      
      const response = await apiRequest('/api/campaign-closure/execute', 'POST', {
        clients: [clienteName],
        brands: [marca],
        dryRun: false
      });

      if (response) {
        toast({
          title: "Campaña cerrada exitosamente",
          description: `La campaña ${campaign.numeroCampana} ha sido cerrada correctamente.`
        });
        // Recargar datos después del cierre
        await fetchData();
      }
    } catch (error) {
      console.error('Error cerrando campaña:', error);
      toast({
        title: "Error al cerrar campaña",
        description: "Hubo un problema al cerrar la campaña. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setClosingCampaign(null);
    }
  };

  // Form para edición de campaña
  const editForm = useForm<EditCampaignForm>({
    resolver: zodResolver(editCampaignSchema),
    defaultValues: {
      cantidadDatosSolicitados: 0,
      marca: '',
      zona: '',
      localizado: '',
      pedidosPorDia: 0,
      facturacionBruta: 0,
    },
  });

  const handleEditCampaign = async (campaign: DashboardData) => {
    try {
      setIsLoadingCampaign(true);
      setSelectedCampaign(campaign);
      
      // Obtener el ID de la campaña comercial
      const response = await fetch(`/api/campanas-comerciales/by-client-campaign?clienteNombre=${encodeURIComponent(campaign.clienteNombre)}&numeroCampana=${encodeURIComponent(campaign.numeroCampana)}`);
      
      if (!response.ok) {
        throw new Error('Campaña no encontrada');
      }
      
      const { id, campana } = await response.json();
      setEditingCampaignId(id);
      
      // Cargar datos en el formulario
      editForm.reset({
        cantidadDatosSolicitados: campana.cantidadDatosSolicitados || 0,
        marca: campana.marca || '',
        zona: campana.zona || '',
        localizado: campana.localizado || '',
        pedidosPorDia: campana.pedidosPorDia || 0,
        facturacionBruta: parseFloat(campana.facturacionBruta || '0'),
      });
      
      setIsEditDialogOpen(true);
    } catch (error) {
      console.error('Error cargando campaña:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información de la campaña",
        variant: "destructive"
      });
    } finally {
      setIsLoadingCampaign(false);
    }
  };

  const handleSaveCampaign = async (data: EditCampaignForm) => {
    if (!editingCampaignId) return;
    
    try {
      const response = await apiRequest(`/api/campanas-comerciales/${editingCampaignId}`, 'PUT', data);
      
      if (response) {
        toast({
          title: "Campaña actualizada",
          description: "Los cambios se han guardado correctamente"
        });
        setIsEditDialogOpen(false);
        setEditingCampaignId(null);
        editForm.reset();
        // Recargar datos del dashboard
        await fetchData();
      }
    } catch (error) {
      console.error('Error actualizando campaña:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la campaña",
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = (campaign: DashboardData) => {
    setSelectedCampaign(campaign);
    setIsDetailsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Navigation />
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard - Datos Diarios</h1>
            <p className="text-gray-600 mt-2">
              Sistema de gestión de campañas Meta Ads con datos reales de Google Sheets
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refreshData}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Actualizando...' : 'Actualizar Datos'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Campañas</h3>
            <p className="text-2xl font-bold text-gray-900">{data.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">En Proceso</h3>
            <p className="text-2xl font-bold text-orange-600">{campanasEnProceso.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Finalizadas</h3>
            <p className="text-2xl font-bold text-green-600">{campanasFinalizadas.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Enviados</h3>
            <p className="text-2xl font-bold text-blue-600">
              {data.reduce((sum, item) => sum + item.enviados, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Campañas en Proceso */}
        {campanasEnProceso.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Campañas en Proceso ({campanasEnProceso.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zona</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enviados</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Completado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faltantes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPL</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inversión</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campanasEnProceso.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">{item.clienteNombre}</div>
                          <div className="text-sm text-gray-500">Campaña #{item.numeroCampana}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="bg-indigo-50 p-2 rounded text-center">
                          <span className="font-semibold text-indigo-700">{extractMarca(item.cliente)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.zona}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.enviados}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.pedidosTotal}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-orange-500 h-2 rounded-full" 
                              style={{width: `${Math.min(item.porcentajeDatosEnviados, 100)}%`}}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {item.porcentajeDatosEnviados.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          {item.faltantesAEnviar}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ARS ${parseFloat(item.cpl).toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ARS ${item.inversionRealizada.toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCloseCampaign(item)}
                            disabled={closingCampaign === item.numeroCampana}
                            className="h-8 px-3"
                            data-testid={`button-close-campaign-${item.numeroCampana}`}
                          >
                            {closingCampaign === item.numeroCampana ? (
                              <span className="text-xs">Cerrando...</span>
                            ) : (
                              <>
                                <Power className="w-3 h-3 mr-1" />
                                <span className="text-xs">Cerrar</span>
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditCampaign(item)}
                            className="h-8 px-3"
                            data-testid={`button-edit-campaign-${item.numeroCampana}`}
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            <span className="text-xs">Editar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(item)}
                            className="h-8 px-3"
                            data-testid={`button-details-campaign-${item.numeroCampana}`}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            <span className="text-xs">Ver detalles</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Campañas Finalizadas */}
        {campanasFinalizadas.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Campañas Finalizadas ({campanasFinalizadas.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zona</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enviados</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPL</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inversión</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campanasFinalizadas.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">{item.clienteNombre}</div>
                          <div className="text-sm text-gray-500">Campaña #{item.numeroCampana}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="bg-indigo-50 p-2 rounded text-center">
                          <span className="font-semibold text-indigo-700">{extractMarca(item.cliente)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.zona}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.enviados}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.pedidosTotal}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          Completada
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ARS ${parseFloat(item.cpl).toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ARS ${item.inversionRealizada.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No hay datos disponibles</p>
            <button 
              onClick={fetchData}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Cargar datos
            </button>
          </div>
        )}

        {/* Dialog para Ver Detalles de Campaña */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles de la Campaña</DialogTitle>
            </DialogHeader>
            {selectedCampaign && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-700">Cliente</h3>
                    <p className="text-sm">{selectedCampaign.clienteNombre}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Número de Campaña</h3>
                    <p className="text-sm">#{selectedCampaign.numeroCampana}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Marca</h3>
                    <p className="text-sm">{extractMarca(selectedCampaign.cliente)}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Zona</h3>
                    <p className="text-sm">{selectedCampaign.zona}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Fecha de Inicio</h3>
                    <p className="text-sm">{selectedCampaign.fechaCampana || 'No especificada'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Fecha de Fin</h3>
                    <p className="text-sm">{selectedCampaign.fechaFinReal || 'En proceso'}</p>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-700 mb-3">Estadísticas de la Campaña</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{selectedCampaign.enviados}</p>
                      <p className="text-sm text-gray-500">Enviados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{selectedCampaign.pedidosTotal}</p>
                      <p className="text-sm text-gray-500">Total Solicitado</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{selectedCampaign.porcentajeDatosEnviados.toFixed(1)}%</p>
                      <p className="text-sm text-gray-500">Completado</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-700 mb-3">Información Financiera</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-600">CPL (Costo por Lead)</h4>
                      <p className="text-lg font-semibold">ARS ${parseFloat(selectedCampaign.cpl).toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-600">Inversión Realizada</h4>
                      <p className="text-lg font-semibold">ARS ${selectedCampaign.inversionRealizada.toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-700 mb-3">Progreso</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Faltantes por enviar</span>
                      <span className="font-medium">{selectedCampaign.faltantesAEnviar}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-orange-500 h-3 rounded-full transition-all duration-300" 
                        style={{width: `${Math.min(selectedCampaign.porcentajeDatosEnviados, 100)}%`}}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog para Editar Campaña */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Campaña</DialogTitle>
            </DialogHeader>
            {selectedCampaign && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-2">Información de la Campaña</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Cliente:</span> {selectedCampaign.clienteNombre}
                    </div>
                    <div>
                      <span className="font-medium">Número:</span> #{selectedCampaign.numeroCampana}
                    </div>
                  </div>
                </div>

                {isLoadingCampaign ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(handleSaveCampaign)} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="cantidadDatosSolicitados"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cantidad de Datos Solicitados</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Cantidad de datos"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-cantidad-datos"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={editForm.control}
                          name="pedidosPorDia"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pedidos por Día</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Pedidos por día"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-pedidos-por-dia"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="marca"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Marca</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Marca del vehículo"
                                  {...field}
                                  data-testid="input-marca"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={editForm.control}
                          name="zona"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zona</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Zona geográfica"
                                  {...field}
                                  data-testid="input-zona"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="localizado"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Localización (Opcional)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Localización específica"
                                  {...field}
                                  data-testid="input-localizado"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={editForm.control}
                          name="facturacionBruta"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Facturación Bruta</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  data-testid="input-facturacion-bruta"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setIsEditDialogOpen(false);
                            setEditingCampaignId(null);
                            editForm.reset();
                          }}
                          data-testid="button-cancel-edit"
                        >
                          Cancelar
                        </Button>
                        <Button 
                          type="submit" 
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={editForm.formState.isSubmitting}
                          data-testid="button-save-campaign"
                        >
                          {editForm.formState.isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}