import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, User, Mail, Calendar, Settings, Shield } from 'lucide-react';
import { getAuthToken, getUser } from '@/lib/auth';

interface Admin {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

export default function AdminProfile() {
  const currentUser = getUser();

  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ['/api/admin/profile'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/profile`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch admin profile');
      return response.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/admin/dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  if (adminLoading || !admin) {
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
        <Link href="/admin/dashboard">
          <Button variant="ghost" size="sm" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Admin Profile</h1>
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
                  {admin.firstName[0]}{admin.lastName[0]}
                </span>
              </div>
              <h3 className="text-xl font-semibold">{admin.firstName} {admin.lastName}</h3>
              <Badge className="bg-blue-100 text-blue-800 mt-2">
                <Shield className="h-3 w-3 mr-1" />
                Administrator
              </Badge>
            </div>
            
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-3 text-gray-500" />
                <span className="text-sm">{admin.email}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-3 text-gray-500" />
                <span className="text-sm">
                  Admin since {new Date(admin.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Statistics */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">System Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {stats?.activeEmployees || 0}
                        </div>
                        <div className="text-sm text-gray-600">Active Employees</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {stats?.workSites || 0}
                        </div>
                        <div className="text-sm text-gray-600">Work Sites</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {stats?.onSiteNow || 0}
                        </div>
                        <div className="text-sm text-gray-600">On Site Now</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {stats?.alerts || 0}
                        </div>
                        <div className="text-sm text-gray-600">Active Alerts</div>
                      </div>
                    </Card>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Link href="/admin/employees">
                        <Button variant="outline" className="w-full justify-start">
                          Manage Employees
                        </Button>
                      </Link>
                      <Link href="/admin/sites">
                        <Button variant="outline" className="w-full justify-start">
                          Manage Sites
                        </Button>
                      </Link>
                      <Link href="/admin/live-tracking">
                        <Button variant="outline" className="w-full justify-start">
                          Live Tracking
                        </Button>
                      </Link>
                      <Link href="/admin/active-employees">
                        <Button variant="outline" className="w-full justify-start">
                          View Employees
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Account Settings
                  </h3>
                  <div className="space-y-3">
                    <Card className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Account Information</h4>
                          <p className="text-sm text-gray-600">Update your profile details</p>
                        </div>
                        <Button variant="outline" size="sm">
                          Edit Profile
                        </Button>
                      </div>
                    </Card>
                    
                    <Card className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Security Settings</h4>
                          <p className="text-sm text-gray-600">Change password and security preferences</p>
                        </div>
                        <Button variant="outline" size="sm">
                          Security
                        </Button>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Notification Preferences</h4>
                          <p className="text-sm text-gray-600">Manage alerts and notifications</p>
                        </div>
                        <Button variant="outline" size="sm">
                          Configure
                        </Button>
                      </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}