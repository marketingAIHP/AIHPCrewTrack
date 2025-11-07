import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, MapPin, Clock } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { Employee } from '@shared/schema';

interface Site {
  id: number;
  name: string;
  address: string;
}

export default function ActiveEmployees() {
  const [profileImageModalOpen, setProfileImageModalOpen] = useState(false);
  const [selectedProfileImage, setSelectedProfileImage] = useState<{url: string, name: string} | null>(null);
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/admin/employees'],
    queryFn: async () => {
      const response = await fetch('/api/admin/employees', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch employees');
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

  const activeEmployees = employees?.filter((emp: Employee) => emp.isActive) || [];

  if (employeesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-6">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Active Employees</h1>
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
          <h1 className="text-2xl font-bold">Active Employees</h1>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {activeEmployees.length} Active
        </Badge>
      </div>

      <div className="grid gap-4">
        {activeEmployees.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No active employees found</p>
            </CardContent>
          </Card>
        ) : (
          activeEmployees.map((employee: Employee) => (
            <Card key={employee.id} className="hover:shadow-md transition-shadow border-2 border-slate-300 dark:border-slate-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      {employee.profileImage ? (
                        <img
                          src={employee.profileImage}
                          alt={`${employee.firstName} ${employee.lastName}`}
                          className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            setSelectedProfileImage({
                              url: employee.profileImage!,
                              name: `${employee.firstName} ${employee.lastName}`
                            });
                            setProfileImageModalOpen(true);
                          }}
                        />
                      ) : (
                        <span className="text-blue-600 font-semibold text-lg">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <Link href={`/admin/employees/${employee.id}/profile`}>
                        <h3 className="font-semibold text-lg hover:text-blue-600 cursor-pointer">
                          {employee.firstName} {employee.lastName}
                        </h3>
                      </Link>
                      <p className="text-gray-600">{employee.email}</p>
                      <p className="text-gray-500 text-sm">{employee.phone}</p>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <div className="flex items-center text-gray-600">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span className="text-sm">{getSiteName(employee.siteId || 0)}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      <span className="text-sm">
                        Joined {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                    <Badge 
                      variant="default" 
                      className="bg-green-100 text-green-800 hover:bg-green-200"
                    >
                      Active
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Profile Image Modal */}
      <Dialog open={profileImageModalOpen} onOpenChange={setProfileImageModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Profile Picture</DialogTitle>
            <DialogDescription>
              {selectedProfileImage?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedProfileImage && (
            <div className="flex justify-center p-4">
              <img
                src={selectedProfileImage.url}
                alt={selectedProfileImage.name}
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}