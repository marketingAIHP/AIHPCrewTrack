import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken, getUserType } from '@/lib/auth';
import { 
  ArrowLeft,
  User, 
  MapPin, 
  Clock, 
  Navigation,
  Building2,
  Calendar,
  Phone,
  Mail,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  siteId: number | null;
  isActive: boolean;
  createdAt: string;
}

interface WorkSite {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
}

interface AttendanceRecord {
  id: number;
  checkInTime: string;
  checkOutTime: string | null;
  checkInLatitude: string;
  checkInLongitude: string;
  siteId: number;
}

interface LocationRecord {
  id: number;
  latitude: string;
  longitude: string;
  timestamp: string;
  isWithinGeofence: boolean;
}

export default function EmployeeProfile() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const employeeId = parseInt(params.id || '0');

  useEffect(() => {
    if (!getAuthToken() || getUserType() !== 'admin') {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
    }
  }, []);

  const { data: employee, isLoading: loadingEmployee } = useQuery<Employee>({
    queryKey: [`/api/admin/employees/${employeeId}`],
    enabled: !!getAuthToken() && getUserType() === 'admin' && !!employeeId,
  });

  const { data: sites = [] } = useQuery<WorkSite[]>({
    queryKey: ['/api/admin/sites'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: [`/api/admin/employees/${employeeId}/attendance`],
    enabled: !!getAuthToken() && getUserType() === 'admin' && !!employeeId,
  });

  const { data: locations = [] } = useQuery<LocationRecord[]>({
    queryKey: [`/api/admin/employees/${employeeId}/locations`],
    enabled: !!getAuthToken() && getUserType() === 'admin' && !!employeeId,
  });

  const assignedSite = employee?.siteId ? sites.find(site => site.id === employee.siteId) : null;
  const recentAttendance = attendance.slice(0, 5);
  const recentLocations = locations.slice(0, 10);

  if (!getAuthToken() || getUserType() !== 'admin') {
    return null;
  }

  if (loadingEmployee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert variant="destructive">
            <AlertDescription>Employee not found.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/admin/employees">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                {employee.firstName} {employee.lastName}
              </h1>
            </div>
            <div className="flex space-x-2">
              <Link href="/admin/tracking">
                <Button variant="outline">
                  <MapPin className="h-4 w-4 mr-2" />
                  Live Tracking
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Employee Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Employee Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-medium text-gray-700">
                    {employee.firstName[0]}{employee.lastName[0]}
                  </span>
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  {employee.firstName} {employee.lastName}
                </h3>
                <p className="text-sm text-gray-500">ID: EMP{employee.id.toString().padStart(3, '0')}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{employee.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{employee.phone}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Joined {new Date(employee.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Status</span>
                  <Badge 
                    variant={employee.isActive ? "default" : "secondary"}
                    className={employee.isActive ? "bg-green-500 text-white" : ""}
                  >
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Site Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Work Site Assignment</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignedSite ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900">{assignedSite.name}</h3>
                    <p className="text-sm text-gray-600 flex items-center mt-1">
                      <Navigation className="h-4 w-4 mr-1" />
                      {assignedSite.address}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700">Latitude</p>
                      <p className="text-gray-600">{assignedSite.latitude}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Longitude</p>
                      <p className="text-gray-600">{assignedSite.longitude}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Geofence Radius</span>
                    <Badge variant="outline">{assignedSite.geofenceRadius}m</Badge>
                  </div>
                  
                  <Link href={`/admin/tracking?siteId=${assignedSite.id}`}>
                    <Button className="w-full">
                      <MapPin className="w-4 h-4 mr-2" />
                      View on Map
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No site assigned</p>
                  <p className="text-sm text-gray-400">This employee is not assigned to any work site</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Recent Activity</span>
              </CardTitle>
              <CardDescription>Latest attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              {recentAttendance.length > 0 ? (
                <div className="space-y-3">
                  {recentAttendance.map((record) => (
                    <div key={record.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-900">
                          {new Date(record.checkInTime).toLocaleDateString()}
                        </p>
                        <p className="text-gray-600">
                          {new Date(record.checkInTime).toLocaleTimeString()} - 
                          {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : 'Active'}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {record.checkOutTime ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No recent activity</p>
                  <p className="text-sm text-gray-400">Attendance records will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Location History */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Navigation className="h-5 w-5" />
              <span>Recent Location History</span>
            </CardTitle>
            <CardDescription>Latest GPS location updates</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLocations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentLocations.map((location) => (
                      <tr key={location.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(location.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {parseFloat(location.latitude).toFixed(6)}, {parseFloat(location.longitude).toFixed(6)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant={location.isWithinGeofence ? "default" : "secondary"}
                            className={location.isWithinGeofence ? "bg-green-500 text-white" : "bg-yellow-500 text-white"}
                          >
                            {location.isWithinGeofence ? 'On Site' : 'Off Site'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Navigation className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No location history</p>
                <p className="text-sm text-gray-400">GPS tracking data will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}