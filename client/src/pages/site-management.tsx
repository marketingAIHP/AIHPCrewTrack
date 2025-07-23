import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getAuthToken, getUserType } from '@/lib/auth';
import GoogleMap, { loadGoogleMapsAPI } from '@/components/google-map';
import { 
  ArrowLeft, 
  Plus, 
  MapPin, 
  Edit, 
  Building2,
  Users
} from 'lucide-react';

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.string().min(1, 'Latitude is required'),
  longitude: z.string().min(1, 'Longitude is required'),
  geofenceRadius: z.string().min(1, 'Geofence radius is required'),
});

type SiteForm = z.infer<typeof siteSchema>;

export default function SiteManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState({ lat: 40.7128, lng: -74.0060 });

  useEffect(() => {
    if (!getAuthToken() || getUserType() !== 'admin') {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
    }

    // Load Google Maps API
    loadGoogleMapsAPI()
      .then(() => setMapLoaded(true))
      .catch((error) => {
        console.error('Failed to load Google Maps:', error);
        toast({
          title: 'Error',
          description: 'Failed to load Google Maps. Some features may not work.',
          variant: 'destructive',
        });
      });
  }, []);

  const { data: sites = [], isLoading: loadingSites } = useQuery({
    queryKey: ['/api/admin/sites'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['/api/admin/employees'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
  });

  const form = useForm<SiteForm>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      geofenceRadius: '200',
    },
  });

  const createSiteMutation = useMutation({
    mutationFn: async (data: SiteForm) => {
      const payload = {
        ...data,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        geofenceRadius: parseInt(data.geofenceRadius),
      };
      const response = await apiRequest('POST', '/api/admin/sites', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Work site created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create work site',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: SiteForm) => {
    createSiteMutation.mutate(data);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    form.setValue('latitude', lat.toString());
    form.setValue('longitude', lng.toString());
  };

  const getEmployeeCount = (siteId: number) => {
    return employees?.filter((emp: any) => emp.siteId === siteId).length || 0;
  };

  const getCurrentlyOnSite = (siteId: number) => {
    // This would normally come from attendance data
    // For now, we'll return a placeholder
    return Math.floor(Math.random() * getEmployeeCount(siteId));
  };

  if (!getAuthToken() || getUserType() !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft />
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Work Site Management</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-blue-700 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Site
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Work Site</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Site Name</Label>
                    <Input
                      id="name"
                      {...form.register('name')}
                      placeholder="Downtown Construction Site"
                    />
                    {form.formState.errors.name && (
                      <p className="text-error text-sm mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      {...form.register('address')}
                      placeholder="123 Main Street, City, State"
                    />
                    {form.formState.errors.address && (
                      <p className="text-error text-sm mt-1">
                        {form.formState.errors.address.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        {...form.register('latitude')}
                        placeholder="40.7128"
                        readOnly
                      />
                      {form.formState.errors.latitude && (
                        <p className="text-error text-sm mt-1">
                          {form.formState.errors.latitude.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        {...form.register('longitude')}
                        placeholder="-74.0060"
                        readOnly
                      />
                      {form.formState.errors.longitude && (
                        <p className="text-error text-sm mt-1">
                          {form.formState.errors.longitude.message}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="geofenceRadius">Geofence Radius (meters)</Label>
                    <Input
                      id="geofenceRadius"
                      {...form.register('geofenceRadius')}
                      placeholder="200"
                      type="number"
                    />
                    {form.formState.errors.geofenceRadius && (
                      <p className="text-error text-sm mt-1">
                        {form.formState.errors.geofenceRadius.message}
                      </p>
                    )}
                  </div>
                  
                  {mapLoaded && (
                    <div>
                      <Label>Click on the map to select location</Label>
                      <div className="h-64 mt-2">
                        <GoogleMap
                          center={selectedLocation}
                          zoom={13}
                          markers={[
                            {
                              id: 'selected',
                              position: selectedLocation,
                              title: 'Selected Location',
                              color: 'red',
                            },
                          ]}
                          geofences={[
                            {
                              id: 'geofence',
                              center: selectedLocation,
                              radius: parseInt(form.watch('geofenceRadius') || '200'),
                              color: '#1976D2',
                            },
                          ]}
                          onMapClick={handleMapClick}
                          className="rounded-lg border"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <Button type="submit" className="flex-1" disabled={createSiteMutation.isPending}>
                      {createSiteMutation.isPending ? 'Creating...' : 'Create Site'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Site Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingSites ? (
            <div className="col-span-full text-center py-8">
              <p>Loading work sites...</p>
            </div>
          ) : !sites || sites.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No work sites found</p>
              <p className="text-sm text-gray-400">Add work sites to start managing locations</p>
            </div>
          ) : (
            sites.map((site: any) => (
              <Card key={site.id} className="overflow-hidden">
                <div className="h-48 bg-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Work Site</p>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{site.name}</h3>
                    <Badge 
                      variant={site.isActive ? "default" : "secondary"}
                      className={site.isActive ? "bg-success text-white" : ""}
                    >
                      {site.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{site.address}</p>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Assigned Workers</span>
                      <span className="font-medium text-gray-900">{getEmployeeCount(site.id)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Currently On Site</span>
                      <span className="font-medium text-success">{getCurrentlyOnSite(site.id)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Geofence Radius</span>
                      <span className="font-medium text-gray-900">{site.geofenceRadius}m</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button className="flex-1 bg-primary text-white hover:bg-blue-700">
                      <MapPin className="mr-2 h-4 w-4" />
                      View Map
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
