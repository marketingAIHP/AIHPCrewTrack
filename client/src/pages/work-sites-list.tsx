import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Users, Navigation, Building2, Plus } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';

interface WorkSite {
  id: number;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadius: number;
  siteImage?: string;
  isActive: boolean;
  adminId: number;
  createdAt: string;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  siteId: number;
  isActive: boolean;
}

export default function WorkSitesList() {

  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: ['/api/admin/sites'],
    queryFn: async () => {
      const response = await fetch('/api/admin/sites', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch work sites');
      return response.json();
    },
  });

  const { data: employees } = useQuery({
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

  const getEmployeeCount = (siteId: number) => {
    if (!employees) return 0;
    return employees.filter((emp: Employee) => emp.siteId === siteId && emp.isActive).length;
  };



  const activeSites = Array.isArray(sites) ? sites.filter((site: WorkSite) => site.isActive) : [];

  if (sitesLoading) {
    return (
      <div className="container mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="flex items-center mb-6">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mr-4 hover:bg-slate-100 dark:hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Work Sites</h1>
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
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-9 px-2 sm:px-3">
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">Work Sites</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 hidden sm:block">View and manage all active work sites</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-sm shrink-0">
            {activeSites.length} {activeSites.length === 1 ? 'Site' : 'Sites'}
          </Badge>
        </div>

        <div className="grid gap-4">
          {activeSites.length === 0 ? (
            <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No work sites found</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Create work sites to track employee locations and attendance</p>
                <Link href="/admin/sites">
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Work Site
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            activeSites.map((site: WorkSite) => (
              <Card key={site.id} className="hover:shadow-lg transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-md overflow-hidden bg-white dark:bg-slate-800 mx-auto sm:mx-0 max-w-full">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg sm:rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-blue-200 dark:ring-blue-700 shrink-0">
                        <AuthenticatedImage
                          src={site.siteImage}
                          alt={site.name}
                          className="w-full h-full object-cover"
                          fallback={
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                              <Building2 className="text-white h-6 w-6 sm:h-8 sm:w-8" />
                            </div>
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base sm:text-xl text-slate-900 dark:text-slate-100 mb-1">
                          {site.name}
                        </h3>
                        <p className="text-xs sm:text-slate-600 dark:text-slate-400 flex items-center mb-2">
                          <Navigation className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span className="line-clamp-2">{site.address}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          <div className="flex items-center">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 shrink-0" />
                            <span className="font-medium">{getEmployeeCount(site.id)} employees</span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 dark:bg-blue-400 mr-1 shrink-0"></span>
                            <span>Radius: {site.geofenceRadius}m</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:gap-2 w-full sm:w-auto sm:text-right sm:ml-6">
                      <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0 shadow-sm text-xs">
                        <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                        Active
                      </Badge>
                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-200 dark:border-slate-600">
                        <div className="font-medium">Coordinates</div>
                        <div>Lat: {parseFloat(site.latitude).toFixed(4)}</div>
                        <div>Lng: {parseFloat(site.longitude).toFixed(4)}</div>
                      </div>
                      <Link href={`/admin/live-tracking?siteId=${site.id}`} className="w-full sm:w-auto">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4">
                          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">View Map</span>
                          <span className="sm:hidden">View</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href="/admin/sites">
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
              <Building2 className="h-4 w-4 mr-2" />
              Manage Work Sites
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}