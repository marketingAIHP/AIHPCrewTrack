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

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to notification system');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Disconnected from notification system');
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
          
          // Add to notifications list
          setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
          
          // Show toast notification
          toast({
            title: notification.type === 'employee_checkin' ? 'Employee Check-in' : 'Employee Check-out',
            description: notification.message,
            duration: 5000,
          });
        } else if (message.type === 'connection_established') {
          console.log(message.message);
        }
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    };

    return () => {
      ws.close();
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