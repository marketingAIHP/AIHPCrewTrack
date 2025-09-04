import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Users, Navigation, Building2 } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { AdaptiveImage } from '@/components/AdaptiveImage';

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
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-6">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Work Sites</h1>
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
          <h1 className="text-2xl font-bold">Work Sites</h1>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1 bg-blue-100 text-blue-800">
          {activeSites.length} Sites
        </Badge>
      </div>

      <div className="grid gap-4">
        {activeSites.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No work sites found</p>
              <p className="text-sm text-gray-400 mt-1">
                Create work sites to track employee locations and attendance
              </p>
            </CardContent>
          </Card>
        ) : (
          activeSites.map((site: WorkSite) => (
            <Card key={site.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                      {site.siteImage ? (
                        <AdaptiveImage 
                          src={site.siteImage} 
                          alt={site.name}
                          className="w-full h-full object-cover"
                          sizes="thumbnail"
                          fallback={
                            <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                              <Building2 className="text-blue-600 h-6 w-6" />
                            </div>
                          }
                        />
                      ) : (
                        <MapPin className="text-blue-600 h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {site.name}
                      </h3>
                      <p className="text-gray-600 flex items-center">
                        <Navigation className="h-4 w-4 mr-1" />
                        {site.address}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{getEmployeeCount(site.id)} employees</span>
                        </div>
                        <span>Radius: {site.geofenceRadius}m</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                      <MapPin className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                    <div className="text-sm text-gray-500">
                      <div>Lat: {parseFloat(site.latitude).toFixed(4)}</div>
                      <div>Lng: {parseFloat(site.longitude).toFixed(4)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/live-tracking?siteId=${site.id}`}>
                        <Button variant="outline" size="sm">
                          <MapPin className="h-4 w-4 mr-1" />
                          View Map
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
        <Link href="/admin/sites">
          <Button>
            Manage Work Sites
          </Button>
        </Link>
      </div>
    </div>
  );
}