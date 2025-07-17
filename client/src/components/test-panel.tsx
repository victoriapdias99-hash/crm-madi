import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
}

interface TestResponse {
  success: boolean;
  results: TestResult[];
  summary: TestSummary;
}

export default function TestPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    try {
      const response = await apiRequest<TestResponse>('/api/run-tests', 'POST', {});
      setResults(response.results);
      setSummary(response.summary);
      setLastRun(new Date());
    } catch (error) {
      console.error('Error running tests:', error);
      setResults([{
        name: 'Test Runner',
        passed: false,
        details: 'Error ejecutando las pruebas'
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (passed: boolean) => {
    return (
      <Badge variant={passed ? "default" : "destructive"} className="text-xs">
        {passed ? 'PASS' : 'FAIL'}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Analista Funcional - Pruebas Automáticas
          </div>
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Ejecutando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Ejecutar Pruebas
              </>
            )}
          </Button>
        </CardTitle>
        {lastRun && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Última ejecución: {lastRun.toLocaleTimeString('es-AR')}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {summary && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Resumen de Pruebas</h3>
              <Badge 
                variant={summary.failed === 0 ? "default" : "destructive"}
                className="text-sm"
              >
                {summary.passed}/{summary.total} exitosas
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-green-600 font-medium">{summary.passed} exitosas</div>
              </div>
              <div>
                <div className="text-red-600 font-medium">{summary.failed} fallidas</div>
              </div>
              <div>
                <div className="text-gray-600 font-medium">{summary.total} total</div>
              </div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium mb-3">Resultados Detallados</h3>
            {results.map((result, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.passed)}
                  <div>
                    <div className="font-medium">{result.name}</div>
                    {result.details && (
                      <div className="text-sm text-gray-500">{result.details}</div>
                    )}
                  </div>
                </div>
                {getStatusBadge(result.passed)}
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !isRunning && (
          <div className="text-center py-8 text-gray-500">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Haz clic en "Ejecutar Pruebas" para verificar el funcionamiento del sistema</p>
          </div>
        )}

        {isRunning && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Ejecutando pruebas funcionales...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}