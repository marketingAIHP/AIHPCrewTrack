import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Clock, User } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { Employee } from '@shared/schema';

interface Site {
  id: number;
  name: string;
  address: string;
}

interface LocationRecord {
  id: number;
  employeeId: number;
  latitude: string;
  longitude: string;
  timestamp: string;
  isWithinGeofence?: boolean;
  isOnSite?: boolean;
  distanceFromSite?: number | null;
  geofenceRadius?: number | null;
  employee: Employee;
}

export default function OnSiteNow() {
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ['/api/admin/locations'],
    queryFn: async () => {
      const response = await fetch('/api/admin/locations', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
    staleTime: 0, // Always refetch for real-time data
    gcTime: 0, // Don't cache the response
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: sites } = useQuery({
    queryKey: ['/api/admin/sites'],
    queryFn: async () => {
      const response = await fetch('/api/admin/sites', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch sites');
      return response.json();
    },
  });

  const getSiteName = (siteId: number) => {
    const site = sites?.find((s: Site) => s.id === siteId);
    return site?.name || 'Unknown Site';
  };

  // Filter for employees currently on site (within geofence)
  const onSiteEmployees = locations?.filter((item: any) => 
    (item.location?.isWithinGeofence ?? item.location?.isOnSite ?? false) && item.employee?.isActive
  ) || [];

  if (locationsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto p-6">
          <div className="flex items-center mb-6">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Employees On Site Now</h1>
          </div>
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Employees On Site Now</h1>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
            {onSiteEmployees.length} On Site
          </Badge>
        </div>

        <div className="grid gap-4">
          {onSiteEmployees.length === 0 ? (
            <Card className="border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
              <CardContent className="p-8 text-center">
                <MapPin className="h-12 w-12 text-gray-400 dark:text-slate-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-slate-400">No employees are currently on site</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                  Employees will appear here when they are within their work site geofence
                </p>
                <div className="mt-6">
                  <Link href="/admin/live-tracking">
                    <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                      View All on Live Map
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
        ) : (
          onSiteEmployees.map((item: any) => (
            <Card key={item.location?.id || item.employee.id} className="hover:shadow-md transition-shadow border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      {item.employee.profileImage ? (
                        <img
                          src={item.employee.profileImage}
                          alt={`${item.employee.firstName} ${item.employee.lastName}`}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-orange-600 dark:text-orange-400 font-semibold text-lg">
                          {item.employee.firstName[0]}{item.employee.lastName[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <Link href={`/admin/employees/${item.employee.id}/profile`}>
                        <h3 className="font-semibold text-lg hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-slate-900 dark:text-slate-100">
                          {item.employee.firstName} {item.employee.lastName}
                        </h3>
                      </Link>
                      <p className="text-gray-600 dark:text-slate-400">{item.employee.email}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-slate-400 mt-1">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>{getSiteName(item.employee.siteId)}</span>
                        </div>
                        {item.location && (
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>Last update: {new Date(item.location.timestamp).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50">
                      <User className="h-3 w-3 mr-1" />
                      On Site
                    </Badge>
                    {item.location && (
                      <div className="text-sm text-gray-500 dark:text-slate-400 space-y-1">
                        <div>Lat: {parseFloat(item.location.latitude).toFixed(4)}</div>
                        <div>Lng: {parseFloat(item.location.longitude).toFixed(4)}</div>
                        {typeof item.location.distanceFromSite === 'number' && (
                          <div>
                            Distance: {item.location.distanceFromSite}m
                            {typeof item.location.geofenceRadius === 'number' &&
                              item.location.distanceFromSite <= item.location.geofenceRadius
                              ? ' (Within Range)'
                              : ''}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-x-2">
                      <Link href={`/admin/live-tracking?employeeId=${item.employee.id}`}>
                        <Button variant="outline" size="sm" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700">
                          Track Live
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

        {onSiteEmployees.length > 0 && (
          <div className="mt-6 text-center">
            <Link href="/admin/live-tracking">
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                View All on Live Map
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}