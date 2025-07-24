import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Users, Radius } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';

interface Site {
  id: number;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadius: number;
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
      if (!response.ok) throw new Error('Failed to fetch sites');
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
    return employees?.filter((emp: Employee) => emp.siteId === siteId && emp.isActive).length || 0;
  };

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
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {sites?.length || 0} Sites
        </Badge>
      </div>

      <div className="grid gap-4">
        {!sites || sites.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No work sites found</p>
              <Link href="/admin/sites">
                <Button className="mt-4">Add Your First Site</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          sites.map((site: Site) => (
            <Card key={site.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{site.name}</h3>
                      <p className="text-gray-600 mb-2">{site.address}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{getEmployeeCount(site.id)} employees</span>
                        </div>
                        <div className="flex items-center">
                          <Radius className="h-4 w-4 mr-1" />
                          <span>{site.geofenceRadius}m radius</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <Badge 
                      variant={site.isActive ? "default" : "secondary"}
                      className={site.isActive ? "bg-green-100 text-green-800" : ""}
                    >
                      {site.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="text-sm text-gray-500">
                      Created {new Date(site.createdAt).toLocaleDateString()}
                    </div>
                    <div className="space-x-2">
                      <Link href={`/admin/live-tracking?siteId=${site.id}`}>
                        <Button variant="outline" size="sm">
                          View on Map
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
    </div>
  );
}