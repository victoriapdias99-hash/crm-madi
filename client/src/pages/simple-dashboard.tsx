import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";

interface DashboardStats {
  leadsCount: number;
  totalSpend: number;
  conversionRate: number;
  costPerLead: number;
}

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  interest: string | null;
  budget: string | null;
  status: string;
  cost: string | null;
  campaignName: string | null;
  leadDate: string | null;
  createdAt: string;
}

export default function SimpleDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    queryFn: () => fetch('/api/dashboard/stats').then(res => res.json())
  });

  // Fetch leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
    queryFn: () => fetch('/api/leads?limit=10').then(res => res.json())
  });

  // Fetch Google Sheets status
  const { data: sheetsStatus } = useQuery({
    queryKey: ['/api/sheets/status'],
    queryFn: () => fetch('/api/sheets/status').then(res => res.json())
  });

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: () => fetch('/api/sheets/sync', { method: 'POST' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    }
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
      socket.send(JSON.stringify({
        type: 'join_dashboard',
        userId: 1,
        dashboardId: 'main'
      }));
    };

    socket.onclose = () => setIsConnected(false);
    socket.onerror = () => setIsConnected(false);

    return () => socket.close();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <Navigation />
      <h1 style={{ color: '#333', marginBottom: '10px' }}>Dashboard Meta Ads</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <p style={{ color: '#666', margin: '0' }}>
          WebSocket: {isConnected ? '✅ Conectado' : '❌ Desconectado'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <p style={{ color: '#666', margin: '0' }}>
            Google Sheets: {sheetsStatus?.connected ? '✅ Conectado' : '❌ Desconectado'}
          </p>
          <button 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !sheetsStatus?.connected}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: syncMutation.isPending ? '#ccc' : '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: syncMutation.isPending ? 'not-allowed' : 'pointer'
            }}
          >
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Leads Hoy</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', color: '#007bff' }}>
            {statsLoading ? "..." : stats?.leadsCount || 0}
          </p>
        </div>
        
        <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Gasto Total</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', color: '#28a745' }}>
            ${statsLoading ? "..." : stats?.totalSpend?.toFixed(2) || "0.00"}
          </p>
        </div>
        
        <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Conversión</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', color: '#ffc107' }}>
            {statsLoading ? "..." : (stats?.conversionRate || 0).toFixed(1)}%
          </p>
        </div>
        
        <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Costo por Lead</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', color: '#dc3545' }}>
            ${statsLoading ? "..." : stats?.costPerLead?.toFixed(2) || "0.00"}
          </p>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', padding: '20px' }}>
        <h2 style={{ margin: '0 0 15px 0', color: '#333' }}>Leads Recientes</h2>
        {leadsLoading ? (
          <p>Cargando leads...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Nombre</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Email</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Ciudad</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Estado</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Costo</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>{lead.email}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>{lead.city}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '12px',
                        backgroundColor: lead.status === 'new' ? '#007bff' : lead.status === 'contacted' ? '#ffc107' : '#28a745',
                        color: 'white'
                      }}>
                        {lead.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>${lead.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}