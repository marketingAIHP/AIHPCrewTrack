import { useState } from 'react';
import { Bell, X, Clock, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationDropdown() {
  const { notifications, isConnected, clearNotifications, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'employee_checkin':
        return <User className="h-4 w-4 text-green-600" />;
      case 'employee_checkout':
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'employee_checkin':
        return 'bg-green-50 border-green-200';
      case 'employee_checkout':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {notifications.length > 9 ? '9+' : notifications.length}
            </Badge>
          )}
          {!isConnected && (
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {notifications.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? "Live" : "Offline"}
            </Badge>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No notifications</p>
            <p className="text-sm">Employee check-in/out alerts will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-80">
            <div className="p-2">
              {notifications.map((notification, index) => (
                <div
                  key={`${notification.timestamp}-${index}`}
                  className={`p-3 mb-2 rounded-lg border ${getNotificationColor(notification.type)} relative group hover:shadow-sm transition-shadow`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAsRead(index)}
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  
                  <div className="flex items-start gap-3 pr-6">
                    <div className="mt-1 flex items-center space-x-2">
                      <AuthenticatedImage
                        src={notification.employee.profileImage}
                        alt={`${notification.employee.firstName} ${notification.employee.lastName}`}
                        className="w-6 h-6 rounded-full object-cover"
                        fallback={
                          <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">
                              {notification.employee.firstName?.[0]}{notification.employee.lastName?.[0]}
                            </span>
                          </div>
                        }
                      />
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <User className="h-3 w-3" />
                        <span>{notification.employee.email}</span>
                      </div>
                      
                      {notification.site && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin className="h-3 w-3" />
                          <span>{notification.site.name}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(notification.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}