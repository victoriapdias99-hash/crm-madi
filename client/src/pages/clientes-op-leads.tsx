import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Users, Phone, Mail, MapPin, Building } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ClienteOpLead {
  cliente: string;
  marca: string;
  localizacion: string;
  total_leads: number;
  primera_fecha: string;
  ultima_fecha: string;
  emails_unicos: number;
  telefonos_unicos: number;
}

interface ClientesResponse {
  clientes: ClienteOpLead[];
  totalClientes: number;
  timestamp: string;
}

function ClienteCard({ cliente }: { cliente: ClienteOpLead }) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200" data-testid={`card-cliente-${cliente.cliente}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg" data-testid={`title-cliente-${cliente.cliente}`}>
            <Building className="h-5 w-5 text-blue-600" />
            {cliente.cliente}
          </CardTitle>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200" data-testid={`badge-marca-${cliente.cliente}`}>
            {cliente.marca}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1" data-testid={`location-${cliente.cliente}`}>
          <MapPin className="h-4 w-4" />
          {cliente.localizacion}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Estadísticas principales */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg" data-testid={`total-leads-${cliente.cliente}`}>
            <div className="text-2xl font-bold text-green-700">{cliente.total_leads}</div>
            <div className="text-sm text-green-600 flex items-center justify-center gap-1">
              <Users className="h-4 w-4" />
              Total Leads
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm" data-testid={`emails-unicos-${cliente.cliente}`}>
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4 text-blue-500" />
                Emails únicos
              </span>
              <span className="font-medium">{cliente.emails_unicos}</span>
            </div>
            <div className="flex items-center justify-between text-sm" data-testid={`telefonos-unicos-${cliente.cliente}`}>
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4 text-green-500" />
                Teléfonos únicos
              </span>
              <span className="font-medium">{cliente.telefonos_unicos}</span>
            </div>
          </div>
        </div>
        
        {/* Fechas */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between text-sm" data-testid={`primera-fecha-${cliente.cliente}`}>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              Primer lead
            </span>
            <span className="text-gray-600">{formatDate(cliente.primera_fecha)}</span>
          </div>
          <div className="flex items-center justify-between text-sm" data-testid={`ultima-fecha-${cliente.cliente}`}>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              Último lead
            </span>
            <span className="text-gray-600">{formatDate(cliente.ultima_fecha)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ClientesOpLeads() {
  const { data, isLoading, error } = useQuery<ClientesResponse>({
    queryKey: ['/api/op-leads/clientes'],
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Clientes en OP Leads</h1>
          <p className="text-gray-600">Listado de todos los clientes presentes en la base de datos de leads</p>
        </div>
        <ClientesSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="text-red-800">
              Error al cargar los clientes: {error instanceof Error ? error.message : 'Error desconocido'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientes = data?.clientes || [];
  const totalClientes = data?.totalClientes || 0;
  const totalLeads = clientes.reduce((sum: number, cliente: ClienteOpLead) => sum + cliente.total_leads, 0);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="title-clientes-op-leads">
          Clientes en OP Leads
        </h1>
        <p className="text-gray-600 mb-4">
          Listado de todos los clientes presentes en la base de datos de leads
        </p>
        
        {/* Estadísticas globales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700" data-testid="total-clientes-count">
                {totalClientes}
              </div>
              <div className="text-sm text-blue-600">Total Clientes</div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-700" data-testid="total-leads-count">
                {totalLeads.toLocaleString()}
              </div>
              <div className="text-sm text-green-600">Total Leads</div>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-700" data-testid="promedio-leads">
                {totalClientes > 0 ? Math.round(totalLeads / totalClientes) : 0}
              </div>
              <div className="text-sm text-purple-600">Promedio Leads/Cliente</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Grid de clientes */}
      {clientes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No se encontraron clientes en la base de datos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-clientes">
          {clientes.map((cliente: ClienteOpLead) => (
            <ClienteCard key={`${cliente.cliente}-${cliente.marca}-${cliente.localizacion}`} cliente={cliente} />
          ))}
        </div>
      )}

      {/* Footer con timestamp */}
      <div className="mt-8 text-center text-sm text-gray-500" data-testid="timestamp">
        Última actualización: {data?.timestamp ? format(new Date(data.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: es }) : 'No disponible'}
      </div>
    </div>
  );
}