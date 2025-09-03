import { useEffect, useState } from 'react';
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
  Bell,
  Download,
  LogOut
} from 'lucide-react';
import ExportReportDialog from '@/components/ExportReportDialog';
import NotificationDropdown from '@/components/NotificationDropdown';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';



// Helper functions for date formatting
function formatDateLabel(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    const daysDiff = differenceInDays(new Date(), date);
    if (daysDiff < 7) {
      return format(date, 'EEEE'); // Day name (e.g., "Monday")
    } else {
      return format(date, 'MMM d'); // Short date (e.g., "Jan 15")
    }
  }
}

function formatActivityTime(date: Date): string {
  return format(date, 'h:mm a');
}

function groupActivitiesByDate(activities: any[]) {
  const grouped: { [key: string]: any[] } = {};
  
  activities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(activity);
  });
  
  return grouped;
}

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

  const { data: adminProfile } = useQuery({
    queryKey: ['/api/admin/profile'],
    queryFn: async () => {
      const response = await fetch('/api/admin/profile', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });

  const { data: recentActivities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/admin/recent-activities'],
    queryFn: async () => {
      const response = await fetch('/api/admin/recent-activities?days=7', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
  });

  const { data: stats = {
    activeEmployees: 0,
    workSites: 0,
    onSiteNow: 0,
    alerts: 0
  }, isLoading } = useQuery<{
    activeEmployees: number;
    workSites: number;
    onSiteNow: number;
    alerts: number;
  }>({
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 lg:py-6">
            <Link href="/admin/dashboard">
              <div className="flex items-center cursor-pointer hover:opacity-80 transition-all duration-300 hover:scale-105">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shadow-lg">
                  <Users className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="ml-3 sm:ml-4 hidden sm:block">
                  <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    WorkSite Tracker
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">Admin Dashboard</p>
                </div>
              </div>
            </Link>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <NotificationDropdown />
              
              <Link href="/admin/profile">
                <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer hover:opacity-80 transition-all duration-300 bg-gradient-to-r from-white/60 to-white/40 backdrop-blur-sm rounded-lg px-2 sm:px-4 py-1 sm:py-2 border border-white/20">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                    <AuthenticatedImage
                      src={adminProfile?.profileImage}
                      alt={`${user?.firstName} ${user?.lastName}`}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
                      fallback={
                        <span className="text-xs sm:text-sm font-bold text-white">
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </span>
                      }
                    />
                  </div>
                  <div className="hidden sm:block">
                    <span className="text-sm font-semibold text-gray-800 block">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="text-xs text-gray-600">Administrator</span>
                  </div>
                </div>
              </Link>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200 text-red-700 hover:from-red-100 hover:to-pink-100 hover:border-red-300 hover:text-red-800 font-medium shadow-sm transition-all duration-300 px-2 sm:px-3"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">


        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/admin/work-sites">
            <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-blue-50 border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Work Sites</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                      {isLoading ? '...' : stats?.workSites || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Active locations</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 shadow-lg">
                    <MapPin className="text-white w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/admin/on-site-now">
            <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-orange-50 border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">On Site Now</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent">
                      {isLoading ? '...' : stats?.onSiteNow || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Currently active</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 shadow-lg">
                    <Clock className="text-white w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/admin/employee-management">
            <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-green-50 border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Active Employees</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                      {isLoading ? '...' : stats?.activeEmployees || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Total workforce</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 shadow-lg">
                    <UserCheck className="text-white w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-purple-50 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Alerts</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                    {isLoading ? '...' : stats?.alerts || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Pending issues</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 shadow-lg">
                  <AlertTriangle className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6 sm:mb-8 bg-gradient-to-r from-white to-slate-50 border-0 shadow-lg">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Quick Actions</h3>
              <div className="w-8 sm:w-12 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <a href="/admin/employee-management" onClick={(e) => { e.preventDefault(); window.location.href = '/admin/employee-management'; }}>
                <Button variant="outline" className="w-full flex items-center p-3 sm:p-4 lg:p-6 h-auto bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:from-blue-100 hover:to-blue-200 hover:border-blue-300 transition-all duration-300 hover:scale-105 shadow-md">
                  <Users className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 text-sm sm:text-base">Employee Management</div>
                    <div className="text-xs text-gray-600">Manage workforce</div>
                  </div>
                </Button>
              </a>
              <Link href="/admin/sites">
                <Button variant="outline" className="w-full flex items-center p-6 h-auto bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:from-green-100 hover:to-green-200 hover:border-green-300 transition-all duration-300 hover:scale-105 shadow-md">
                  <Plus className="text-green-600 w-6 h-6 mr-3" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Add Work Site</div>
                    <div className="text-xs text-gray-600">Create locations</div>
                  </div>
                </Button>
              </Link>
              <ExportReportDialog>
                <Button variant="outline" className="w-full flex items-center p-6 h-auto bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:from-orange-100 hover:to-orange-200 hover:border-orange-300 transition-all duration-300 hover:scale-105 shadow-md">
                  <Download className="text-orange-600 w-6 h-6 mr-3" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Export Report</div>
                    <div className="text-xs text-gray-600">Download data</div>
                  </div>
                </Button>
              </ExportReportDialog>
              <Link href="/admin/profile">
                <Button variant="outline" className="w-full flex items-center p-6 h-auto bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 transition-all duration-300 hover:scale-105 shadow-md">
                  <Settings className="text-purple-600 w-6 h-6 mr-3" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Settings</div>
                    <div className="text-xs text-gray-600">Configure system</div>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
          {/* Recent Activity */}
          <Card className="bg-gradient-to-br from-white to-slate-50 border-0 shadow-lg">
            <div className="p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Recent Activity</h3>
            </div>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                {activitiesLoading ? (
                  <div className="text-center text-gray-500 py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-spin" />
                    <p>Loading recent activity...</p>
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No recent activity</p>
                    <p className="text-sm">Employee check-ins/check-outs will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-h-96 overflow-y-auto">
                    {Object.entries(groupActivitiesByDate(recentActivities)).map(([dateKey, dayActivities]) => {
                      const date = new Date(dateKey);
                      return (
                        <div key={dateKey} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-px bg-gray-200 flex-1" />
                            <span className="text-xs font-medium text-gray-500 px-2 bg-gray-50 rounded-full">
                              {formatDateLabel(date)}
                            </span>
                            <div className="h-px bg-gray-200 flex-1" />
                          </div>
                          
                          <div className="space-y-2">
                            {dayActivities.map((activity) => (
                              <div
                                key={activity.id}
                                className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-slate-100 rounded-lg border border-gray-200 hover:shadow-sm transition-all"
                              >
                                <AuthenticatedImage
                                  src={activity.employee.profileImage}
                                  alt={`${activity.employee.firstName} ${activity.employee.lastName}`}
                                  className="w-8 h-8 rounded-full object-cover"
                                  fallback={
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-bold text-white">
                                        {activity.employee.firstName?.[0]}{activity.employee.lastName?.[0]}
                                      </span>
                                    </div>
                                  }
                                />
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900">
                                      {activity.employee.firstName} {activity.employee.lastName}
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      activity.type === 'check-in' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {activity.type === 'check-in' ? 'Check In' : 'Check Out'}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <MapPin className="h-3 w-3" />
                                      <span>{activity.site.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <Clock className="h-3 w-3" />
                                      <span>{formatActivityTime(new Date(activity.timestamp))}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Locations */}
          <Card className="bg-gradient-to-br from-white to-slate-50 border-0 shadow-lg">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Live Locations</h3>
                <Link href="/admin/tracking">
                  <Button variant="link" className="text-blue-600 hover:text-blue-800 text-sm font-semibold">
                    View Full Map →
                  </Button>
                </Link>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="text-center text-gray-500 py-8">
                <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="font-medium text-gray-900 mb-2">Real-time Location Tracking</p>
                <p className="text-sm text-gray-600 mb-4">
                  Monitor employee locations and work site attendance
                </p>
                <div className="bg-gradient-to-r from-gray-50 to-slate-100 rounded-xl p-6 mb-4 border border-slate-200">
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div className="text-center">
                      <div className="bg-blue-100 rounded-lg p-3 inline-block mb-2">
                        <MapPin className="text-blue-600 w-5 h-5" />
                      </div>
                      <p className="font-semibold text-gray-700">Work Sites</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{stats?.workSites || 0}</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-green-100 rounded-lg p-3 inline-block mb-2">
                        <UserCheck className="text-green-600 w-5 h-5" />
                      </div>
                      <p className="font-semibold text-gray-700">Active Employees</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">{stats?.activeEmployees || 0}</p>
                    </div>
                  </div>
                </div>
                <Link href="/admin/tracking">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <MapPin className="w-5 h-5 mr-2" />
                    Open Live Tracking Map
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
