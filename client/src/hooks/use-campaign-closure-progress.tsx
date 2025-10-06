import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CampaignProgressEvent {
  type: 'campaign-progress';
  campaignKey: string;
  progress: number;
  message: string;
  timestamp: Date;
}

interface CampaignErrorEvent {
  type: 'campaign-error';
  campaignKey: string;
  error: string;
  timestamp: Date;
}

interface CampaignClosureProgress {
  progress: number;
  message: string;
  isProcessing: boolean;
  hasError: boolean;
  error: string | null;
}

/**
 * Hook para monitorear el progreso de cierre de una campaña en tiempo real
 * Conecta por WebSocket y escucha eventos específicos de la campaña
 */
export function useCampaignClosureProgress(
  campaignKey?: string,
  options: {
    onComplete?: () => void;
    onError?: (error: string) => void;
    showToast?: boolean;
  } = {}
): CampaignClosureProgress {
  const { onComplete, onError, showToast = true } = options;

  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (!campaignKey) return;

    // Limpiar conexión previa si existe
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      console.log(`📡 Conectando WebSocket para monitorear campaña: ${campaignKey}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ WebSocket conectado para campaña: ${campaignKey}`);

        // Registrarse para recibir eventos de progreso de esta campaña
        ws.send(JSON.stringify({
          type: 'register_campaign_progress',
          campaignKey: campaignKey
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as CampaignProgressEvent | CampaignErrorEvent;

          // Evento de progreso
          if (data.type === 'campaign-progress' && data.campaignKey === campaignKey) {
            console.log(`📊 Progreso ${campaignKey}: ${data.progress}% - ${data.message}`);

            setProgress(data.progress);
            setMessage(data.message);
            setIsProcessing(data.progress < 100);
            setHasError(false);
            setError(null);

            // Cuando llegue al 100%, es que completó exitosamente
            if (data.progress === 100) {
              console.log(`✅ Campaña ${campaignKey} completada exitosamente`);

              if (showToast) {
                toast({
                  title: "✅ Campaña cerrada exitosamente",
                  description: data.message,
                  variant: "default",
                });
              }

              // Invalidar queries después de un momento para que el backend termine
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
              }, 1000);

              // Llamar callback de completado
              if (onComplete) {
                onComplete();
              }

              // Desconectar después de completar
              setTimeout(() => {
                ws.close();
              }, 2000);
            }
          }

          // Evento de error
          if (data.type === 'campaign-error' && data.campaignKey === campaignKey) {
            console.error(`❌ Error en campaña ${campaignKey}: ${data.error}`);

            setProgress(0);
            setMessage('');
            setIsProcessing(false);
            setHasError(true);
            setError(data.error);

            if (showToast) {
              toast({
                title: "❌ Error al cerrar campaña",
                description: data.error,
                variant: "destructive",
              });
            }

            // Llamar callback de error
            if (onError) {
              onError(data.error);
            }

            // Desconectar después de error
            setTimeout(() => {
              ws.close();
            }, 2000);
          }

        } catch (error) {
          console.error('❌ Error parseando mensaje WebSocket:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket desconectado para campaña ${campaignKey}`);

        // Si no fue un cierre intencional y aún está procesando, reintentar
        if (event.code !== 1000 && isProcessing) {
          console.log('🔄 Reintentando conexión en 2 segundos...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Error en WebSocket:', error);
      };

    } catch (error) {
      console.error('❌ Error creando WebSocket:', error);
    }
  }, [campaignKey, isProcessing, onComplete, onError, showToast, toast, queryClient]);

  // Conectar cuando hay un campaignKey
  useEffect(() => {
    if (campaignKey) {
      connect();
      setIsProcessing(true);
    }

    // Cleanup al desmontar o cuando cambia campaignKey
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Componente desmontado');
      }
    };
  }, [campaignKey, connect]);

  return {
    progress,
    message,
    isProcessing,
    hasError,
    error
  };
}
