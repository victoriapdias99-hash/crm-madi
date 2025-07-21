import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: number;
  playerId: number;
  message: string;
  sentAt: Date;
  playerName?: string;
  characterType?: string;
}

interface GameUpdate {
  type: string;
  progress?: any;
  playerId?: number;
  message?: any;
}

export function useWebSocket(roomId: number, playerId: number) {
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gameUpdates, setGameUpdates] = useState<GameUpdate[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    // Completely disable WebSocket for dashboard application
    console.log('WebSocket disabled for dashboard application');
    setIsConnected(false);
    return;

    ws.onopen = () => {
      setIsConnected(true);
      
      // Join the room
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId,
        playerId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'new_chat_message':
            setChatMessages(prev => [...prev, {
              ...data.message,
              sentAt: new Date(data.message.sentAt)
            }]);
            break;
            
          case 'game_update':
            setGameUpdates(prev => [...prev, data]);
            break;
            
          case 'player_joined':
          case 'player_left':
            setGameUpdates(prev => [...prev, data]);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Attempt to reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
  }, [roomId, playerId]);

  useEffect(() => {
    // No WebSocket connection needed for dashboard
    console.log('useWebSocket hook disabled for dashboard application');
    return () => {
      // No cleanup needed
    };
  }, [connect]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        content: message
      }));
    }
  }, []);

  const sendGameAction = useCallback((action: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_action',
        ...action
      }));
    }
  }, []);

  return {
    isConnected,
    chatMessages,
    gameUpdates,
    sendMessage,
    sendGameAction
  };
}
