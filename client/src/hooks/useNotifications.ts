import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Notification {
  type: 'employee_checkin' | 'employee_checkout';
  message: string;
  employee: {
    id: number;
    name: string;
    email: string;
  };
  site: {
    id: number;
    name: string;
    address: string;
  } | null;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(getAuthToken());

  // Load recent notifications from server on mount
  useEffect(() => {
    const loadRecentNotifications = async () => {
      try {
        const currentToken = getAuthToken();
        if (!currentToken) return;

        const response = await fetch('/api/admin/notifications/recent', {
          headers: {
            'Authorization': `Bearer ${currentToken}`
          }
        });
        
        if (response.ok) {
          const recentNotifications = await response.json();
          setNotifications(recentNotifications);
        }
      } catch (error) {
        console.error('Error loading recent notifications:', error);
      }
    };

    loadRecentNotifications();
  }, [token]); // Reload when token changes

  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      console.log('⏳ Notification WebSocket waiting for authentication token...');
      return;
    }

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      const token = getAuthToken();
      if (!token) {
        console.log('⏳ Cannot connect notification WebSocket: No token available');
        return;
      }

      // Get backend URL from environment or use current host
      const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const protocol = backendUrl.startsWith('https') ? "wss:" : "ws:";
      const host = backendUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${protocol}//${host}/ws?token=${token}`;
      
      console.log('🔌 Connecting notification WebSocket with token...');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        console.log('✅ WebSocket connected to notification system:', wsUrl);
        // Clear any reconnect timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        console.log(`❌ WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason || 'none'}, Clean: ${event.wasClean}`);
        
        // Don't reconnect if it was a clean close (code 1000) or authentication failure (code 1008)
        if (event.code !== 1000 && event.code !== 1008) {
          console.log('🔄 Attempting to reconnect in 3 seconds...');
          reconnectTimer = setTimeout(connect, 3000);
        } else {
          console.log('⛔ Not reconnecting due to close code:', event.code);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'notification') {
            const notification = message.data as Notification;
            console.log('Received notification:', notification);
            
            // Add to notifications list (keep last 5, avoid duplicates)
            setNotifications(prev => {
              // Check if this notification already exists (by timestamp and type)
              const isDuplicate = prev.some(n => 
                n.timestamp === notification.timestamp && 
                n.type === notification.type && 
                n.employee.id === notification.employee.id
              );
              
              if (isDuplicate) {
                console.log('Duplicate notification detected, skipping');
                return prev;
              }
              
              const newNotifications = [notification, ...prev];
              return newNotifications.slice(0, 5); // Keep only last 5
            });
            
            // Show toast notification
            toast({
              title: notification.type === 'employee_checkin' ? 'Employee Check-in' : 'Employee Check-out',
              description: notification.message,
              duration: 5000,
            });
          } else if (message.type === 'connection_established') {
            console.log(message.message);
          } else {
            console.log('Received unknown message type:', message.type, message);
          }
        } catch (error) {
          console.error('Error parsing notification:', error);
        }
      };
    };

    connect();

    // Check for token changes periodically (for logout detection)
    const checkTokenInterval = setInterval(() => {
      const newToken = getAuthToken();
      if (!newToken && currentToken) {
        console.log('🔓 Token removed, disconnecting notification WebSocket...');
        if (ws) {
          ws.close();
        }
        setToken(null);
      }
    }, 1000);

    return () => {
      clearInterval(checkTokenInterval);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [toast, token]); // Re-run when token changes

  // Monitor token changes
  useEffect(() => {
    const checkTokenInterval = setInterval(() => {
      const currentToken = getAuthToken();
      if (currentToken && currentToken !== token) {
        console.log('🔑 Token detected for notifications, will establish connection...');
        setToken(currentToken);
      } else if (!currentToken && token) {
        console.log('🔓 Token removed, will disconnect notifications...');
        setToken(null);
      }
    }, 500);

    const timeoutId = setTimeout(() => clearInterval(checkTokenInterval), 5000);

    return () => {
      clearInterval(checkTokenInterval);
      clearTimeout(timeoutId);
    };
  }, [token]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  const markAsRead = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  return {
    notifications,
    isConnected,
    clearNotifications,
    markAsRead
  };
}