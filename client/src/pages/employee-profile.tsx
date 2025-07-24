import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, User, MapPin, Clock, Calendar, Phone, Mail } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  siteId: number;
  adminId: number;
  createdAt: string;
}

interface Site {
  id: number;
  name: string;
  address: string;
}

interface AttendanceRecord {
  id: number;
  employeeId: number;
  checkIn: string;
  checkOut: string | null;
  date: string;
  hoursWorked: number | null;
}

interface LocationRecord {
  id: number;
  employeeId: number;
  latitude: string;
  longitude: string;
  timestamp: string;
  isWithinGeofence: boolean;
}

export default function EmployeeProfile() {
  const params = useParams();
  const employeeId = params.id;

  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: ['/api/admin/employees', employeeId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/employees/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch employee');
      return response.json();
    },
  });

  const { data: site } = useQuery({
    queryKey: ['/api/admin/sites', employee?.siteId],
    queryFn: async () => {
      if (!employee?.siteId) return null;
      const response = await fetch(`/api/admin/sites/${employee.siteId}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!employee?.siteId,
  });

  const { data: attendance } = useQuery({
    queryKey: ['/api/admin/employees', employeeId, 'attendance'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/employees/${employeeId}/attendance`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: locations } = useQuery({
    queryKey: ['/api/admin/employees', employeeId, 'locations'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/employees/${employeeId}/locations`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  if (employeeLoading || !employee) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link href="/admin/active-employees">
          <Button variant="ghost" size="sm" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Employees
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Employee Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold text-2xl">
                  {employee.firstName[0]}{employee.lastName[0]}
                </span>
              </div>
              <h3 className="text-xl font-semibold">{employee.firstName} {employee.lastName}</h3>
              <Badge 
                variant={employee.isActive ? "default" : "secondary"}
                className={employee.isActive ? "bg-green-100 text-green-800 mt-2" : "mt-2"}
              >
                {employee.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-3 text-gray-500" />
                <span className="text-sm">{employee.email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-3 text-gray-500" />
                <span className="text-sm">{employee.phone}</span>
              </div>
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-3 text-gray-500" />
                <span className="text-sm">{site?.name || 'No site assigned'}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-3 text-gray-500" />
                <span className="text-sm">
                  Joined {new Date(employee.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Information */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="locations">Location History</TabsTrigger>
                <TabsTrigger value="worksite">Work Site Info</TabsTrigger>
              </TabsList>

              <TabsContent value="attendance" className="mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Recent Attendance</h3>
                  {attendance && attendance.length > 0 ? (
                    <div className="space-y-3">
                      {attendance.slice(0, 10).map((record: AttendanceRecord) => (
                        <Card key={record.id} className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">
                                {new Date(record.date).toLocaleDateString()}
                              </p>
                              <div className="text-sm text-gray-600 flex items-center space-x-4">
                                <span>Check-in: {new Date(record.checkIn).toLocaleTimeString()}</span>
                                {record.checkOut && (
                                  <span>Check-out: {new Date(record.checkOut).toLocaleTimeString()}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {record.hoursWorked && (
                                <Badge variant="outline">
                                  {record.hoursWorked.toFixed(1)}h
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No attendance records found</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="locations" className="mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Recent Locations</h3>
                  {locations && locations.length > 0 ? (
                    <div className="space-y-3">
                      {locations.slice(0, 10).map((location: LocationRecord) => (
                        <Card key={location.id} className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">
                                {new Date(location.timestamp).toLocaleString()}
                              </p>
                              <p className="text-sm text-gray-600">
                                Lat: {parseFloat(location.latitude).toFixed(6)}, 
                                Lng: {parseFloat(location.longitude).toFixed(6)}
                              </p>
                            </div>
                            <Badge 
                              variant={location.isWithinGeofence ? "default" : "secondary"}
                              className={location.isWithinGeofence ? "bg-green-100 text-green-800" : ""}
                            >
                              {location.isWithinGeofence ? 'On Site' : 'Off Site'}
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No location records found</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="worksite" className="mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Assigned Work Site</h3>
                  {site ? (
                    <Card className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium">{site.name}</h4>
                          <p className="text-gray-600">{site.address}</p>
                        </div>
                        <div className="pt-3 border-t">
                          <Link href={`/admin/live-tracking?siteId=${site.id}`}>
                            <Button variant="outline" size="sm">
                              View on Live Tracking
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <p className="text-gray-500">No work site assigned</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}