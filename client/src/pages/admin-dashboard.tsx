import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken, getUser, logout, getUserType } from '@/lib/auth';
import { 
  Users, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  UserCheck, 
  UserPlus, 
  Plus,
  FileText,
  Settings,
  Bell
} from 'lucide-react';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = getUser();
  const userType = getUserType();

  useEffect(() => {
    if (!getAuthToken() || userType !== 'admin') {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
    }
  }, []);

  const { data: stats = {
    activeEmployees: 0,
    workSites: 0,
    onSiteNow: 0,
    alerts: 0
  }, isLoading } = useQuery({
    queryKey: ['/api/admin/dashboard'],
    enabled: !!getAuthToken() && userType === 'admin',
  });

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.',
    });
    setLocation('/admin/login');
  };

  if (!user || userType !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/admin/dashboard">
              <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
                <div className="bg-primary rounded-lg w-10 h-10 flex items-center justify-center">
                  <Users className="text-white" />
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-semibold text-gray-900">WorkSite Tracker</h1>
                  <p className="text-sm text-gray-600">Admin Dashboard</p>
                </div>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/admin/notifications">
                <div className="relative cursor-pointer hover:opacity-80 transition-opacity">
                  <Bell className="h-6 w-6 text-gray-600" />
                  {stats.alerts > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {stats.alerts}
                    </span>
                  )}
                </div>
              </Link>
              
              <Link href="/admin/profile">
                <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {user?.firstName} {user?.lastName}
                  </span>
                </div>
              </Link>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/admin/active-employees">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-green-100 rounded-lg p-3">
                    <UserCheck className="text-green-600 text-xl" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Employees</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isLoading ? '...' : stats?.activeEmployees || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/admin/work-sites">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-blue-100 rounded-lg p-3">
                    <MapPin className="text-blue-600 text-xl" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Work Sites</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isLoading ? '...' : stats?.workSites || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/admin/on-site-now">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-orange-100 rounded-lg p-3">
                    <Clock className="text-orange-600 text-xl" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">On Site Now</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isLoading ? '...' : stats?.onSiteNow || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/admin/notifications">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-red-100 rounded-lg p-3">
                    <AlertTriangle className="text-red-600 text-xl" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Alerts</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isLoading ? '...' : stats?.alerts || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Activity & Live Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recent Activity */}
          <Card>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4">
                {stats?.onSiteNow > 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No recent activity to display</p>
                    <p className="text-sm">Activity will appear here when employees check in/out</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No recent activity</p>
                    <p className="text-sm">Add employees and work sites to start tracking</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Map Preview */}
          <Card>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Live Locations</h3>
                <Link href="/admin/tracking">
                  <Button variant="link" className="text-primary hover:text-blue-700 text-sm font-medium">
                    View Full Map
                  </Button>
                </Link>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="bg-white bg-opacity-90 rounded-lg p-4 text-center">
                  <MapPin className="text-primary text-2xl mb-2 mx-auto" />
                  <p className="text-sm font-medium text-gray-900">Interactive Map</p>
                  <p className="text-xs text-gray-600">
                    {stats?.onSiteNow || 0} employees currently tracked
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/admin/employees">
                <Button variant="outline" className="w-full flex items-center p-4 h-auto">
                  <UserPlus className="text-primary text-xl mr-3" />
                  <span className="font-medium text-gray-900">Add Employee</span>
                </Button>
              </Link>
              <Link href="/admin/sites">
                <Button variant="outline" className="w-full flex items-center p-4 h-auto">
                  <Plus className="text-primary text-xl mr-3" />
                  <span className="font-medium text-gray-900">Add Work Site</span>
                </Button>
              </Link>
              <Button variant="outline" className="w-full flex items-center p-4 h-auto">
                <FileText className="text-primary text-xl mr-3" />
                <span className="font-medium text-gray-900">Export Report</span>
              </Button>
              <Button variant="outline" className="w-full flex items-center p-4 h-auto">
                <Settings className="text-primary text-xl mr-3" />
                <span className="font-medium text-gray-900">Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
