import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Clock, Play, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  timestamp: string;
  executionTime: number;
}

interface TestSuite {
  suiteName: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
}

interface TestResponse {
  success: boolean;
  results: TestSuite[];
}

export default function FunctionalAnalyst() {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  const runTestsMutation = useMutation({
    mutationFn: async (): Promise<TestResponse> => {
      setIsRunning(true);
      const response = await apiRequest('/api/functional-analyst/run-tests', 'POST');
      return response as TestResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/functional-analyst/results'] });
    },
    onSettled: () => {
      setIsRunning(false);
    }
  });

  const { data: testResults, isLoading } = useQuery({
    queryKey: ['/api/functional-analyst/results'],
    enabled: !isRunning
  });

  const getStatusIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600" />
    );
  };

  const getStatusBadge = (passed: boolean) => {
    return (
      <Badge variant={passed ? "default" : "destructive"}>
        {passed ? "PASS" : "FAIL"}
      </Badge>
    );
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Analista Funcional Automatizado
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              Sistema de pruebas automatizado para garantizar la integridad del CPL y prevenir errores críticos
            </p>
          </div>

          <div className="grid gap-6 mb-8">
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Control de Pruebas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-center">
                  <Button
                    onClick={() => runTestsMutation.mutate()}
                    disabled={isRunning}
                    className="flex items-center gap-2"
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Ejecutando Pruebas...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Ejecutar Pruebas CPL
                      </>
                    )}
                  </Button>
                  
                  {isRunning && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm text-gray-600">Analizando sistema...</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {testResults && (
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Resultados de Pruebas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{testResults.totalTests}</div>
                        <div className="text-sm text-gray-600">Total Pruebas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{testResults.passedTests}</div>
                        <div className="text-sm text-gray-600">Exitosas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{testResults.failedTests}</div>
                        <div className="text-sm text-gray-600">Fallidas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {formatExecutionTime(testResults.executionTime)}
                        </div>
                        <div className="text-sm text-gray-600">Tiempo Total</div>
                      </div>
                    </div>

                    <div className="w-full">
                      <Progress 
                        value={(testResults.passedTests / testResults.totalTests) * 100} 
                        className="h-3"
                      />
                      <div className="text-sm text-gray-600 mt-1">
                        Tasa de Éxito: {((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {testResults && testResults.results && testResults.results.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">
                    Detalle de Pruebas: {testResults.results[0].suiteName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {testResults.results[0].results.map((test, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(test.passed)}
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                {test.testName}
                              </h3>
                              <div className="text-sm text-gray-600 dark:text-gray-300">
                                {new Date(test.timestamp).toLocaleString('es-AR')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {formatExecutionTime(test.executionTime)}
                            </span>
                            {getStatusBadge(test.passed)}
                          </div>
                        </div>
                        <div className="ml-8">
                          <p className={`text-sm ${test.passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {test.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="shadow-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
            <CardHeader>
              <CardTitle className="text-xl">¿Qué Pruebas se Ejecutan?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-600">Integridad del CPL</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Verificación de mapeo cliente-campaña correcto</li>
                    <li>• Validación de que CPL se guarda en cliente correcto</li>
                    <li>• Comprobación de que no hay contaminación cruzada</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-purple-600">Datos y Cálculos</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Persistencia de datos después de recarga</li>
                    <li>• Verificación de datos RENAULT (39 enviados)</li>
                    <li>• Validación de cálculos de inversión</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}