import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Phone, Mail, MapPin, DollarSign, Calendar, MessageSquare, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: number;
  metaLeadId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  age: number | null;
  city: string | null;
  interest: string | null;
  budget: string | null;
  adName: string | null;
  adsetName: string | null;
  campaignName: string | null;
  status: string;
  source: string;
  cost: string | null;
  leadDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadNote {
  id: number;
  leadId: number;
  userId: number;
  note: string;
  type: string;
  createdAt: string;
}

export default function LeadDetails() {
  const params = useParams();
  const leadId = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [status, setStatus] = useState("");
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");

  // Fetch lead details
  const { data: lead, isLoading: leadLoading, error } = useQuery<Lead>({
    queryKey: ['/api/leads', leadId],
    queryFn: () => fetch(`/api/leads/${leadId}`).then(res => {
      if (!res.ok) throw new Error('Lead not found');
      return res.json();
    }),
    enabled: !!leadId
  });

  // Fetch lead notes
  const { data: notes = [] } = useQuery<LeadNote[]>({
    queryKey: ['/api/leads', leadId, 'notes'],
    queryFn: () => fetch(`/api/leads/${leadId}/notes`).then(res => res.json()),
    enabled: !!leadId
  });

  // Set initial status when lead loads
  React.useEffect(() => {
    if (lead && !status) {
      setStatus(lead.status);
    }
  }, [lead, status]);

  // Update lead status mutation
  const updateLeadMutation = useMutation({
    mutationFn: async (updates: { status: string }) => {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update lead');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lead actualizado",
        description: "El estado del lead se ha actualizado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads', leadId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el lead.",
        variant: "destructive",
      });
    }
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (noteData: { note: string; type: string; userId: number }) => {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });
      if (!response.ok) throw new Error('Failed to add note');
      return response.json();
    },
    onSuccess: () => {
      setNewNote("");
      toast({
        title: "Nota agregada",
        description: "La nota se ha guardado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads', leadId, 'notes'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo agregar la nota.",
        variant: "destructive",
      });
    }
  });

  const handleUpdateStatus = () => {
    if (status && status !== lead?.status) {
      updateLeadMutation.mutate({ status });
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      addNoteMutation.mutate({
        note: newNote.trim(),
        type: noteType,
        userId: 1 // Simple user ID for demo
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-purple-100 text-purple-800';
      case 'converted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (leadLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">Cargando lead...</div>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertDescription>
              No se pudo cargar la información del lead. Puede que no exista o haya ocurrido un error.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {lead.firstName} {lead.lastName}
              </h1>
              <p className="text-gray-600">Lead ID: {lead.id}</p>
            </div>
          </div>
          <Badge className={getStatusColor(lead.status)}>
            {lead.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Información de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{lead.email || "No disponible"}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{lead.phone || "No disponible"}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>{lead.city || "No disponible"}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>
                      {lead.age ? `${lead.age} años` : "Edad no disponible"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lead Details */}
            <Card>
              <CardHeader>
                <CardTitle>Detalles del Lead</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="font-medium">Interés</Label>
                  <p>{lead.interest || "No especificado"}</p>
                </div>
                <div>
                  <Label className="font-medium">Presupuesto</Label>
                  <p>{lead.budget || "No especificado"}</p>
                </div>
                <div>
                  <Label className="font-medium">Campaña</Label>
                  <p>{lead.campaignName || "No disponible"}</p>
                </div>
                <div>
                  <Label className="font-medium">Anuncio</Label>
                  <p>{lead.adName || "No disponible"}</p>
                </div>
                <div>
                  <Label className="font-medium">Conjunto de Anuncios</Label>
                  <p>{lead.adsetName || "No disponible"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Meta Information */}
            <Card>
              <CardHeader>
                <CardTitle>Información de Meta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-medium">ID Meta Lead</Label>
                    <p className="text-sm text-gray-600">{lead.metaLeadId || "No disponible"}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Fuente</Label>
                    <p>{lead.source}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <div>
                      <Label className="font-medium">Costo</Label>
                      <p>{lead.cost ? `$${lead.cost}` : "No disponible"}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="font-medium">Fecha del Lead</Label>
                    <p>
                      {lead.leadDate ? 
                        new Date(lead.leadDate).toLocaleDateString('es-ES') : 
                        new Date(lead.createdAt).toLocaleDateString('es-ES')
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Update Status */}
            <Card>
              <CardHeader>
                <CardTitle>Actualizar Estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select value={status || "new"} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nuevo</SelectItem>
                      <SelectItem value="contacted">Contactado</SelectItem>
                      <SelectItem value="qualified">Calificado</SelectItem>
                      <SelectItem value="converted">Convertido</SelectItem>
                      <SelectItem value="rejected">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={handleUpdateStatus}
                  disabled={updateLeadMutation.isPending || status === lead.status}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateLeadMutation.isPending ? "Actualizando..." : "Actualizar Estado"}
                </Button>
              </CardContent>
            </Card>

            {/* Add Note */}
            <Card>
              <CardHeader>
                <CardTitle>Agregar Nota</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddNote} className="space-y-4">
                  <div>
                    <Label htmlFor="noteType">Tipo de Nota</Label>
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="call">Llamada</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Reunión</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="note">Nota</Label>
                    <Textarea
                      id="note"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Escribe una nota sobre este lead..."
                      rows={3}
                    />
                  </div>
                  
                  <Button 
                    type="submit"
                    disabled={addNoteMutation.isPending || !newNote.trim()}
                    className="w-full"
                  >
                    {addNoteMutation.isPending ? "Guardando..." : "Agregar Nota"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Notes History */}
            <Card>
              <CardHeader>
                <CardTitle>Historial de Notas ({notes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay notas para este lead</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {notes.map(note => (
                      <div key={note.id} className="border-l-2 border-gray-200 pl-3">
                        <div className="flex items-center space-x-2 mb-1">
                          {getNoteTypeIcon(note.type)}
                          <span className="text-sm font-medium capitalize">{note.type}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(note.createdAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{note.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}