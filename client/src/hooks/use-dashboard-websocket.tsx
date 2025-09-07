import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface DashboardWebSocketHook {
  isConnected: boolean;
  connectionError: string | null;
  reconnectCount: number;
}

/**
 * Hook específico para WebSocket del dashboard
 * Escucha eventos de refresh y actualiza las queries automáticamente
 */
export function useDashboardWebSocket(): DashboardWebSocketHook {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();

  // Función para invalidar todas las queries del dashboard
  const refreshAllDashboardData = useCallback(() => {
    console.log('🔄 Refrescando todos los datos del dashboard tras evento WebSocket');
    
    // Invalidar queries principales del dashboard
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/finanzas'] });
    queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/stats'] });
    queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
    queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
    
    console.log('✅ Todas las queries del dashboard han sido invalidadas');
  }, [queryClient]);

  const connect = useCallback(() => {
    // Limpiar conexión previa si existe
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`🔗 Conectando WebSocket del dashboard: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔗 WebSocket conectado para escuchar eventos del dashboard');
        setIsConnected(true);
        setConnectionError(null);
        setReconnectCount(0);
        
        // Registrar para recibir eventos del dashboard
        ws.send(JSON.stringify({
          type: 'register_dashboard_listener'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Escuchar evento de refresh del dashboard
          if (data.type === 'dashboard_refresh') {
            console.log('📡 Evento dashboard_refresh recibido:', data);
            
            // Esperar un momento para que el backend termine de procesar
            setTimeout(() => {
              refreshAllDashboardData();
            }, 1000);
          }
          
          // Escuchar actualizaciones de campañas específicas
          if (data.type === 'campaign_update') {
            console.log('📡 Evento campaign_update recibido:', data);
            
            // Refresh específico para campañas
            setTimeout(() => {
              refreshAllDashboardData();
            }, 500);
          }
          
        } catch (error) {
          console.error('❌ Error parseando mensaje WebSocket:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔗 WebSocket del dashboard desconectado:', event.code, event.reason);
        setIsConnected(false);
        
        // Solo intentar reconectar si no fue un cierre intencional
        if (event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000); // Backoff exponencial, máximo 30s
          console.log(`🔄 Reintentando conexión WebSocket en ${delay}ms (intento ${reconnectCount + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Error en WebSocket del dashboard:', error);
        setConnectionError('Error de conexión WebSocket');
      };

    } catch (error) {
      console.error('❌ Error creando WebSocket:', error);
      setConnectionError('No se pudo crear la conexión WebSocket');
    }
  }, [reconnectCount, refreshAllDashboardData]);

  const disconnect = useCallback(() => {
    console.log('🔌 Desconectando WebSocket del dashboard...');
    
    // Limpiar timeout de reconexión
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Cerrar conexión WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, 'Desconexión intencional');
    }
    
    wsRef.current = null;
    setIsConnected(false);
    setConnectionError(null);
    setReconnectCount(0);
  }, []);

  // Efectos para gestión del ciclo de vida
  useEffect(() => {
    // Conectar al montar el componente
    connect();

    // Cleanup al desmontar
    return () => {
      disconnect();
    };
  }, []); // Sin dependencias para que solo se ejecute una vez

  // Reconectar cuando se regresa a la pestaña
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isConnected) {
        console.log('🔄 Pestaña activa y WebSocket desconectado - reconectando...');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isConnected, connect]);

  // Reconectar cuando regresa la conexión a internet
  useEffect(() => {
    const handleOnline = () => {
      if (!isConnected) {
        console.log('🌐 Conexión a internet restaurada - reconectando WebSocket...');
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isConnected, connect]);

  return {
    isConnected,
    connectionError,
    reconnectCount
  };
}