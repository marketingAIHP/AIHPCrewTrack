import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, MapPin, Clock, X } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { format, formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  type: 'out_of_range' | 'no_checkout';
  title: string;
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
  };
  timestamp: string;
  distance?: number;
  geofenceRadius?: number;
  hoursSinceCheckIn?: number;
}

interface AlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertsDialog({ open, onOpenChange }: AlertsDialogProps) {
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['/api/admin/alerts'],
    queryFn: async () => {
      const response = await fetch('/api/admin/alerts', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    enabled: open,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'out_of_range':
        return <MapPin className="h-5 w-5 text-orange-500" />;
      case 'no_checkout':
        return <Clock className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-purple-500" />;
    }
  };

  const getAlertBadgeColor = (type: string) => {
    switch (type) {
      case 'out_of_range':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'no_checkout':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-lg">
            <DialogHeader className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/30 backdrop-blur-sm rounded-lg p-4 -mx-4 -mt-4 mb-4 border-b-2 border-slate-300 dark:border-slate-600">
              <DialogTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-2">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                Alert History
              </DialogTitle>
              <DialogDescription className="text-purple-700 dark:text-purple-300">
                View and monitor all active alerts for your employees
              </DialogDescription>
            </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {isLoading ? (
                   <div className="space-y-4">
                     {[1, 2, 3].map((i) => (
                       <div key={i} className="p-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
                         <Skeleton className="h-4 w-3/4 mb-2 bg-slate-200 dark:bg-slate-700" />
                         <Skeleton className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700" />
                       </div>
                     ))}
                   </div>
                 ) : alerts.length === 0 ? (
                   <div className="text-center py-12 bg-slate-50 dark:bg-slate-700/50 backdrop-blur-sm rounded-lg border-2 border-slate-300 dark:border-slate-600">
                     <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-900/50 rounded-full flex items-center justify-center">
                       <AlertTriangle className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                     </div>
                     <p className="text-purple-900 dark:text-purple-100 text-lg font-semibold mb-2">No Active Alerts</p>
                     <p className="text-purple-700 dark:text-purple-300 text-sm">All employees are within range and properly checked in</p>
                   </div>
          ) : (
            <div className="space-y-4">
                     {alerts.map((alert) => (
                       <div
                         key={alert.id}
                         className="p-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                       >
                         <div className="flex items-start gap-3">
                           <div className="mt-1">{getAlertIcon(alert.type)}</div>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-2">
                               <h3 className="font-semibold text-gray-900 dark:text-slate-100">{alert.title}</h3>
                               <Badge className={getAlertBadgeColor(alert.type)} variant="outline">
                                 {alert.type === 'out_of_range' ? 'Out of Range' : 'No Checkout'}
                               </Badge>
                             </div>
                             <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">{alert.message}</p>
                             
                             <div className="grid grid-cols-2 gap-4 text-sm">
                               <div>
                                 <p className="text-gray-500 dark:text-slate-400 mb-1">Employee</p>
                                 <p className="font-medium text-gray-900 dark:text-slate-100">{alert.employee.name}</p>
                                 <p className="text-xs text-gray-500 dark:text-slate-400">{alert.employee.email}</p>
                               </div>
                               <div>
                                 <p className="text-gray-500 dark:text-slate-400 mb-1">Work Site</p>
                                 <p className="font-medium text-gray-900 dark:text-slate-100">{alert.site.name}</p>
                                 <p className="text-xs text-gray-500 dark:text-slate-400">{alert.site.address}</p>
                               </div>
                             </div>
                             
                             {alert.distance !== undefined && (
                               <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-sm border border-orange-200 dark:border-orange-800">
                                 <p className="text-orange-800 dark:text-orange-300">
                                   Distance: <span className="font-semibold">{alert.distance}m</span> from site center
                                   (Geofence radius: {alert.geofenceRadius}m)
                                 </p>
                               </div>
                             )}
                             
                             {alert.hoursSinceCheckIn !== undefined && (
                               <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm border border-red-200 dark:border-red-800">
                                 <p className="text-red-800 dark:text-red-300">
                                   Checked in <span className="font-semibold">{alert.hoursSinceCheckIn} hours</span> ago without checkout
                                 </p>
                               </div>
                             )}
                             
                             <div className="mt-3 text-xs text-gray-500 dark:text-slate-400">
                               {format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm')} 
                               {' • '}
                               {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                             </div>
                           </div>
                         </div>
                       </div>
                     ))}
            </div>
          )}
        </div>
        
               <div className="flex justify-end gap-2 pt-4 border-t-2 border-slate-300 dark:border-slate-600 mt-4 bg-slate-50 dark:bg-slate-700/50 backdrop-blur-sm rounded-lg p-4 -mx-4 -mb-4">
                 <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300">
                   Close
                 </Button>
               </div>
      </DialogContent>
    </Dialog>
  );
}

