import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bell, AlertCircle, CheckCircle, Clock, MapPin } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';

interface Notification {
  id: number;
  type: 'attendance' | 'geofence' | 'system' | 'alert';
  title: string;
  message: string;
  employeeName?: string;
  siteName?: string;
  timestamp: string;
  isRead: boolean;
}

// Mock notifications data for now - replace with real API call
const mockNotifications: Notification[] = [
  {
    id: 1,
    type: 'geofence',
    title: 'Employee Entered Work Site',
    message: 'John Doe has entered the Main Construction Site geofence',
    employeeName: 'John Doe',
    siteName: 'Main Construction Site',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    isRead: false,
  },
  {
    id: 2,
    type: 'attendance',
    title: 'Late Check-in Alert',
    message: 'Jane Smith checked in 30 minutes late to Downtown Office',
    employeeName: 'Jane Smith',
    siteName: 'Downtown Office',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isRead: false,
  },
  {
    id: 3,
    type: 'geofence',
    title: 'Employee Left Work Site',
    message: 'Mike Johnson has left the Warehouse District geofence',
    employeeName: 'Mike Johnson',
    siteName: 'Warehouse District',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    isRead: true,
  },
  {
    id: 4,
    type: 'system',
    title: 'New Employee Added',
    message: 'A new employee has been successfully added to the system',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
  },
  {
    id: 5,
    type: 'alert',
    title: 'Geofence Violation',
    message: 'Employee is outside designated work area during work hours',
    employeeName: 'Alex Brown',
    siteName: 'Industrial Park',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
  },
];

export default function Notifications() {
  // For now using mock data, replace with real API call
  const notifications = mockNotifications;

  const getIcon = (type: string) => {
    switch (type) {
      case 'geofence':
        return <MapPin className="h-5 w-5 text-blue-600" />;
      case 'attendance':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'alert':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'system':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hours ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center">
            <Bell className="h-6 w-6 mr-2" />
            Notifications
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unreadCount} unread
            </Badge>
          )}
          <Button variant="outline" size="sm">
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No notifications yet</p>
              <p className="text-sm text-gray-400 mt-1">
                You'll see updates about employee activity, geofence events, and system alerts here
              </p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`hover:shadow-md transition-shadow ${
                !notification.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h3>
                        <p className="text-gray-600 mt-1 text-sm">
                          {notification.message}
                        </p>
                        
                        {(notification.employeeName || notification.siteName) && (
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            {notification.employeeName && (
                              <span>Employee: {notification.employeeName}</span>
                            )}
                            {notification.siteName && (
                              <span>Site: {notification.siteName}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <span className="text-sm text-gray-500 whitespace-nowrap">
                          {getTimeAgo(notification.timestamp)}
                        </span>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="outline">
            Load More Notifications
          </Button>
        </div>
      )}
    </div>
  );
}