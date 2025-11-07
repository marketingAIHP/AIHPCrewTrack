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

    const currentToken = getAuthToken();
    if (!currentToken) {
      console.log('⏳ WebSocket waiting for authentication token...');
      return;
    }

    try {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Get backend URL from environment or use current host
      const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const protocol = backendUrl.startsWith('https') ? "wss:" : "ws:";
      const host = backendUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${protocol}//${host}/ws?token=${currentToken}`;
      
      console.log('🔌 Connecting WebSocket with token...');
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(true);
        onConnect?.();
        console.log('✅ WebSocket connected:', wsUrl);
      };

      wsRef.current.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        if (isUnmountedRef.current) return;
        setIsConnected(false);
        onDisconnect?.();
        console.log(`❌ WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason || 'none'}`);

        // Don't reconnect if it was a clean close or authentication failure
        if (event.code !== 1000 && event.code !== 1008) {
          console.log('🔄 Attempting to reconnect in 3 seconds...');
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, 3000);
        } else {
          console.log('⛔ Not reconnecting due to close code:', event.code);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
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