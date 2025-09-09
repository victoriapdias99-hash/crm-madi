import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, BarChart3, DollarSign, Users, Target } from 'lucide-react';

interface CplAnalysisItem {
  marca: string;
  importeGastado: number;
  cplMetaAds: number;
  leadsMetaAds: number;
  cplReal: number;
  leadsReales: number;
  diferenciaCPL: number;
  diferenciaPorcentaje: number;
  campanasMetaAds: string[];
}

interface CplAnalysisResponse {
  success: boolean;
  dateRange: { from: string; to: string };
  data: CplAnalysisItem[];
  summary: {
    totalMarcas: number;
    totalImporteGastado: number;
    totalLeadsMetaAds: number;
    totalLeadsReales: number;
  };
  timestamp: string;
}

function CplAnalysis() {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 7 días atrás por defecto
    return date.toISOString().split('T')[0];
  });
  
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [isManualQuery, setIsManualQuery] = useState(false);

  // Query para obtener datos de análisis CPL
  const { data, isLoading, error, refetch } = useQuery<CplAnalysisResponse>({
    queryKey: ['/api/cpl-analysis', dateFrom, dateTo],
    queryFn: () => 
      fetch(`/api/cpl-analysis?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Error ${res.status}: ${res.statusText}`);
          }
          return res.json();
        }),
    enabled: isManualQuery, // Solo ejecutar cuando el usuario haga clic
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false
  });

  const handleAnalyze = () => {
    setIsManualQuery(true);
    refetch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getBadgeVariant = (diferenciaPorcentaje: number) => {
    if (diferenciaPorcentaje > 10) return 'destructive';
    if (diferenciaPorcentaje > 0) return 'secondary';
    return 'default';
  };

  const getTrendIcon = (diferenciaCPL: number) => {
    return diferenciaCPL > 0 ? 
      <TrendingUp className="h-4 w-4 text-red-500" /> : 
      <TrendingDown className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-cpl-analysis">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="title-main">
            Análisis CPL Comparativo
          </h1>
        </div>
        <p className="text-muted-foreground" data-testid="text-description">
          Comparación entre CPL reportado por Meta Ads vs CPL real basado en leads de la base de datos
        </p>
      </div>

      {/* Filtros de fecha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Filtros de Análisis
          </CardTitle>
          <CardDescription>
            Selecciona el rango de fechas para el análisis comparativo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="date-from">Fecha Desde</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">Fecha Hasta</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
            <Button 
              onClick={handleAnalyze} 
              disabled={isLoading}
              className="w-full md:w-auto"
              data-testid="button-analyze"
            >
              {isLoading ? 'Analizando...' : 'Ejecutar Análisis'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Gastado</p>
                  <p className="text-2xl font-bold" data-testid="text-total-spent">
                    {formatCurrency(data.summary.totalImporteGastado)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leads Meta Ads</p>
                  <p className="text-2xl font-bold" data-testid="text-leads-meta">
                    {data.summary.totalLeadsMetaAds.toLocaleString()}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leads Reales</p>
                  <p className="text-2xl font-bold" data-testid="text-leads-real">
                    {data.summary.totalLeadsReales.toLocaleString()}
                  </p>
                </div>
                <Target className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Marcas Analizadas</p>
                  <p className="text-2xl font-bold" data-testid="text-brands-count">
                    {data.summary.totalMarcas}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de resultados */}
      {data?.data && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Análisis</CardTitle>
            <CardDescription>
              Rango: {data.dateRange.from} → {data.dateRange.to}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="table-results">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">MARCA</th>
                    <th className="text-right p-3 font-medium">IMPORTE GASTADO</th>
                    <th className="text-right p-3 font-medium">CPL META ADS</th>
                    <th className="text-right p-3 font-medium">LEADS META</th>
                    <th className="text-right p-3 font-medium">CPL REAL</th>
                    <th className="text-right p-3 font-medium">LEADS REALES</th>
                    <th className="text-center p-3 font-medium">DIFERENCIA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((item, index) => (
                    <tr 
                      key={item.marca} 
                      className="border-b hover:bg-muted/50 transition-colors"
                      data-testid={`row-brand-${index}`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.marca}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.campanasMetaAds.length} campañas
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-spent-${index}`}>
                        {formatCurrency(item.importeGastado)}
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-cpl-meta-${index}`}>
                        {formatCurrency(item.cplMetaAds)}
                      </td>
                      <td className="p-3 text-right" data-testid={`text-leads-meta-${index}`}>
                        {item.leadsMetaAds.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-cpl-real-${index}`}>
                        {formatCurrency(item.cplReal)}
                      </td>
                      <td className="p-3 text-right" data-testid={`text-leads-real-${index}`}>
                        {item.leadsReales.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getTrendIcon(item.diferenciaCPL)}
                          <div className="text-center">
                            <Badge variant={getBadgeVariant(item.diferenciaPorcentaje)}>
                              {item.diferenciaPorcentaje > 0 ? '+' : ''}{item.diferenciaPorcentaje.toFixed(1)}%
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatCurrency(Math.abs(item.diferenciaCPL))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.data.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron datos para el rango de fechas seleccionado
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado de carga */}
      {isLoading && (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <p>Obteniendo datos de Meta Ads y analizando leads...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado de error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <p className="text-destructive font-medium">Error al obtener análisis CPL</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
              <Button onClick={handleAnalyze} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información adicional */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Explicación del Análisis
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>CPL Meta Ads:</strong> Coste por resultado reportado por Meta Ads</p>
              <p><strong>CPL Real:</strong> Importe gastado dividido entre leads reales en la base de datos</p>
              <p><strong>Diferencia:</strong> Variación porcentual entre CPL Meta vs CPL Real</p>
              <Separator className="my-2" />
              <p className="text-xs">
                Los datos se agrupan por marca y se filtran por el rango de fechas seleccionado.
                Solo se incluyen campañas que contengan el nombre de la marca.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CplAnalysis;