import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Clock, User } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  siteId: number;
  isActive: boolean;
}

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
  isWithinGeofence: boolean;
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
  const onSiteEmployees = locations?.filter((location: LocationRecord) => 
    location.isWithinGeofence && location.employee.isActive
  ) || [];

  if (locationsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-6">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Employees On Site Now</h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold">Employees On Site Now</h1>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1 bg-orange-100 text-orange-800">
          {onSiteEmployees.length} On Site
        </Badge>
      </div>

      <div className="grid gap-4">
        {onSiteEmployees.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No employees are currently on site</p>
              <p className="text-sm text-gray-400 mt-1">
                Employees will appear here when they are within their work site geofence
              </p>
            </CardContent>
          </Card>
        ) : (
          onSiteEmployees.map((location: LocationRecord) => (
            <Card key={location.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-semibold text-lg">
                        {location.employee.firstName[0]}{location.employee.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <Link href={`/admin/employees/${location.employee.id}/profile`}>
                        <h3 className="font-semibold text-lg hover:text-blue-600 cursor-pointer">
                          {location.employee.firstName} {location.employee.lastName}
                        </h3>
                      </Link>
                      <p className="text-gray-600">{location.employee.email}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>{getSiteName(location.employee.siteId)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>Last update: {new Date(location.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                      <User className="h-3 w-3 mr-1" />
                      On Site
                    </Badge>
                    <div className="text-sm text-gray-500">
                      <div>Lat: {parseFloat(location.latitude).toFixed(4)}</div>
                      <div>Lng: {parseFloat(location.longitude).toFixed(4)}</div>
                    </div>
                    <div className="space-x-2">
                      <Link href={`/admin/live-tracking?employeeId=${location.employee.id}`}>
                        <Button variant="outline" size="sm">
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

      <div className="mt-6 text-center">
        <Link href="/admin/live-tracking">
          <Button>
            View All on Live Map
          </Button>
        </Link>
      </div>
    </div>
  );
}