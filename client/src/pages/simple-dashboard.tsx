import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

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
      <h1 style={{ color: '#333', marginBottom: '10px' }}>Dashboard Meta Ads</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Estado: {isConnected ? '✅ Conectado' : '❌ Desconectado'}
      </p>
      
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