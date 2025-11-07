import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '@/lib/auth';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { onMessage, onOpen, onClose, onError } = options;
  const [token, setToken] = useState<string | null>(getAuthToken());

  const connect = () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      console.log('⏳ WebSocket waiting for authentication token...');
      return;
    }

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
      console.log('✅ WebSocket connected:', wsUrl);
      setIsConnected(true);
      onOpen?.();
    };

    wsRef.current.onclose = (event) => {
      console.log(`❌ WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason || 'none'}`);
      setIsConnected(false);
      onClose?.();
    };

    wsRef.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      onError?.(error);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    // Check for token periodically until available (for login flow)
    const checkTokenAndConnect = () => {
      const currentToken = getAuthToken();
      if (currentToken && currentToken !== token) {
        console.log('🔑 Token detected, establishing WebSocket connection...');
        setToken(currentToken);
        connect();
      } else if (!currentToken && token) {
        // Token was removed (logout)
        console.log('🔓 Token removed, disconnecting WebSocket...');
        setToken(null);
        disconnect();
      }
    };

    // Try to connect immediately if token exists
    checkTokenAndConnect();

    // Check for token changes every 500ms for 5 seconds after mount
    const intervalId = setInterval(checkTokenAndConnect, 500);
    const timeoutId = setTimeout(() => clearInterval(intervalId), 5000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      disconnect();
    };
  }, [token]);

  return {
    isConnected,
    sendMessage,
    reconnect: connect,
    disconnect,
  };
}
