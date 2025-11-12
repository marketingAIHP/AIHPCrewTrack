import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getAuthToken, getUserType, getUser, logout } from '@/lib/auth';
import GoogleMap from '@/components/google-map';
import { loadGoogleMapsAPI } from '@/lib/google-maps';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { Slider } from '@/components/ui/slider';
import NotificationDropdown from '@/components/NotificationDropdown';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Plus, 
  MapPin, 
  Edit, 
  Building2,
  Users,
  Trash2,
  Camera,
  Image,
  LogOut
} from 'lucide-react';

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.string().min(1, 'Latitude is required'),
  longitude: z.string().min(1, 'Longitude is required'),
  geofenceRadius: z.string().min(1, 'Geofence radius is required'),
  areaId: z.string().optional(),
  siteImage: z.string().optional(),
});

const areaSchema = z.object({
  name: z.string().min(1, 'Area name is required'),
  description: z.string().optional(),
});

type SiteForm = z.infer<typeof siteSchema>;
type AreaForm = z.infer<typeof areaSchema>;

export default function SiteManagement() {
  // All hooks must be declared unconditionally at the top
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [editingArea, setEditingArea] = useState<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState({ lat: 28.4595, lng: 77.0266 });
  const [siteImageURL, setSiteImageURL] = useState<string>('');
  const [selectedAreaView, setSelectedAreaView] = useState<any>(null);
  const siteImageInputRef = useRef<HTMLInputElement>(null);
  
  // Check authentication
  const isAuthenticated = Boolean(getAuthToken() && getUserType() === 'admin');
  const currentUser = getUser();
  
  // Get admin profile for header
  const { data: admin } = useQuery({
    queryKey: ['/api/admin/profile'],
    enabled: isAuthenticated,
  });

  // All queries
  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['/api/admin/areas'],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: sites = [], isLoading: loadingSites } = useQuery({
    queryKey: ['/api/admin/sites'],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // All forms
  const form = useForm<SiteForm>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      geofenceRadius: '200',
      areaId: 'none',
    },
  });

  const areaForm = useForm<AreaForm>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // All mutations
  const createSiteMutation = useMutation({
    mutationFn: async (data: SiteForm) => {
      const payload = {
        name: data.name,
        address: data.address,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        geofenceRadius: parseInt(data.geofenceRadius),
        areaId: data.areaId && data.areaId !== 'none' ? parseInt(data.areaId) : null,
        siteImage: siteImageURL || undefined,
      };
      
      if (editingSite) {
        return apiRequest('PUT', `/api/admin/sites/${editingSite.id}`, payload);
      } else {
        return apiRequest('POST', '/api/admin/sites', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      setIsDialogOpen(false);
      setEditingSite(null);
      form.reset();
      setSiteImageURL('');
      toast({
        title: 'Success',
        description: editingSite ? 'Work site updated successfully' : 'Work site created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${editingSite ? 'update' : 'create'} work site`,
        variant: 'destructive',
      });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/admin/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      toast({
        title: 'Success',
        description: 'Work site deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete work site',
        variant: 'destructive',
      });
    },
  });

  const createAreaMutation = useMutation({
    mutationFn: async (data: AreaForm) => {
      if (editingArea) {
        return apiRequest('PUT', `/api/admin/areas/${editingArea.id}`, data);
      } else {
        return apiRequest('POST', '/api/admin/areas', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/areas'] });
      setIsAreaDialogOpen(false);
      setEditingArea(null);
      areaForm.reset();
      toast({
        title: 'Success',
        description: editingArea ? 'Area updated successfully' : 'Area created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${editingArea ? 'update' : 'create'} area`,
        variant: 'destructive',
      });
    },
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/admin/areas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/areas'] });
      toast({
        title: 'Success',
        description: 'Area deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete area',
        variant: 'destructive',
      });
    },
  });

  // All useEffect hooks
  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
      return;
    }

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
  }, [isAuthenticated, setLocation, toast]);

  // Site image upload mutation
  const uploadSiteImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/site', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.details || 'Failed to upload image');
      }

      const data = await response.json();
      const imageURL = data.siteImage || data.url || data.uploadURL;

      if (!imageURL) {
        throw new Error('No image URL returned from server');
      }

      return imageURL;
    },
    onSuccess: (imageURL) => {
      setSiteImageURL(imageURL);
      // Invalidate queries to refresh site images everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      toast({
        title: 'Success',
        description: 'Site image uploaded successfully',
      });
      // Reset file input
      if (siteImageInputRef.current) {
        siteImageInputRef.current.value = '';
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload site image. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Helper function for file upload
  const handleSiteImageFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid File',
          description: 'Please select an image file.',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10485760) {
        toast({
          title: 'File Too Large',
          description: 'Please select an image smaller than 10MB.',
          variant: 'destructive',
        });
        return;
      }

      uploadSiteImageMutation.mutate(file);
    }
  }, [toast, uploadSiteImageMutation]);

  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    form.setValue('latitude', lat.toString());
    form.setValue('longitude', lng.toString());
  }, [form]);

  const handleEditSite = useCallback((site: any) => {
    setEditingSite(site);
    form.reset({
      name: site.name,
      address: site.address,
      latitude: site.latitude.toString(),
      longitude: site.longitude.toString(),
      geofenceRadius: site.geofenceRadius.toString(),
      areaId: site.areaId ? site.areaId.toString() : 'none',
    });
    setSiteImageURL(site.siteImage || '');
    setSelectedLocation({ lat: Number(site.latitude), lng: Number(site.longitude) });
    setIsDialogOpen(true);
  }, [form]);

  const handleDeleteSite = useCallback((site: any) => {
    if (window.confirm(`Are you sure you want to delete "${site.name}"? This action cannot be undone.`)) {
      deleteSiteMutation.mutate(site.id);
    }
  }, [deleteSiteMutation]);

  const handleEditArea = useCallback((area: any) => {
    setEditingArea(area);
    areaForm.reset({
      name: area.name,
      description: area.description || '',
    });
    setIsAreaDialogOpen(true);
  }, [areaForm]);

  const handleDeleteArea = useCallback((area: any) => {
    const areaSites = Array.isArray(sites) ? sites.filter((site: any) => site.areaId === area.id) : [];
    
    if (areaSites.length > 0) {
      toast({
        title: 'Cannot Delete Area',
        description: `This area has ${areaSites.length} work sites. Please reassign them first.`,
        variant: 'destructive',
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${area.name}"? This action cannot be undone.`)) {
      deleteAreaMutation.mutate(area.id);
    }
  }, [sites, toast, deleteAreaMutation]);

  const onSubmit = useCallback((data: SiteForm) => {
    createSiteMutation.mutate(data);
  }, [createSiteMutation]);

  const onAreaSubmit = useCallback((data: AreaForm) => {
    createAreaMutation.mutate(data);
  }, [createAreaMutation]);

  // All useMemo hooks
  const filteredSites = useMemo(() => {
    if (!selectedAreaView || !Array.isArray(sites)) return [];
    return sites.filter((site: any) => site.areaId === selectedAreaView.id);
  }, [sites, selectedAreaView]);

  // Early return only after all hooks
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            <Link href="/admin/dashboard">
              <div className="flex items-center gap-1.5 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity min-w-0">
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
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 hidden sm:block">Site Management</p>
                </div>
              </div>
            </Link>
            {selectedAreaView && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedAreaView(null)}
                className="flex items-center h-8 sm:h-9 px-2 sm:px-3 shrink-0"
              >
                <ArrowLeft className="sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Back to Areas</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
            <div className="scale-90 sm:scale-100">
              <NotificationDropdown />
            </div>
            <Link href="/admin/profile">
              <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-1.5 sm:px-3 py-1 sm:py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-full overflow-hidden">
                  <AuthenticatedImage
                    src={admin?.profileImage}
                    alt="Admin Avatar"
                    className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 object-cover"
                    fallback={
                      <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 bg-blue-600 text-white text-xs sm:text-sm flex items-center justify-center rounded-full font-bold">
                        {admin?.firstName?.[0] || ''}{admin?.lastName?.[0] || ''}
                      </div>
                    }
                  />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {admin?.firstName && admin?.lastName
                      ? `${admin.firstName} ${admin.lastName}`
                      : 'Administrator'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Administrator</p>
                </div>
              </div>
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                logout();
                toast({
                  title: 'Logged out',
                  description: 'You have been successfully logged out.',
                });
                setLocation('/admin/login');
              }}
              className="text-red-600 hover:text-white hover:bg-gradient-to-r hover:from-red-600 hover:to-red-700 border border-red-200 hover:border-red-600 transition-all duration-200 shadow-sm hover:shadow-md h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0 sm:p-2"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Title and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                {selectedAreaView ? selectedAreaView.name : 'Areas & Sites'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 hidden sm:block">
                {selectedAreaView 
                  ? `Manage work sites in ${selectedAreaView.name}` 
                  : 'Organize your work sites by areas'}
              </p>
            </div>
          </div>

            {selectedAreaView && (
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingSite(null);
                  form.reset();
                  setSiteImageURL('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Site
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">{editingSite ? 'Edit Work Site' : 'Add New Work Site'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                      <Label htmlFor="name">Site Name</Label>
                      <Input
                        id="name"
                        {...form.register('name')}
                        placeholder="Main Office"
                      />
                      {form.formState.errors.name && (
                        <p className="text-error text-sm mt-1">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        {...form.register('address')}
                        placeholder="123 Main St, City, State"
                        rows={3}
                      />
                      {form.formState.errors.address && (
                        <p className="text-error text-sm mt-1">
                          {form.formState.errors.address.message}
                        </p>
                      )}
                    </div>

                    {mapLoaded && (
                      <div>
                        <Label>Location (Click on map to select)</Label>
                        <div className="h-64 rounded-lg overflow-hidden border">
                          <GoogleMap
                            center={selectedLocation}
                            zoom={15}
                            markers={[{
                              position: selectedLocation,
                              title: form.watch('name') || 'New Site',
                              type: 'site'
                            }]}
                            geofences={[{
                              center: selectedLocation,
                              radius: parseInt(form.watch('geofenceRadius') || '0') || 0,
                              color: '#2563eb'
                            }]}
                            onMapClick={(lat, lng) => handleLocationSelect(lat, lng)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="latitude">Latitude</Label>
                        <Input
                          id="latitude"
                          {...form.register('latitude')}
                          placeholder="40.7128"
                          step="any"
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
                          step="any"
                        />
                        {form.formState.errors.longitude && (
                          <p className="text-error text-sm mt-1">
                            {form.formState.errors.longitude.message}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="area">Area (Optional)</Label>
                      <Select value={form.watch('areaId')} onValueChange={(value) => form.setValue('areaId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an area (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Area</SelectItem>
                          {Array.isArray(areas) && areas.map((area: any) => (
                            <SelectItem key={area.id} value={area.id.toString()}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="geofenceRadius">Geofence Radius (meters)</Label>
                      <Input
                        id="geofenceRadius"
                        {...form.register('geofenceRadius')}
                        placeholder="200"
                        type="number"
                        className="mb-3"
                      />
                      <div className="px-1">
                        <Slider
                          value={[parseInt(form.watch('geofenceRadius') || '0') || 0]}
                          onValueChange={(vals) => form.setValue('geofenceRadius', String(vals[0] ?? 0))}
                          min={50}
                          max={1000}
                          step={10}
                        />
                        <div className="mt-2 text-xs text-muted-foreground">Radius: {form.watch('geofenceRadius') || 0}m</div>
                      </div>
                      {form.formState.errors.geofenceRadius && (
                        <p className="text-error text-sm mt-1">
                          {form.formState.errors.geofenceRadius.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label>Site Image</Label>
                      {siteImageURL && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-600 mb-2">Current Image:</p>
                          <AuthenticatedImage
                            src={siteImageURL}
                            alt="Site preview"
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                      <input
                        ref={siteImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSiteImageFileChange}
                        className="hidden"
                        id="site-image-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => siteImageInputRef.current?.click()}
                        className="w-full"
                        disabled={uploadSiteImageMutation.isPending}
                      >
                        {uploadSiteImageMutation.isPending ? 'Uploading...' : 'Upload Site Image'}
                      </Button>
                      {siteImageURL && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSiteImageURL('')}
                          className="mt-2 w-full"
                        >
                          Remove Image
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <Button type="submit" className="flex-1" disabled={createSiteMutation.isPending}>
                        {createSiteMutation.isPending 
                          ? (editingSite ? 'Updating...' : 'Creating...') 
                          : (editingSite ? 'Update Site' : 'Create Site')
                        }
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

        {selectedAreaView ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{selectedAreaView.name}</h2>
                {selectedAreaView.description && (
                  <p className="text-slate-600 mt-2">{selectedAreaView.description}</p>
                )}
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingSite(null);
                  form.reset();
                  setSiteImageURL('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Site
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">{editingSite ? 'Edit Work Site' : 'Add New Work Site'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                      <Label htmlFor="name">Site Name</Label>
                      <Input
                        id="name"
                        {...form.register('name')}
                        placeholder="Main Office"
                      />
                      {form.formState.errors.name && (
                        <p className="text-error text-sm mt-1">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        {...form.register('address')}
                        placeholder="123 Main St, City, State"
                        rows={3}
                      />
                      {form.formState.errors.address && (
                        <p className="text-error text-sm mt-1">
                          {form.formState.errors.address.message}
                        </p>
                      )}
                    </div>

                    {mapLoaded && (
                      <div>
                        <Label>Location (Click on map to select)</Label>
                        <div className="h-64 rounded-lg overflow-hidden border">
                          <GoogleMap
                            center={selectedLocation}
                            zoom={15}
                            markers={[{
                              position: selectedLocation,
                              title: form.watch('name') || 'New Site',
                              type: 'site'
                            }]}
                            geofences={[{
                              center: selectedLocation,
                              radius: parseInt(form.watch('geofenceRadius') || '0') || 0,
                              color: '#2563eb'
                            }]}
                            onMapClick={(lat, lng) => handleLocationSelect(lat, lng)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="latitude">Latitude</Label>
                        <Input
                          id="latitude"
                          {...form.register('latitude')}
                          placeholder="40.7128"
                          step="any"
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
                          step="any"
                        />
                        {form.formState.errors.longitude && (
                          <p className="text-error text-sm mt-1">
                            {form.formState.errors.longitude.message}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="area">Area (Optional)</Label>
                      <Select value={form.watch('areaId')} onValueChange={(value) => form.setValue('areaId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an area (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Area</SelectItem>
                          {Array.isArray(areas) && areas.map((area: any) => (
                            <SelectItem key={area.id} value={area.id.toString()}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="geofenceRadius">Geofence Radius (meters)</Label>
                      <Input
                        id="geofenceRadius"
                        {...form.register('geofenceRadius')}
                        placeholder="200"
                        type="number"
                        className="mb-3"
                      />
                      <div className="px-1">
                        <Slider
                          value={[parseInt(form.watch('geofenceRadius') || '200')]}
                          onValueChange={(value) => form.setValue('geofenceRadius', value[0].toString())}
                          min={50}
                          max={1000}
                          step={50}
                          className="w-full"
                        />
                        <div className="mt-2 text-xs text-muted-foreground">Radius: {form.watch('geofenceRadius') || 0}m</div>
                      </div>
                      {form.formState.errors.geofenceRadius && (
                        <p className="text-error text-sm mt-1">
                          {form.formState.errors.geofenceRadius.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label>Site Image</Label>
                      {siteImageURL && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-600 mb-2">Current Image:</p>
                          <AuthenticatedImage
                            src={siteImageURL}
                            alt="Site preview"
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                      <input
                        ref={siteImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSiteImageFileChange}
                        className="hidden"
                        id="site-image-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => siteImageInputRef.current?.click()}
                        className="w-full"
                        disabled={uploadSiteImageMutation.isPending}
                      >
                        {uploadSiteImageMutation.isPending ? 'Uploading...' : 'Upload Site Image'}
                      </Button>
                      {siteImageURL && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSiteImageURL('')}
                          className="mt-2 w-full"
                        >
                          Remove Image
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <Button type="submit" className="flex-1" disabled={createSiteMutation.isPending}>
                        {createSiteMutation.isPending 
                          ? (editingSite ? 'Updating...' : 'Creating...') 
                          : (editingSite ? 'Update Site' : 'Create Site')
                        }
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSites.length === 0 ? (
                <Card className="col-span-full border-2 border-dashed border-slate-300 dark:border-slate-600">
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No sites in this area</h3>
                    <p className="text-slate-600 mb-4">Get started by adding your first work site</p>
                    <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Site
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredSites.map((site: any) => (
                  <Card key={site.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-md group">
                    <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden relative">
                      <AuthenticatedImage
                        src={site.siteImage}
                        alt={site.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        fallback={
                          <div className="text-center w-full h-full flex flex-col items-center justify-center">
                            <Building2 className="h-12 w-12 text-slate-400 mb-2" />
                            <p className="text-sm text-slate-600">Work Site</p>
                          </div>
                        }
                      />
                      <div className="absolute top-3 right-3">
                        <Badge variant={site.isActive ? "default" : "secondary"} className="shadow-sm">
                          {site.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <div className="mb-4">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{site.name}</h3>
                        <p className="text-slate-600 text-sm flex items-start">
                          <MapPin className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0 text-slate-400" />
                          <span className="line-clamp-2">{site.address}</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4 pb-4 border-b-2 border-slate-300 dark:border-slate-600">
                        <span className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {Number(site.latitude).toFixed(4)}, {Number(site.longitude).toFixed(4)}
                        </span>
                        <span className="flex items-center">
                          <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                          {site.geofenceRadius}m radius
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditSite(site)} className="flex-1 hover:bg-blue-50 hover:border-blue-200">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeleteSite(site)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Areas Management</h2>
              <Dialog open={isAreaDialogOpen} onOpenChange={(open) => {
                setIsAreaDialogOpen(open);
                if (!open) {
                  setEditingArea(null);
                  areaForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Area
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingArea ? 'Edit Area' : 'Add New Area'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={areaForm.handleSubmit(onAreaSubmit)} className="space-y-6">
                    <div>
                      <Label htmlFor="areaName">Area Name</Label>
                      <Input
                        id="areaName"
                        {...areaForm.register('name')}
                        placeholder="Downtown District"
                      />
                      {areaForm.formState.errors.name && (
                        <p className="text-error text-sm mt-1">
                          {areaForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="areaDescription">Description (Optional)</Label>
                      <Textarea
                        id="areaDescription"
                        {...areaForm.register('description')}
                        placeholder="Description of the area"
                        rows={3}
                      />
                      {areaForm.formState.errors.description && (
                        <p className="text-error text-sm mt-1">
                          {areaForm.formState.errors.description.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button type="submit" className="flex-1" disabled={createAreaMutation.isPending}>
                        {createAreaMutation.isPending 
                          ? (editingArea ? 'Updating...' : 'Creating...') 
                          : (editingArea ? 'Update Area' : 'Create Area')
                        }
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsAreaDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {loadingAreas ? (
                <Card className="col-span-full border-2 border-slate-300 dark:border-slate-600">
                  <CardContent className="p-8 text-center">
                    <div className="animate-pulse">
                      <div className="h-8 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : !Array.isArray(areas) || areas.length === 0 ? (
                <Card className="col-span-full border-2 border-dashed border-slate-300 dark:border-slate-600">
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-full flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No areas created yet</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">Areas help organize your work sites into logical groups</p>
                    <Button onClick={() => setIsAreaDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Area
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                Array.isArray(areas) && areas.map((area: any) => {
                  const siteCount = Array.isArray(sites) ? sites.filter((site: any) => site.areaId === area.id).length : 0;
                  return (
                    <Card 
                      key={area.id} 
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-md bg-white dark:bg-slate-800 group overflow-hidden"
                      onClick={() => setSelectedAreaView(area)}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                      <CardContent className="p-6 relative">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{area.name}</h3>
                            {area.description && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{area.description}</p>
                            )}
                          </div>
                          <div 
                            className="flex space-x-1 relative z-10 ml-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditArea(area)}
                              title="Edit area"
                              className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            >
                              <Edit className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteArea(area)}
                              className="h-8 w-8 p-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                              title="Delete area"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t-2 border-slate-300 dark:border-slate-600">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{siteCount}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{siteCount === 1 ? 'site' : 'sites'}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-2 border-slate-300 dark:border-slate-600 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                            View Sites
                            <ArrowLeft className="h-3 w-3 ml-1 rotate-180" />
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}