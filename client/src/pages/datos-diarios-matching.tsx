import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/navigation";
import { Calendar, Target, Building2, Package, CheckCircle, XCircle, TrendingUp } from "lucide-react";

export default function DatosDiariosMatching() {
  // Fetch datos diarios con matching
  const { data: datosMatching, isLoading: datosLoading } = useQuery({
    queryKey: ['/api/dashboard/datos-diarios-matching'],
  });

  // Fetch campañas con matching
  const { data: campanas, isLoading: campanasLoading } = useQuery({
    queryKey: ['/api/campanas-comerciales/matching'],
  });

  return (
    <div className="space-y-6 p-6">
      <Navigation />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Matching de Datos y Campañas
          </h1>
          <p className="text-muted-foreground">
            Visualización del matching entre datos de Google Sheets y campañas comerciales registradas
          </p>
        </div>
      </div>

      {/* Estadísticas de Matching */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campañas</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {campanas?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Campañas comerciales registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {campanas?.filter((c: any) => c.estadoCampana === 'Completada').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Campañas que alcanzaron su objetivo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {campanas?.filter((c: any) => c.estadoCampana === 'En progreso').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Campañas activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {campanas?.filter((c: any) => c.estadoCampana === 'Vencida').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Campañas que no se completaron
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Campañas con Matching Real */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Campañas Comerciales con Conteo Real</h2>
        
        {campanasLoading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Cargando campañas...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {campanas?.map((campana: any) => (
              <Card key={campana.id} className={`border-l-4 ${
                campana.estadoCampana === 'Completada' ? 'border-l-green-500' : 
                campana.estadoCampana === 'Vencida' ? 'border-l-red-500' : 
                'border-l-blue-500'
              }`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{campana.numeroCampana}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Cliente: {campana.nombreCliente}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{campana.marca}</Badge>
                      <Badge variant={
                        campana.estadoCampana === 'Completada' ? 'default' : 
                        campana.estadoCampana === 'Vencida' ? 'destructive' : 
                        'secondary'
                      }>
                        {campana.estadoCampana}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Barra de progreso */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">Progreso de Datos</h4>
                      <span className="text-sm font-semibold text-primary">
                        {campana.datosObtenidos} / {campana.cantidadDatosSolicitados} 
                        ({campana.porcentajeCompletado}%)
                      </span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-3 mb-2">
                      <div 
                        className={`h-3 rounded-full transition-all duration-300 ${
                          campana.porcentajeCompletado >= 100 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                          campana.porcentajeCompletado >= 75 ? 'bg-gradient-to-r from-blue-500 to-green-500' :
                          campana.porcentajeCompletado >= 50 ? 'bg-gradient-to-r from-yellow-500 to-blue-500' :
                          'bg-gradient-to-r from-red-500 to-yellow-500'
                        }`}
                        style={{ width: `${Math.min(100, campana.porcentajeCompletado)}%` }}
                      ></div>
                    </div>
                    {campana.datosFaltantes > 0 && (
                      <p className="text-xs text-red-600 font-medium">
                        Faltan: {campana.datosFaltantes} datos para completar
                      </p>
                    )}
                  </div>

                  {/* Información detallada */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Datos Obtenidos</h4>
                      <p className="text-lg font-semibold text-green-600">{campana.datosObtenidos}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Zona</h4>
                      <p className="text-sm">{campana.zona}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Fecha Inicio</h4>
                      <p className="text-sm">{campana.fechaCampana}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Fecha Fin Estimada</h4>
                      <p className="text-sm">{campana.fechaFin || 'Calculando...'}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Días con Datos</h4>
                      <p className="text-lg font-semibold text-blue-600">{campana.datosMatcheados}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Último Dato</h4>
                      <p className="text-sm">{campana.ultimaFechaConDatos || 'Sin datos'}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Datos Solicitados</h4>
                      <p className="text-sm">{campana.cantidadDatosSolicitados}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Estado</h4>
                      <Badge variant={
                        campana.estadoCampana === 'Completada' ? 'default' : 
                        campana.estadoCampana === 'Vencida' ? 'destructive' : 
                        'secondary'
                      } className="w-fit">
                        {campana.estadoCampana}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {campanas?.length === 0 && (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay campañas comerciales registradas</p>
                  <p className="text-sm">Crea una campaña para ver el matching con datos de Google Sheets</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}