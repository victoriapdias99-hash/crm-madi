import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";

interface CPLData {
  cliente: string;
  numeroCampana: string;
  cpl: number;
  enviados: number;
  pedidosTotal: number;
}

export default function CPLSimple() {
  const [cplValues, setCplValues] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: datosDiarios, isLoading } = useQuery({
    queryKey: ['/api/dashboard/datos-diarios'],
    refetchInterval: 30000,
    staleTime: 60000,
    retry: 2,
  });

  const updateCplMutation = useMutation({
    mutationFn: async ({ cliente, numeroCampana, cpl }: { 
      cliente: string;
      numeroCampana: string;
      cpl: number;
    }) => {
      const response = await apiRequest('/api/dashboard/update-cpl', 'POST', { 
        clienteNombre: cliente,
        numeroCampana,
        cpl
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
      toast({
        title: "CPL Actualizado",
        description: "El CPL se guardó correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar el CPL",
        variant: "destructive",
      });
    }
  });

  const handleCplChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCplValues(prev => ({ ...prev, [key]: numValue }));
  };

  const handleSaveCpl = (cliente: string, numeroCampana: string) => {
    const key = `${cliente}-${numeroCampana}`;
    const cpl = cplValues[key];
    
    if (cpl && cpl > 0) {
      updateCplMutation.mutate({ cliente, numeroCampana, cpl });
      setCplValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
    } else {
      toast({
        title: "Error",
        description: "Por favor ingrese un CPL válido",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Navigation />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              CPL Simplificado
            </h1>
            <p className="text-gray-600 text-lg">
              Sistema simple y directo para actualizar CPL por cliente y campaña
            </p>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Actualizar CPL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Campaña</TableHead>
                      <TableHead>Enviados</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>CPL Actual</TableHead>
                      <TableHead>Nuevo CPL</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datosDiarios?.map((data: any, index: number) => {
                      const key = `${data.cliente}-${data.numeroCampana}`;
                      const currentCpl = data.cpl || 0;
                      
                      return (
                        <TableRow key={key}>
                          <TableCell className="font-medium">
                            {data.cliente}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              #{data.numeroCampana}
                            </Badge>
                          </TableCell>
                          <TableCell>{data.enviados}</TableCell>
                          <TableCell>{data.pedidosTotal}</TableCell>
                          <TableCell>
                            {currentCpl > 0 ? (
                              <div className="text-green-600 font-semibold">
                                ARS ${currentCpl.toLocaleString('es-AR')}
                              </div>
                            ) : (
                              <div className="text-gray-400">Sin CPL</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              placeholder="Nuevo CPL"
                              value={cplValues[key] || ''}
                              onChange={(e) => handleCplChange(key, e.target.value)}
                              className="w-32"
                              min="0"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleSaveCpl(data.cliente, data.numeroCampana)}
                              disabled={!cplValues[key] || updateCplMutation.isPending}
                              className="flex items-center gap-1"
                            >
                              {updateCplMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              Guardar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}