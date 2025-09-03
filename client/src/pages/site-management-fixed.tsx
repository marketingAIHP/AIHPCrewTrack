import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { getAuthToken, getUserType } from '@/lib/auth';
import GoogleMap from '@/components/google-map';
import { loadGoogleMapsAPI } from '@/lib/google-maps';
import { ObjectUploader } from '@/components/ObjectUploader';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { 
  ArrowLeft, 
  Plus, 
  MapPin, 
  Edit, 
  Building2,
  Users,
  Trash2,
  Camera,
  Image
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
  
  // Check authentication
  const isAuthenticated = Boolean(getAuthToken() && getUserType() === 'admin');

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

  // All useCallback hooks
  const handleGetUploadParameters = useCallback(async () => {
    try {
      const response = await fetch('/api/object-storage/upload', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to get upload parameters');
      }
      
      const { uploadURL } = await response.json();
      console.log('Got upload parameters for site image:', { uploadURL });
      
      return {
        method: 'PUT' as const,
        url: uploadURL,
      };
    } catch (error) {
      console.error('Upload parameters error:', error);
      throw error;
    }
  }, []);

  const handleUploadComplete = useCallback((result: any) => {
    console.log('Site image upload complete:', result);
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      console.log('Site uploaded file details:', uploadedFile);
      
      // Try multiple possible fields for the upload URL
      const imageURL = uploadedFile.uploadURL || uploadedFile.response?.uploadURL || uploadedFile.url;
      
      if (imageURL) {
        setSiteImageURL(imageURL);
        toast({
          title: 'Success',
          description: 'Site image uploaded successfully',
        });
      } else {
        console.error('No upload URL found in site upload result:', uploadedFile);
        toast({
          title: 'Upload Error',
          description: 'Image uploaded but URL not found. Please try again.',
          variant: 'destructive',
        });
      }
    } else {
      console.error('Site image upload failed:', result);
      toast({
        title: 'Upload Failed',
        description: 'Site image upload was not successful. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4 gap-2 sm:gap-0">
            <div className="flex items-center">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="mr-2 sm:mr-4">
                  <ArrowLeft className="h-4 w-4 mr-1 sm:mr-0" />
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              {selectedAreaView && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedAreaView(null)}
                  className="flex items-center mr-2 sm:mr-4"
                >
                  <ArrowLeft className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Back to Areas</span>
                  <span className="sm:hidden">Areas</span>
                </Button>
              )}
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                {selectedAreaView ? `${selectedAreaView.name} - Sites` : 'Areas & Sites Management'}
              </h1>
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
                      />
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
                          <img 
                            src={siteImageURL} 
                            alt="Site preview"
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={10485760}
                        allowedFileTypes={['image/*']}
                        onGetUploadParameters={handleGetUploadParameters}
                        onComplete={handleUploadComplete}
                        buttonClassName="w-full"
                      />
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {selectedAreaView ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{selectedAreaView.name}</h2>
                {selectedAreaView.description && (
                  <p className="text-gray-600 mt-1">{selectedAreaView.description}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSites.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">No sites in this area yet</p>
                  <p className="text-sm text-gray-400">Add the first site to get started</p>
                </div>
              ) : (
                filteredSites.map((site: any) => (
                  <Card key={site.id} className="overflow-hidden">
                    <div className="h-48 bg-gray-200 flex items-center justify-center overflow-hidden">
                      {site.siteImage ? (
                        <AuthenticatedImage 
                          src={site.siteImage} 
                          alt={site.name}
                          className="w-full h-full object-cover"
                          fallback={
                            <div className="text-center">
                              <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                              <p className="text-sm text-gray-600">Work Site</p>
                            </div>
                          }
                        />
                      ) : (
                        <div className="text-center">
                          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Work Site</p>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">{site.name}</h3>
                        <Badge variant={site.isActive ? "default" : "secondary"}>
                          {site.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-4">{site.address}</p>
                      <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                        <span className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {Number(site.latitude).toFixed(4)}, {Number(site.longitude).toFixed(4)}
                        </span>
                        <span>Radius: {site.geofenceRadius}m</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditSite(site)} className="flex-1">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeleteSite(site)}
                          className="text-red-600 hover:text-red-700"
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
              <h2 className="text-2xl font-semibold text-gray-900">Areas Management</h2>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {loadingAreas ? (
                <div className="col-span-full text-center py-4">
                  <p>Loading areas...</p>
                </div>
              ) : !Array.isArray(areas) || areas.length === 0 ? (
                <div className="col-span-full text-center py-4">
                  <p className="text-gray-500">No areas created yet</p>
                  <p className="text-sm text-gray-400">Areas help organize your work sites</p>
                </div>
              ) : (
                Array.isArray(areas) && areas.map((area: any) => (
                  <Card 
                    key={area.id} 
                    className="p-4 cursor-pointer hover:shadow-md hover:bg-gray-50 transition-all duration-200 relative"
                    onClick={() => setSelectedAreaView(area)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">{area.name}</h3>
                      <div 
                        className="flex space-x-1 relative z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditArea(area)}
                          title="Edit area"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteArea(area)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete area"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {area.description && (
                      <p className="text-sm text-gray-600 mb-2">{area.description}</p>
                    )}
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500">
                        {Array.isArray(sites) ? sites.filter((site: any) => site.areaId === area.id).length : 0} sites
                      </p>
                      <div className="flex items-center text-xs text-blue-600">
                        <span>Click to view sites</span>
                        <Building2 className="h-3 w-3 ml-1" />
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}