import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Calculator, DollarSign, Target, BarChart3, Percent } from 'lucide-react';
import { Navigation } from '@/components/navigation';

interface FinanzasMetaAdsData {
  marca: string;
  leadsMetaAds: number;
  leadsReales: number;
  diferenciALeads: number;
  diferencPorcentajeLeads: number;
  cplMetaAds: number;
  cplReal: number;
  inversionMetaAds: number;
  impuestosMetaAds: number;
  inversionTotal: number;
  facturacionBruta: number;
  iibb: number;
  iva: number;
  totalImpuestos: number;
  ganancia: number;
  roi: number;
  ventaPromedio: number;
  campanasMetaAds: string[];
}

interface FinanzasMetaAdsResponse {
  success: boolean;
  dateRange: { from: string; to: string };
  data: FinanzasMetaAdsData[];
  summary: {
    totalMarcas: number;
    totalLeadsMetaAds: number;
    totalLeadsReales: number;
    totalInversionMetaAds: number;
    totalImpuestosMetaAds: number;
    totalInversionTotal: number;
    totalFacturacion: number;
    totalIIBB: number;
    totalIVA: number;
    totalImpuestos: number;
    totalGanancia: number;
    roiPromedio: number;
    incluirIIBB: boolean;
    incluirIVA: boolean;
  };
  timestamp: string;
}

export default function FinanzasDashboardMetaAds() {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // 30 días atrás por defecto
    return date.toISOString().split('T')[0];
  });
  
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [isManualQuery, setIsManualQuery] = useState(false);
  const [incluirIIBB, setIncluirIIBB] = useState(false);
  const [incluirIVA, setIncluirIVA] = useState(false);

  // Query para obtener datos financieros de Meta Ads
  const { data, isLoading, error, refetch } = useQuery<FinanzasMetaAdsResponse>({
    queryKey: ['/api/finanzas-meta-ads', dateFrom, dateTo, incluirIIBB, incluirIVA],
    queryFn: () => 
      fetch(`/api/finanzas-meta-ads?dateFrom=${dateFrom}&dateTo=${dateTo}&incluirIIBB=${incluirIIBB}&incluirIVA=${incluirIVA}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Error ${res.status}: ${res.statusText}`);
          }
          return res.json();
        }),
    enabled: isManualQuery,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false
  });

  const handleAnalyze = () => {
    setIsManualQuery(true);
    refetch();
  };

  // Funciones para filtros rápidos de fecha
  const setDateFilter = (type: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (type) {
      case 'hoy':
        setDateFrom(todayStr);
        setDateTo(todayStr);
        break;
      case 'ayer':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        setDateFrom(yesterdayStr);
        setDateTo(yesterdayStr);
        break;
      case '7dias':
        const week = new Date(today);
        week.setDate(week.getDate() - 6);
        setDateFrom(week.toISOString().split('T')[0]);
        setDateTo(todayStr);
        break;
      case '14dias':
        const twoWeeks = new Date(today);
        twoWeeks.setDate(twoWeeks.getDate() - 13);
        setDateFrom(twoWeeks.toISOString().split('T')[0]);
        setDateTo(todayStr);
        break;
      case '30dias':
        const month = new Date(today);
        month.setDate(month.getDate() - 29);
        setDateFrom(month.toISOString().split('T')[0]);
        setDateTo(todayStr);
        break;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getBadgeVariant = (roi: number) => {
    if (roi > 50) return 'default';
    if (roi > 0) return 'secondary';
    return 'destructive';
  };

  const getTrendIcon = (roi: number) => {
    return roi > 0 ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-finanzas-meta-ads">
      <Navigation />
      
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="title-main">
            Dashboard Financiero con Meta Ads
          </h1>
        </div>
        <p className="text-muted-foreground" data-testid="text-description">
          Análisis financiero por marca basado en inversión real de Meta Ads y leads obtenidos
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
            Selecciona el rango de fechas para el análisis financiero con datos de Meta Ads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
            
            {/* Filtros rápidos de fecha */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtros Rápidos</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateFilter('hoy')}
                  data-testid="button-filter-today"
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateFilter('ayer')}
                  data-testid="button-filter-yesterday"
                >
                  Ayer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateFilter('7dias')}
                  data-testid="button-filter-7days"
                >
                  Últimos 7 días
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateFilter('14dias')}
                  data-testid="button-filter-14days"
                >
                  Últimos 14 días
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateFilter('30dias')}
                  data-testid="button-filter-30days"
                >
                  Último mes
                </Button>
              </div>
            </div>
            
            {/* Checkboxes para impuestos */}
            <div className="flex flex-wrap gap-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="incluir-iibb"
                  checked={incluirIIBB}
                  onCheckedChange={(checked) => setIncluirIIBB(checked as boolean)}
                  data-testid="checkbox-iibb"
                />
                <Label htmlFor="incluir-iibb" className="text-sm font-medium">
                  Incluir IIBB (4% sobre facturación)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="incluir-iva"
                  checked={incluirIVA}
                  onCheckedChange={(checked) => setIncluirIVA(checked as boolean)}
                  data-testid="checkbox-iva"
                />
                <Label htmlFor="incluir-iva" className="text-sm font-medium">
                  Incluir IVA (21% sobre facturación)
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen financiero */}
      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leads Meta Ads</p>
                  <p className="text-2xl font-bold" data-testid="text-leads-meta">
                    {data.summary.totalLeadsMetaAds.toLocaleString()}
                  </p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leads Reales BD</p>
                  <p className="text-2xl font-bold" data-testid="text-leads-reales">
                    {data.summary.totalLeadsReales.toLocaleString()}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Inversión Meta Ads</p>
                  <p className="text-2xl font-bold" data-testid="text-inversion-meta">
                    {formatCurrency(data.summary.totalInversionMetaAds)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Impuestos Meta Ads (2%)</p>
                  <p className="text-2xl font-bold" data-testid="text-impuestos-meta-ads">
                    {formatCurrency(data.summary.totalImpuestosMetaAds)}
                  </p>
                </div>
                <Calculator className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Inversión Total</p>
                  <p className="text-2xl font-bold" data-testid="text-inversion-total">
                    {formatCurrency(data.summary.totalInversionTotal)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Facturación Total</p>
                  <p className="text-2xl font-bold" data-testid="text-facturacion">
                    {formatCurrency(data.summary.totalFacturacion)}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ganancia Total</p>
                  <p className="text-2xl font-bold" data-testid="text-ganancia">
                    {formatCurrency(data.summary.totalGanancia)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ROI Promedio</p>
                  <p className="text-2xl font-bold" data-testid="text-roi">
                    {data.summary.roiPromedio.toFixed(1)}%
                  </p>
                </div>
                <Percent className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de resultados por marca */}
      {data?.data && (
        <Card>
          <CardHeader>
            <CardTitle>Análisis Financiero por Marca</CardTitle>
            <CardDescription>
              Rango: {data.dateRange.from} → {data.dateRange.to} | Datos de inversión real de Meta Ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="table-results">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">MARCA</th>
                    <th className="text-right p-3 font-medium">LEADS META ADS</th>
                    <th className="text-right p-3 font-medium">LEADS REALES</th>
                    <th className="text-right p-3 font-medium">CPL REAL</th>
                    <th className="text-right p-3 font-medium">INVERSIÓN META ADS</th>
                    <th className="text-right p-3 font-medium">MARGEN (2%)</th>
                    <th className="text-right p-3 font-medium">INVERSIÓN TOTAL</th>
                    <th className="text-right p-3 font-medium">FACTURACIÓN</th>
                    <th className="text-right p-3 font-medium">GANANCIA</th>
                    <th className="text-center p-3 font-medium">ROI</th>
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
                      <td className="p-3 text-right" data-testid={`text-leads-meta-${index}`}>
                        <div className="text-blue-600 font-medium">
                          {item.leadsMetaAds.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-3 text-right" data-testid={`text-leads-reales-${index}`}>
                        <div className="text-green-600 font-medium">
                          {item.leadsReales.toLocaleString()}
                        </div>
                        {item.diferenciALeads !== 0 && (
                          <div className="text-xs text-muted-foreground">
                            {item.diferenciALeads > 0 ? '+' : ''}{item.diferenciALeads} 
                            ({item.diferencPorcentajeLeads > 0 ? '+' : ''}{item.diferencPorcentajeLeads.toFixed(1)}%)
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-cpl-real-${index}`}>
                        <div>{formatCurrency(item.cplReal)}</div>
                        <div className="text-xs text-muted-foreground">
                          Meta: {formatCurrency(item.cplMetaAds)}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-inversion-meta-${index}`}>
                        {formatCurrency(item.inversionMetaAds)}
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-margen-${index}`}>
                        {formatCurrency(item.impuestosMetaAds)}
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-inversion-total-${index}`}>
                        {formatCurrency(item.inversionTotal)}
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-facturacion-${index}`}>
                        {formatCurrency(item.facturacionBruta)}
                      </td>
                      <td className="p-3 text-right font-mono" data-testid={`text-ganancia-${index}`}>
                        {formatCurrency(item.ganancia)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getTrendIcon(item.roi)}
                          <Badge variant={getBadgeVariant(item.roi)}>
                            {item.roi.toFixed(1)}%
                          </Badge>
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
              <p>Obteniendo datos de Meta Ads y calculando finanzas...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado de error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <p className="text-destructive font-medium">Error al obtener análisis financiero</p>
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
              <Calculator className="h-4 w-4" />
              Explicación del Análisis Financiero
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Inversión Meta Ads:</strong> Gasto real reportado por Meta Ads (puro, sin margen)</p>
              <p><strong>Impuestos Meta Ads:</strong> 2% del gasto Meta Ads para costos administrativos</p>
              <p><strong>Inversión Total:</strong> Inversión Meta Ads + Impuestos Meta Ads</p>
              <p><strong>Facturación:</strong> Valores reales de campañas comerciales registradas</p>
              <p><strong>Ganancia:</strong> Facturación - Inversión Total (fórmula simplificada)</p>
              <p><strong>ROI:</strong> (Ganancia / Inversión Total) × 100</p>
              <Separator className="my-2" />
              <p className="text-xs">
                Los datos de inversión provienen directamente de Meta Ads API. 
                Las tasas de conversión son configurables por marca.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}