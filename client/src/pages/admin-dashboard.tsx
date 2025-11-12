import { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken, getUser, logout, getUserType } from '@/lib/auth';
import { loadGoogleMapsAPI } from '@/lib/google-maps';
import GoogleMap from '@/components/google-map';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { 
  Users, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  UserCheck, 
  Plus,
  Settings,
  Download,
  LogOut,
  RefreshCw,
  Trash2
} from 'lucide-react';
import ExportReportDialog from '@/components/ExportReportDialog';
import NotificationDropdown from '@/components/NotificationDropdown';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { AlertsDialog } from '@/components/AlertsDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
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
  const queryClient = useQueryClient();
  const user = getUser();
  const userType = getUserType();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 28.44065, lng: 77.08154 });
  const [mapZoom] = useState(12);
  const initializeCalledRef = useRef(false);
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);


  useEffect(() => {
    if (!getAuthToken() || userType !== 'admin') {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
      return;
    }

    if (initializeCalledRef.current) return;
    initializeCalledRef.current = true;

    loadGoogleMapsAPI()
      .then(() => setMapLoaded(true))
      .catch(() => setMapLoaded(false));
  }, []);


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

  const { data: locations = [], isLoading: isLocationsLoading } = useQuery({
    queryKey: ['/api/admin/locations'],
    enabled: !!getAuthToken() && userType === 'admin',
    refetchInterval: 60000,
  });

  const { data: sites = [], isLoading: isSitesLoading } = useQuery({
    queryKey: ['/api/admin/sites'],
    enabled: !!getAuthToken() && userType === 'admin',
  });

  useWebSocket({});

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

  const handleRefresh = () => {
    // Invalidate all queries to refresh all data
    queryClient.invalidateQueries({ queryKey: ['/api/admin/recent-activities'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/locations'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/sites'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/profile'] });
    toast({
      title: 'Refreshed',
      description: 'All data updated successfully',
    });
  };

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const response = await fetch(`/api/admin/activities/${activityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete activity');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/recent-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      toast({
        title: 'Activity Deleted',
        description: 'The activity has been successfully deleted.',
      });
      setDeleteActivityId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete activity. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteActivity = (activityId: string) => {
    setDeleteActivityId(activityId);
  };

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

  // Styled metric card with colored gradient icon container
  function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconBgColor,
    iconColor,
    cardBg,
    href,
    onClick,
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBgColor: string;
    iconColor: string;
    cardBg: string;
    href?: string;
    onClick?: () => void;
  }) {
    const CardInner = (
      <div className={`${cardBg} rounded-xl group transition-all duration-200 cursor-pointer`} onClick={onClick}>
        <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border-2 border-slate-300 dark:border-slate-600 rounded-xl shadow-sm group-hover:shadow-lg group-hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">{value}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
              </div>
              <div className={`${iconBgColor} rounded-2xl p-4 flex items-center justify-center`}>
                <Icon className={`h-6 w-6 ${iconColor}`} />
              </div>
            </div>
          </div>
        </Card>
      </div>
    );

    if (href) {
      return (
        <Link href={href} className="block" onClick={onClick}>
          {CardInner}
        </Link>
      );
    }
    return CardInner;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-4 flex items-center justify-between">
          {/* Clickable Logo and Text - Navigates to Dashboard */}
          <Link href="/admin/dashboard">
            <div className="flex items-center gap-1.5 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="bg-black rounded-lg sm:rounded-xl p-1.5 sm:p-3 shadow-sm">
                <img 
                  src="/logo-192.png" 
                  alt="AIHP CrewTrack" 
                  className="h-8 w-8 sm:h-12 sm:w-12 md:h-14 md:w-14 object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg md:text-2xl font-bold truncate">
                  <span className="text-black dark:text-white">A</span><span className="text-red-600">I</span><span className="text-black dark:text-white">HP</span> <span className="text-black dark:text-white">CrewTrack</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 hidden sm:block">Admin Dashboard</p>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
            <div className="scale-90 sm:scale-100">
              <NotificationDropdown />
            </div>
            <div className="scale-90 sm:scale-100">
              <ThemeToggle />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Link href="/admin/profile">
              <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-1.5 sm:px-3 py-1 sm:py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-full overflow-hidden">
                  <AuthenticatedImage
                    src={adminProfile?.profileImage}
                    alt="Admin Avatar"
                    className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 object-cover"
                    fallback={
                      <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 bg-blue-600 text-white text-xs sm:text-sm flex items-center justify-center rounded-full font-bold">
                        {adminProfile?.firstName?.[0] || ''}{adminProfile?.lastName?.[0] || ''}
                      </div>
                    }
                  />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {adminProfile?.firstName && adminProfile?.lastName
                      ? `${adminProfile.firstName} ${adminProfile.lastName}`
                      : 'Administrator'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Administrator</p>
                </div>
              </div>
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-red-600 hover:text-white hover:bg-gradient-to-r hover:from-red-600 hover:to-red-700 border border-red-200 hover:border-red-600 transition-all duration-200 shadow-sm hover:shadow-md h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0 sm:p-2"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">


        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard href="/admin/work-sites" title="Work Sites" value={isLoading ? '...' : (stats?.workSites || 0)} subtitle="Active locations" icon={MapPin} iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600" iconColor="text-white" cardBg="bg-blue-100" />
          <StatCard href="/admin/on-site-now" title="On Site Now" value={isLoading ? '...' : (stats?.onSiteNow || 0)} subtitle="Currently active" icon={Clock} iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600" iconColor="text-white" cardBg="bg-orange-100" />
          <StatCard href="/admin/employee-management" title="Active Employees" value={isLoading ? '...' : (stats?.activeEmployees || 0)} subtitle="Total workforce" icon={UserCheck} iconBgColor="bg-gradient-to-br from-green-500 to-green-600" iconColor="text-white" cardBg="bg-green-100" />
          <StatCard 
            title="Alerts" 
            value={isLoading ? '...' : (stats?.alerts || 0)} 
            subtitle="Pending issues" 
            icon={AlertTriangle} 
            iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600" 
            iconColor="text-white" 
            cardBg="bg-purple-100"
            onClick={() => setAlertsDialogOpen(true)}
          />
        </div>

        {/* Quick Actions */}
        <Card className="mb-6 sm:mb-8 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Quick Actions</h3>
              <div className="w-12 h-1 bg-blue-600 rounded-full"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button onClick={() => (window.location.href = '/admin/employee-management')} className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-6 text-left hover:shadow-md transition-all group">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 dark:bg-blue-600 rounded-2xl p-3 group-hover:scale-110 transition-transform">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Employee Management</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Manage workforce</p>
                  </div>
                </div>
              </button>
              <button onClick={() => (window.location.href = '/admin/sites')} className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-2 border-green-200 dark:border-green-700 rounded-xl p-6 text-left hover:shadow-md transition-all group">
                <div className="flex items-start gap-4">
                  <div className="bg-green-500 dark:bg-green-600 rounded-2xl p-3 group-hover:scale-110 transition-transform">
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Add Work Site</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Create locations</p>
                  </div>
                </div>
              </button>
              <ExportReportDialog>
                <button className="w-full bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-6 text-left hover:shadow-md transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="bg-orange-500 dark:bg-orange-600 rounded-2xl p-3 group-hover:scale-110 transition-transform">
                      <Download className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Export Report</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Download data</p>
                    </div>
                  </div>
                </button>
              </ExportReportDialog>
              <button onClick={() => (window.location.href = '/admin/profile')} className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-2 border-purple-200 dark:border-purple-700 rounded-xl p-6 text-left hover:shadow-md transition-all group">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-500 dark:bg-purple-600 rounded-2xl p-3 group-hover:scale-110 transition-transform">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Settings</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Configure system</p>
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
          {/* Recent Activity */}
          <Card className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-sm">
            <div className="p-6 border-b-2 border-slate-300 dark:border-slate-600">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent Activity</h3>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4">
                {activitiesLoading ? (
                  <div className="text-center text-gray-500 dark:text-slate-400 py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500 mb-4 animate-spin" />
                    <p>Loading recent activity...</p>
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-slate-400 py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500 mb-4" />
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
                            <div className="h-px bg-gray-200 dark:bg-slate-700 flex-1" />
                            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 px-2 bg-gray-50 dark:bg-slate-800 rounded-full">
                              {formatDateLabel(date)}
                            </span>
                            <div className="h-px bg-gray-200 dark:bg-slate-700 flex-1" />
                          </div>
                          
                          <div className="space-y-2">
                            {dayActivities.map((activity) => (
                              <div
                                key={activity.id}
                                className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 hover:shadow-sm transition-all group"
                              >
                                {activity.employee.profileImage ? (
                                  <img
                                    src={activity.employee.profileImage}
                                    alt={`${activity.employee.firstName} ${activity.employee.lastName}`}
                                    className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm"
                                    onError={(e) => {
                                      console.error('Image failed to load:', activity.employee.profileImage);
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-700 shadow-sm">
                                    <span className="text-white font-bold text-xs">{activity.employee.firstName?.[0]}{activity.employee.lastName?.[0]}</span>
                                  </div>
                                )}
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                      {activity.employee.firstName} {activity.employee.lastName}
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      activity.type === 'check-in' 
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                    }`}>
                                      {activity.type === 'check-in' ? 'Check In' : 'Check Out'}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-400">
                                      <MapPin className="h-3 w-3" />
                                      <span>{activity.site.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-500">
                                      <Clock className="h-3 w-3" />
                                      <span>{formatActivityTime(new Date(activity.timestamp))}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteActivity(activity.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Delete activity"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
          <Card className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-sm">
            <div className="p-6 border-b-2 border-slate-300 dark:border-slate-600">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Live Locations</h3>
                <Link href="/admin/tracking">
                  <Button variant="link" className="text-blue-600 hover:text-blue-700 text-sm font-semibold">
                    View Full Map →
                  </Button>
                </Link>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="h-80 lg:h-[420px]">
                {!mapLoaded || isLocationsLoading || isSitesLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="space-y-2 w-full">
                      <Skeleton className="h-8 w-40 mx-auto" />
                      <Skeleton className="h-full w-full" />
                    </div>
                  </div>
                ) : (
                  <GoogleMap
                    center={mapCenter}
                    zoom={mapZoom}
                    markers={[
                      ...(Array.isArray(locations) ? locations.flatMap((item: any) => {
                        const lat = parseFloat(item.location?.latitude);
                        const lng = parseFloat(item.location?.longitude);
                        return !isNaN(lat) && !isNaN(lng)
                          ? [{ position: { lat, lng }, title: `${item.employee.firstName} ${item.employee.lastName}`, color: '#ef4444', type: 'employee' as const }]
                          : [];
                      }) : []),
                      ...(Array.isArray(sites) ? sites.flatMap((site: any) => {
                        const lat = parseFloat(site.latitude);
                        const lng = parseFloat(site.longitude);
                        return !isNaN(lat) && !isNaN(lng)
                          ? [{
                              position: { lat, lng },
                              title: `Work Site: ${site.name}`,
                              color: '#22c55e',
                              type: 'site' as const,
                              label: site.name,
                              onClick: () => setMapCenter({ lat, lng }),
                            }]
                          : [];
                      }) : []),
                    ]}
                    geofences={(Array.isArray(sites) ? sites.flatMap((site: any) => {
                      const lat = parseFloat(site.latitude);
                      const lng = parseFloat(site.longitude);
                      const radius = parseFloat(site.geofenceRadius);
                      return !isNaN(lat) && !isNaN(lng) && !isNaN(radius)
                        ? [{ center: { lat, lng }, radius, color: '#2563eb' }]
                        : [];
                    }) : [])}
                    className="w-full h-full"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
        
        <AlertsDialog open={alertsDialogOpen} onOpenChange={setAlertsDialogOpen} />
        
        {/* Delete Activity Confirmation Dialog */}
        <AlertDialog open={!!deleteActivityId} onOpenChange={(open) => !open && setDeleteActivityId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Activity</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this activity? This will permanently remove the attendance record from the database. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteActivityId && deleteActivityMutation.mutate(deleteActivityId)}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteActivityMutation.isPending}
              >
                {deleteActivityMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
