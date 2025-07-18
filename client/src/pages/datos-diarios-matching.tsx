import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/navigation";
import { Calendar, Target, Building2, Package, CheckCircle, XCircle } from "lucide-react";

export default function DatosDiariosMatching() {
  const { data: datosMatching, isLoading } = useQuery({
    queryKey: ['/api/dashboard/datos-diarios-matching'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: campanasMatching } = useQuery({
    queryKey: ['/api/campanas-comerciales/matching'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Cargando datos con matching...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Navigation />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Datos Diarios con Matching de Campañas
          </h1>
          <p className="text-muted-foreground">
            Visualización de datos de Google Sheets con relación automática a campañas creadas
          </p>
        </div>
      </div>

      {/* Resumen de Matching */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Datos Sheets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{datosMatching?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Registros desde Google Sheets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Matching</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {datosMatching?.filter((d: any) => d.hasMatch).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Datos vinculados a campañas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Matching</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {datosMatching?.filter((d: any) => !d.hasMatch).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Datos sin campaña asociada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Datos con Matching */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Datos de Google Sheets con Matching</h2>
        
        {datosMatching && datosMatching.length > 0 ? (
          datosMatching.map((dato: any, index: number) => (
            <Card key={index} className={`border-l-4 ${dato.hasMatch ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{dato.cliente}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Campaña: {dato.campana} | Zona: {dato.zona}
                    </p>
                  </div>
                  <Badge variant={dato.hasMatch ? "default" : "destructive"}>
                    {dato.hasMatch ? "Con Matching" : "Sin Matching"}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      <h4 className="text-sm font-medium">Enviados</h4>
                    </div>
                    <p className="text-sm font-semibold">{dato.enviados || 0}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-green-500" />
                      <h4 className="text-sm font-medium">Entregados/Día</h4>
                    </div>
                    <p className="text-sm font-semibold">{dato.entregadosPorDia || 0}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-orange-500" />
                      <h4 className="text-sm font-medium">CPL</h4>
                    </div>
                    <p className="text-sm font-semibold">${dato.cpl || 0}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      <h4 className="text-sm font-medium">Venta/Campaña</h4>
                    </div>
                    <p className="text-sm font-semibold">${dato.ventaPorCampana || 0}</p>
                  </div>
                </div>

                {/* Información de la campaña matched */}
                {dato.hasMatch && dato.campanaMatched && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2 text-green-600">Campaña Vinculada:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-green-50 dark:bg-green-900/20 p-3 rounded">
                      <div>
                        <p className="text-xs text-muted-foreground">Número Campaña</p>
                        <p className="text-sm font-medium">{dato.campanaMatched.numeroCampana}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="text-sm font-medium">{dato.campanaMatched.nombreCliente}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha Inicio</p>
                        <p className="text-sm font-medium">
                          {dato.campanaMatched.fechaCampana ? 
                            new Date(dato.campanaMatched.fechaCampana).toLocaleDateString('es-AR') : 
                            'No especificada'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha Fin</p>
                        <p className="text-sm font-medium">
                          {dato.campanaMatched.fechaFin ? 
                            new Date(dato.campanaMatched.fechaFin).toLocaleDateString('es-AR') : 
                            'No especificada'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No hay datos disponibles</h3>
              <p className="text-muted-foreground mb-4">
                No se encontraron datos de Google Sheets para procesar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lista de Campañas Creadas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Campañas Comerciales Creadas</h2>
        
        {campanasMatching && campanasMatching.length > 0 ? (
          <div className="grid gap-4">
            {campanasMatching.map((campana: any) => (
              <Card key={campana.id}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Número Campaña</p>
                      <p className="text-sm font-medium">{campana.numeroCampana}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="text-sm font-medium">{campana.nombreCliente}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Marca</p>
                      <Badge variant="secondary">{campana.marca}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Zona</p>
                      <Badge variant="outline">{campana.zona}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha Inicio</p>
                      <p className="text-sm">
                        {campana.fechaCampana ? 
                          new Date(campana.fechaCampana).toLocaleDateString('es-AR') : 
                          'No especificada'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha Fin</p>
                      <p className="text-sm">
                        {campana.fechaFin ? 
                          new Date(campana.fechaFin).toLocaleDateString('es-AR') : 
                          'No especificada'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No hay campañas creadas</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primera campaña comercial para ver el matching en acción.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}