import { useEffect, useState, useRef } from 'react';
import { getAuthToken } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Notification {
  type: 'employee_checkin' | 'employee_checkout';
  message: string;
  employee: {
    id: number;
    name: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
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

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

const DELETED_NOTIFICATIONS_KEY = 'deleted_notifications';
const NOTIFICATION_STORAGE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// Helper to generate a unique ID for a notification
function getNotificationId(notification: Notification): string {
  return `${notification.timestamp}-${notification.employee.id}-${notification.type}`;
}

// Helper to get deleted notification IDs from localStorage
function getDeletedNotificationIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DELETED_NOTIFICATIONS_KEY);
    if (!stored) return new Set();
    
    const data = JSON.parse(stored);
    const now = Date.now();
    
    // Filter out expired entries (older than 7 days)
    const validIds = data.filter((entry: { id: string; timestamp: number }) => {
      return now - entry.timestamp < NOTIFICATION_STORAGE_EXPIRY;
    });
    
    // Update localStorage with only valid entries
    if (validIds.length !== data.length) {
      localStorage.setItem(DELETED_NOTIFICATIONS_KEY, JSON.stringify(validIds));
    }
    
    return new Set(validIds.map((entry: { id: string }) => entry.id));
  } catch (error) {
    console.error('Error reading deleted notifications:', error);
    return new Set();
  }
}

// Helper to save a deleted notification ID to localStorage
function saveDeletedNotificationId(id: string): void {
  try {
    const stored = localStorage.getItem(DELETED_NOTIFICATIONS_KEY);
    let entries: { id: string; timestamp: number }[] = [];
    
    if (stored) {
      try {
        entries = JSON.parse(stored);
      } catch (e) {
        // If parsing fails, start fresh
        entries = [];
      }
    }
    
    // Check if this ID already exists, if not add it
    const exists = entries.some(entry => entry.id === id);
    if (!exists) {
      entries.push({ id, timestamp: Date.now() });
      localStorage.setItem(DELETED_NOTIFICATIONS_KEY, JSON.stringify(entries));
    }
  } catch (error) {
    console.error('Error saving deleted notification:', error);
  }
}

// Helper to filter out deleted notifications
function filterDeletedNotifications(notifications: Notification[]): Notification[] {
  const deletedIds = getDeletedNotificationIds();
  return notifications.filter(notification => {
    const id = getNotificationId(notification);
    return !deletedIds.has(id);
  });
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const isInitialLoad = useRef(true);

  // Load recent notifications from server on mount (only once per token)
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
          const recentNotifications: Notification[] = await response.json();
          // Filter out deleted notifications and only show check-in/check-out
          const filtered = filterDeletedNotifications(
            recentNotifications.filter(n => 
              n.type === 'employee_checkin' || n.type === 'employee_checkout'
            )
          );
          setNotifications(filtered);
        }
      } catch (error) {
        console.error('Error loading recent notifications:', error);
      }
    };

    // Only load on initial mount or when token changes
    if (isInitialLoad.current) {
      loadRecentNotifications();
      isInitialLoad.current = false;
    }
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

      setConnectionStatus('connecting');

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      
      console.log('🔌 Connecting notification WebSocket with token...');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnectionStatus('connected');
        console.log('✅ WebSocket connected to notification system:', wsUrl);
        // Clear any reconnect timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
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
        setConnectionStatus('disconnected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'notification') {
            const notification = message.data as Notification;
            console.log('Received notification:', notification);
            
            // Only process check-in/check-out notifications
            if (notification.type !== 'employee_checkin' && notification.type !== 'employee_checkout') {
              console.log('Skipping non-check-in/check-out notification:', notification.type);
              return;
            }
            
            // Check if this notification was deleted
            const notificationId = getNotificationId(notification);
            const deletedIds = getDeletedNotificationIds();
            if (deletedIds.has(notificationId)) {
              console.log('Skipping deleted notification:', notificationId);
              return;
            }
            
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
            // When connection is established, server may send recent notifications
            // We'll handle them in the notification handler above
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
        // Reset initial load flag when token changes so notifications reload
        isInitialLoad.current = true;
      } else if (!currentToken && token) {
        console.log('🔓 Token removed, will disconnect notifications...');
        setToken(null);
        setNotifications([]);
      }
    }, 500);

    const timeoutId = setTimeout(() => clearInterval(checkTokenInterval), 5000);

    return () => {
      clearInterval(checkTokenInterval);
      clearTimeout(timeoutId);
    };
  }, [token]);

  const clearNotifications = () => {
    // Mark all current notifications as deleted
    notifications.forEach(notification => {
      const id = getNotificationId(notification);
      saveDeletedNotificationId(id);
    });
    setNotifications([]);
  };

  const markAsRead = (index: number) => {
    setNotifications(prev => {
      const notification = prev[index];
      if (notification) {
        // Save deleted notification ID to localStorage
        const id = getNotificationId(notification);
        saveDeletedNotificationId(id);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  return {
    notifications,
    connectionStatus,
    clearNotifications,
    markAsRead
  };
}