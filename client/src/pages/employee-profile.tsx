import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken, getUserType } from '@/lib/auth';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Calendar,
  Phone,
  Mail,
  Building,
  User
} from 'lucide-react';

export default function EmployeeProfile() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!getAuthToken() || getUserType() !== 'admin') {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
      return;
    }
  }, [toast, setLocation]);

  const { data: employee, isLoading } = useQuery({
    queryKey: [`/api/admin/employees/${id}`],
    enabled: !!getAuthToken() && getUserType() === 'admin' && !!id,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: [`/api/admin/employees/${id}/attendance`],
    enabled: !!getAuthToken() && getUserType() === 'admin' && !!id,
  });

  const { data: locations = [] } = useQuery({
    queryKey: [`/api/admin/employees/${id}/locations`],
    enabled: !!getAuthToken() && getUserType() === 'admin' && !!id,
  });

  if (!getAuthToken() || getUserType() !== 'admin') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading employee profile...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Employee Not Found</h2>
          <p className="text-gray-600 mb-4">The employee you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation('/admin/employees')}>
            Back to Employees
          </Button>
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
              <Button 
                variant="ghost" 
                size="sm" 
                className="mr-4"
                onClick={() => setLocation('/admin/employees')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Employee Profile: {employee.firstName} {employee.lastName}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Employee Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-lg font-medium text-blue-600">
                      {employee.firstName[0]}{employee.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{employee.firstName} {employee.lastName}</CardTitle>
                    <p className="text-sm text-gray-600">Employee ID: {employee.id}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{employee.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{employee.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {employee.siteId ? `Site ID: ${employee.siteId}` : 'No site assigned'}
                  </span>
                </div>
                <div className="pt-2">
                  <Badge variant={employee.siteId ? 'default' : 'secondary'}>
                    {employee.siteId ? 'Site Assigned' : 'Unassigned'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Overview */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
                  <Calendar className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{attendance.length}</div>
                  <p className="text-xs text-gray-600">attendance records</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Location Updates</CardTitle>
                  <MapPin className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{locations.length}</div>
                  <p className="text-xs text-gray-600">location updates</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Attendance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Recent Attendance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {attendance.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-gray-600">No attendance records found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attendance.slice(0, 10).map((record: any) => (
                      <div key={record.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(record.checkInTime).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-600">
                            Check-in: {new Date(record.checkInTime).toLocaleTimeString()}
                            {record.checkOutTime && (
                              <> • Check-out: {new Date(record.checkOutTime).toLocaleTimeString()}</>
                            )}
                          </p>
                        </div>
                        <Badge variant={record.checkOutTime ? 'default' : 'secondary'}>
                          {record.checkOutTime ? 'Completed' : 'Active'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}