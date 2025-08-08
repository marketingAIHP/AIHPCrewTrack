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

  const { data: areas = [], isLoading: loadingAreas } = useQuery<any[]>({
    queryKey: ['/api/admin/areas'],
    enabled: !!getAuthToken(),
  });

  const { data: sites = [], isLoading: loadingSites } = useQuery<any[]>({
    queryKey: ['/api/admin/sites'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
  });

  const { data: employees = [] } = useQuery<any[]>({
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save area',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: SiteForm) => {
    createSiteMutation.mutate(data);
  };

  const onAreaSubmit = (data: AreaForm) => {
    createAreaMutation.mutate(data);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    form.setValue('latitude', lat.toString());
    form.setValue('longitude', lng.toString());
  };

  const getEmployeeCount = (siteId: number) => {
    return employees.filter((emp: any) => emp.siteId === siteId).length;
  };

  const getCurrentlyOnSite = (siteId: number) => {
    // This would normally come from attendance data
    // For now, we'll return a placeholder
    return Math.floor(Math.random() * getEmployeeCount(siteId));
  };

  const handleViewSiteMap = (site: any) => {
    // Navigate to live tracking focused on this site
    setLocation(`/admin/tracking?siteId=${site.id}`);
  };

  const handleEditSite = (site: any) => {
    // Set editing mode and populate form with site data
    setEditingSite(site);
    form.setValue('name', site.name);
    form.setValue('address', site.address);
    setSiteImageURL(site.siteImage || '');
    form.setValue('latitude', site.latitude.toString());
    form.setValue('longitude', site.longitude.toString());
    form.setValue('geofenceRadius', site.geofenceRadius.toString());
    form.setValue('areaId', site.areaId ? site.areaId.toString() : 'none');
    setSelectedLocation({ lat: parseFloat(site.latitude), lng: parseFloat(site.longitude) });
    setIsDialogOpen(true);
    
    toast({
      title: 'Edit Mode',
      description: `Editing ${site.name}`,
    });
  };

  const handleEditArea = (area: any) => {
    setEditingArea(area);
    areaForm.reset({
      name: area.name,
      description: area.description || '',
    });
    setIsAreaDialogOpen(true);
  };

  const handleAddArea = () => {
    setEditingArea(null);
    areaForm.reset();
    setIsAreaDialogOpen(true);
  };

  const handleAddSite = () => {
    setEditingSite(null);
    form.reset();
    setSelectedLocation({ lat: 40.7128, lng: -74.0060 });
    setSiteImageURL('');
    setIsDialogOpen(true);
  };

  // Image upload handlers
  const handleGetUploadParameters = async () => {
    const response = await apiRequest('POST', '/api/objects/upload');
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      try {
        const response = await apiRequest('POST', '/api/admin/site-image', {
          imageURL: uploadedFile.uploadURL
        });
        const data = await response.json();
        setSiteImageURL(data.siteImage);
        toast({
          title: 'Success',
          description: 'Site image uploaded successfully',
        });
      } catch (error) {
        console.error('Error processing site image:', error);
        toast({
          title: 'Error',
          description: 'Failed to process site image',
          variant: 'destructive',
        });
      }
    }
  };

  const deleteSiteMutation = useMutation({
    mutationFn: async (siteId: number) => {
      return apiRequest('DELETE', `/api/admin/sites/${siteId}`);
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

  const handleDeleteSite = (site: any) => {
    const employeeCount = getEmployeeCount(site.id);
    
    if (employeeCount > 0) {
      toast({
        title: 'Cannot Delete Site',
        description: `This site has ${employeeCount} assigned employees. Please reassign them first.`,
        variant: 'destructive',
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${site.name}"? This action cannot be undone.`)) {
      deleteSiteMutation.mutate(site.id);
    }
  };

  const deleteAreaMutation = useMutation({
    mutationFn: async (areaId: number) => {
      return apiRequest('DELETE', `/api/admin/areas/${areaId}`);
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

  const handleDeleteArea = (area: any) => {
    const areaSites = sites.filter((site: any) => site.areaId === area.id);
    
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
              {selectedAreaView && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedAreaView(null)}
                  className="flex items-center mr-4"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Areas
                </Button>
              )}
              <h1 className="text-xl font-semibold text-gray-900">
                {selectedAreaView ? `${selectedAreaView.name} - Sites` : 'Areas & Sites Management'}
              </h1>
            </div>

            
            {selectedAreaView && (
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingSite(null);
                  form.reset();
                  setSelectedLocation({ lat: 40.7128, lng: -74.0060 });
                  setSiteImageURL('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-primary hover:bg-blue-700 text-white" 
                    onClick={() => {
                      handleAddSite();
                      // Pre-select this area in the form
                      form.setValue('areaId', selectedAreaView.id.toString());
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Site to {selectedAreaView.name}
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingSite ? 'Edit Work Site' : 'Add New Work Site'}</DialogTitle>
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
                        {areas.map((area: any) => (
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
                  
                  {/* Site Image Upload Section */}
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
                      maxFileSize={10485760} // 10MB
                      allowedFileTypes={['image/*']}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="w-full"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Camera className="h-4 w-4" />
                        <span>{siteImageURL ? 'Change Site Image' : 'Upload Site Image'}</span>
                      </div>
                    </ObjectUploader>
                    <p className="text-xs text-gray-500 mt-1">
                      Upload a clear image of the work site. Supported formats: JPG, PNG. Max size: 10MB.
                    </p>
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
                              position: selectedLocation,
                              title: 'Selected Location',
                              color: 'red',
                            },
                          ]}
                          geofences={[
                            {
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedAreaView ? (
          /* Selected Area Sites View */
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{selectedAreaView.name}</h2>
                {selectedAreaView.description && (
                  <p className="text-gray-600 mt-1">{selectedAreaView.description}</p>
                )}
              </div>

            </div>
            
            {/* Sites in Selected Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sites.filter((site: any) => site.areaId === selectedAreaView.id).length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">No sites in this area yet</p>
                  <p className="text-sm text-gray-400">Add the first site to get started</p>
                </div>
              ) : (
                sites.filter((site: any) => site.areaId === selectedAreaView.id).map((site: any) => (
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
                        <Button 
                          className="flex-1 bg-primary text-white hover:bg-blue-700"
                          onClick={() => handleViewSiteMap(site)}
                        >
                          <MapPin className="mr-2 h-4 w-4" />
                          View Map
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditSite(site)}
                        >
                          <Edit className="h-4 w-4" />
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
            {/* Areas Management Section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Area Management</h2>
            <Dialog open={isAreaDialogOpen} onOpenChange={(open) => {
              setIsAreaDialogOpen(open);
              if (!open) {
                setEditingArea(null);
                areaForm.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={handleAddArea}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Area
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingArea ? 'Edit Area' : 'Add New Area'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={areaForm.handleSubmit(onAreaSubmit)} className="space-y-4">
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
                      placeholder="Description of the area..."
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
          
          {/* Areas List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {loadingAreas ? (
              <div className="col-span-full text-center py-4">
                <p>Loading areas...</p>
              </div>
            ) : areas.length === 0 ? (
              <div className="col-span-full text-center py-4">
                <p className="text-gray-500">No areas created yet</p>
                <p className="text-sm text-gray-400">Areas help organize your work sites</p>
              </div>
            ) : (
              areas.map((area: any) => (
                <Card key={area.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">{area.name}</h3>
                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedAreaView(area)}
                        title="View sites in this area"
                      >
                        <Building2 className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditArea(area)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteArea(area)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {area.description && (
                    <p className="text-sm text-gray-600 mb-2">{area.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mb-3">
                    {sites.filter((site: any) => site.areaId === area.id).length} sites
                  </p>
                  

                </Card>
              ))
            )}
          </div>
        </div>


          </div>
        )}
      </main>
    </div>
  );
}
