import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Mail, Phone, MapPin, Calendar, User, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useState } from "react";

interface SentLead {
  id: number;
  metaLeadId: string;
  nombre: string;
  telefono: string;
  email: string | null;
  ciudad: string | null;
  modelo: string | null;
  marca: string;
  campaign: string;
  origen: string | null;
  localizacion: string | null;
  cliente: string | null;
  fechaCreacion: string;
  sentAt: string;
}

interface SentLeadsResponse {
  campaignId: number;
  campaignName: string | null;
  clientName: string | null;
  marca: string | null;
  marca2: string | null;
  marca3: string | null;
  marca4: string | null;
  marca5: string | null;
  zona: string | null;
  totalSent: number;
  leads: SentLead[];
}

interface CampaignData {
  campaignId?: number;
  clienteNombre?: string;
  numeroCampana?: number;
  marca?: string;
  zona?: string;
}

interface SentLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignData: CampaignData | null;
}

export function SentLeadsModal({ isOpen, onClose, campaignData }: SentLeadsModalProps) {
  const { data, isLoading, error } = useQuery<SentLeadsResponse>({
    queryKey: [`/api/leads/sent-by-campaign/${campaignData?.campaignId}`],
    enabled: isOpen && !!campaignData?.campaignId,
    staleTime: 0,
  });

  const [activeTab, setActiveTab] = useState<string>("all");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Detectar si es multimarca y obtener lista de marcas
  const campaignBrands = useMemo(() => {
    if (!data) return [];
    const brands: string[] = [];
    if (data.marca) brands.push(data.marca);
    if (data.marca2) brands.push(data.marca2);
    if (data.marca3) brands.push(data.marca3);
    if (data.marca4) brands.push(data.marca4);
    if (data.marca5) brands.push(data.marca5);
    return brands;
  }, [data]);

  const isMultiBrand = campaignBrands.length > 1;

  // Agrupar leads por marca (case-insensitive para coincidir con campaignBrands)
  const leadsByBrand = useMemo(() => {
    if (!data || !data.leads) return {};

    const grouped: Record<string, SentLead[]> = {};

    data.leads.forEach(lead => {
      const leadBrand = lead.marca || 'Sin marca';

      // Buscar la marca correspondiente en campaignBrands (case-insensitive)
      const matchingBrand = campaignBrands.find(
        brand => brand.toLowerCase() === leadBrand.toLowerCase()
      );

      // Usar la marca de la campaña (capitalizada correctamente) como key
      const brandKey = matchingBrand || leadBrand;

      if (!grouped[brandKey]) {
        grouped[brandKey] = [];
      }
      grouped[brandKey].push(lead);
    });

    return grouped;
  }, [data, campaignBrands]);

  // Componente para renderizar lista de leads
  const renderLeadsList = (leads: SentLead[]) => (
    <div className="grid gap-3">
      {leads.map((lead, index) => (
        <div
          key={lead.id}
          className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                #{index + 1}
              </span>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                {lead.nombre}
              </h3>
            </div>
            <Badge variant="outline" className="text-xs">
              {lead.marca}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {lead.telefono && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4 text-blue-500" />
                <span>{lead.telefono}</span>
              </div>
            )}

            {lead.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4 text-purple-500" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}

            {lead.ciudad && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4 text-red-500" />
                <span>{lead.ciudad}</span>
              </div>
            )}

            {lead.modelo && (
              <div className="flex items-center gap-2 text-slate-600">
                <Tag className="h-4 w-4 text-orange-500" />
                <span>{lead.modelo}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-xs">Creado: {formatDate(lead.fechaCreacion)}</span>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-xs">Enviado: {formatDate(lead.sentAt)}</span>
            </div>
          </div>

          {(lead.origen || lead.localizacion || lead.campaign) && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
              {lead.origen && (
                <Badge variant="secondary" className="text-xs">
                  Origen: {lead.origen}
                </Badge>
              )}
              {lead.localizacion && (
                <Badge variant="secondary" className="text-xs">
                  Loc: {lead.localizacion}
                </Badge>
              )}
              {lead.campaign && (
                <Badge variant="outline" className="text-xs">
                  {lead.campaign}
                </Badge>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-2xl font-bold text-slate-800">
            Leads Enviados
          </DialogTitle>
          {campaignData && data && (
            <p className="text-sm text-slate-600 mt-2">
              {campaignData.clienteNombre} - Campaña #{campaignData.numeroCampana} - {isMultiBrand ? 'Multimarca' : `Marca: ${data.marca}`} - {data.totalSent} leads enviados
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-slate-600">Cargando leads...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600">Error al cargar los leads</p>
              <p className="text-sm text-slate-500 mt-2">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </div>
          )}

          {data && data.leads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">No hay leads enviados para esta campaña</p>
            </div>
          )}

          {data && data.leads.length > 0 && (
            <>
              {isMultiBrand ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full mb-4" style={{ gridTemplateColumns: `repeat(${campaignBrands.length + 1}, minmax(0, 1fr))` }}>
                    <TabsTrigger value="all" className="text-sm">
                      Todos ({data.leads.length})
                    </TabsTrigger>
                    {campaignBrands.map(brand => (
                      <TabsTrigger key={brand} value={brand} className="text-sm">
                        {brand} ({leadsByBrand[brand]?.length || 0})
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="all" className="mt-0">
                    {renderLeadsList(data.leads)}
                  </TabsContent>

                  {campaignBrands.map(brand => (
                    <TabsContent key={brand} value={brand} className="mt-0">
                      {leadsByBrand[brand] && leadsByBrand[brand].length > 0 ? (
                        renderLeadsList(leadsByBrand[brand])
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-slate-500">No hay leads de {brand}</p>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                renderLeadsList(data.leads)
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
