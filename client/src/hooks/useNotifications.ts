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

  // Load recent notifications from server on mount
  useEffect(() => {
    const loadRecentNotifications = async () => {
      try {
        const token = getAuthToken();
        if (!token) return;

        const response = await fetch('/api/admin/notifications/recent', {
          headers: {
            'Authorization': `Bearer ${token}`
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
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to notification system');
        // Clear any reconnect timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from notification system');
        // Attempt to reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
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

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [toast]);

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