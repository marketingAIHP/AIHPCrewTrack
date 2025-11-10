import { useEffect, useState, useRef } from 'react';
import { getAuthToken } from '@/lib/auth';

interface UseWebSocketProps {
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({ onMessage, onConnect, onDisconnect }: UseWebSocketProps = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const [token, setToken] = useState<string | null>(getAuthToken());

  const connect = () => {
    if (isUnmountedRef.current) return;

    try {
      const token = getAuthToken();
      if (!token) {
        console.error('❌ No auth token for WebSocket');
        setTimeout(() => {
          if (!isUnmountedRef.current) connect();
        }, 5000);
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      console.log('🔌 Connecting to WebSocket...');
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(true);
        onConnect?.();
        console.log('✅ WebSocket connected successfully');
      };

      wsRef.current.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data.type);
          onMessage?.(data);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        if (isUnmountedRef.current) return;
        setIsConnected(false);
        onDisconnect?.();
        console.log(`❌ WebSocket disconnected: Code=${event.code}, Reason=${event.reason || 'none'}`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            console.log('🔄 Attempting to reconnect...');
            connect();
          }
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
    }
  };

  useEffect(() => {
    // Check for token and connect
    const currentToken = getAuthToken();
    if (currentToken) {
      connect();
    }

    // Monitor for token changes (for login detection)
    const checkTokenInterval = setInterval(() => {
      const newToken = getAuthToken();
      if (newToken && newToken !== token) {
        console.log('🔑 Token detected, establishing WebSocket connection...');
        setToken(newToken);
        connect();
      } else if (!newToken && token) {
        console.log('🔓 Token removed, disconnecting WebSocket...');
        setToken(null);
        if (wsRef.current) {
          wsRef.current.close();
        }
      }
    }, 500);

    const timeoutId = setTimeout(() => clearInterval(checkTokenInterval), 5000);

    return () => {
      isUnmountedRef.current = true;
      clearInterval(checkTokenInterval);
      clearTimeout(timeoutId);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token]);

  const sendMessage = (data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  return {
    isConnected,
    sendMessage,
  };
}