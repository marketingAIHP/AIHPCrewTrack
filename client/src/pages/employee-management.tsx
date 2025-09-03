import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Users, Plus, MapPin, Clock, Edit, Trash2, Camera, Upload, X, Eye, EyeOff } from 'lucide-react';
import { AdaptiveImage } from '../components/AdaptiveImage';
import { CompressedImagePreview } from '../components/CompressedImagePreview';
import { getAuthToken } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { ObjectUploader } from '@/components/ObjectUploader';
import type { UploadResult } from '@uppy/core';

interface Employee {
  id: number;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId?: number;
  siteId?: number;
  profileImage?: string;
  isActive: boolean;
  createdAt: string;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

// Form schemas
const createEmployeeSchema = z.object({
  employeeId: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      "Password must contain letters, numbers, and special characters"),
  departmentId: z.string().optional(),
  siteId: z.string().optional(),
});

const editEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  siteId: z.string().optional(),
});

const createDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
});

export default function EmployeeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [isCreateDepartmentOpen, setIsCreateDepartmentOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [imageDialogEmployee, setImageDialogEmployee] = useState<Employee | null>(null);
  const isAuthenticated = !!getAuthToken();

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/admin/employees'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/employees`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch employees');
      return response.json();
    },
  });

  // Fetch departments
  const { data: departments = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['/api/admin/departments'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/departments`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch departments');
      return response.json();
    },
  });

  // Fetch work sites
  const { data: workSites = [], isLoading: workSitesLoading } = useQuery({
    queryKey: ['/api/admin/sites'],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Forms
  const createEmployeeForm = useForm<z.infer<typeof createEmployeeSchema>>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      employeeId: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      departmentId: 'none',
      siteId: 'none',
    },
  });

  const editEmployeeForm = useForm<z.infer<typeof editEmployeeSchema>>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      departmentId: 'none',
      siteId: 'none',
    },
  });

  const createDepartmentForm = useForm<z.infer<typeof createDepartmentSchema>>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Mutations
  const createEmployeeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createEmployeeSchema>) => {
      return await apiRequest('/api/admin/employees', 'POST', {
        ...data,
        departmentId: data.departmentId && data.departmentId !== 'none' ? parseInt(data.departmentId) : undefined,
        siteId: data.siteId && data.siteId !== 'none' ? parseInt(data.siteId) : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Employee Created",
        description: "New employee has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
      setIsCreateEmployeeOpen(false);
      createEmployeeForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create employee.",
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof editEmployeeSchema> }) => {
      return await apiRequest(`/api/admin/employees/${id}`, 'PUT', {
        ...data,
        departmentId: data.departmentId && data.departmentId !== 'none' ? parseInt(data.departmentId) : undefined,
        siteId: data.siteId && data.siteId !== 'none' ? parseInt(data.siteId) : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Employee Updated",
        description: "Employee information has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
      setEditingEmployee(null);
      editEmployeeForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update employee.",
        variant: "destructive",
      });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const response = await fetch(`/api/admin/employees/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to delete employee' }));
          throw new Error(errorData.message || 'Failed to delete employee');
        }
        
        // For 204 No Content responses, we don't need to parse JSON
        if (response.status === 204) {
          return { success: true };
        }
        
        return await response.json();
      } catch (error: any) {
        console.error('Delete employee error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Employee Deleted",
        description: "Employee has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
    },
    onError: (error: any) => {
      console.error('Delete employee mutation error:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete employee.",
        variant: "destructive",
      });
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createDepartmentSchema>) => {
      return await apiRequest('/api/admin/departments', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "Department Created",
        description: "New department has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/departments'] });
      setIsCreateDepartmentOpen(false);
      createDepartmentForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create department.",
        variant: "destructive",
      });
    },
  });

  // Profile image mutations
  const uploadEmployeeImageMutation = useMutation({
    mutationFn: async ({ employeeId, imageURL }: { employeeId: number; imageURL: string }) => {
      const response = await fetch(`/api/admin/employees/${employeeId}/profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageURL }),
      });
      if (!response.ok) throw new Error('Failed to upload image');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Image Uploaded",
        description: "Employee profile image has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
      setImageDialogEmployee(null);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload profile image.",
        variant: "destructive",
      });
    },
  });

  const removeEmployeeImageMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const response = await fetch(`/api/admin/employees/${employeeId}/profile-image`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to remove image');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Image Removed",
        description: "Employee profile image has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
      setImageDialogEmployee(null);
    },
    onError: (error: any) => {
      toast({
        title: "Removal Failed",
        description: error.message || "Failed to remove profile image.",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const handleGetUploadParameters = async () => {
    try {
      const response = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to get upload parameters' }));
        throw new Error(errorData.message || 'Failed to get upload parameters');
      }
      
      const { uploadURL } = await response.json();
      console.log('Got upload parameters:', { uploadURL });
      
      return {
        method: 'PUT' as const,
        url: uploadURL,
      };
    } catch (error) {
      console.error('Upload parameters error:', error);
      throw error;
    }
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    console.log('Upload complete result:', result);
    if (result.successful && result.successful.length > 0 && imageDialogEmployee) {
      const uploadedFile = result.successful[0];
      console.log('Uploaded file details:', uploadedFile);
      
      // Try multiple possible fields for the upload URL
      const imageURL = uploadedFile.uploadURL || (uploadedFile.response as any)?.uploadURL || (uploadedFile as any).url;
      
      if (imageURL) {
        uploadEmployeeImageMutation.mutate({
          employeeId: imageDialogEmployee.id,
          imageURL: imageURL,
        });
      } else {
        console.error('No upload URL found in result:', uploadedFile);
        toast({
          title: "Upload Error",
          description: "Image uploaded but URL not found. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      console.error('Upload failed or no employee selected:', { result, imageDialogEmployee });
      toast({
        title: "Upload Failed",
        description: "Image upload was not successful. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getDepartmentName = (departmentId?: number) => {
    if (!departmentId) return 'No Department';
    const department = departments.find((d: Department) => d.id === departmentId);
    return department?.name || 'Unknown Department';
  };

  const getSiteName = (siteId?: number) => {
    if (!siteId) return 'No Site Assigned';
    const site = Array.isArray(workSites) ? workSites.find((s: any) => s.id === siteId) : null;
    return site?.name || 'Unknown Site';
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    editEmployeeForm.setValue('firstName', employee.firstName);
    editEmployeeForm.setValue('lastName', employee.lastName);
    editEmployeeForm.setValue('email', employee.email);
    editEmployeeForm.setValue('phone', employee.phone || '');
    editEmployeeForm.setValue('departmentId', employee.departmentId?.toString() || 'none');
    editEmployeeForm.setValue('siteId', employee.siteId?.toString() || 'none');
  };

  if (employeesLoading || departmentsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
        <div className="flex items-center">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mr-2 sm:mr-4">
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
            <span className="hidden sm:inline">Employee Management</span>
            <span className="sm:hidden">Employees</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDepartmentOpen} onOpenChange={setIsCreateDepartmentOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Department</DialogTitle>
                <DialogDescription>
                  Add a new department to organize your employees.
                </DialogDescription>
              </DialogHeader>
              <Form {...createDepartmentForm}>
                <form onSubmit={createDepartmentForm.handleSubmit((data) => createDepartmentMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={createDepartmentForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter department name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createDepartmentForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter department description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createDepartmentMutation.isPending}>
                      {createDepartmentMutation.isPending ? 'Creating...' : 'Create Department'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateEmployeeOpen} onOpenChange={(open) => {
            setIsCreateEmployeeOpen(open);
            if (!open) {
              createEmployeeForm.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Employee</DialogTitle>
                <DialogDescription>
                  Add a new employee to your workforce.
                </DialogDescription>
              </DialogHeader>
              <Form {...createEmployeeForm}>
                <form onSubmit={createEmployeeForm.handleSubmit((data) => createEmployeeMutation.mutate(data))} className="space-y-6">
                  
                  {/* Employee ID */}
                  <FormField
                    control={createEmployeeForm.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID</FormLabel>
                        <FormControl>
                          <Input placeholder="EMP001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={createEmployeeForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createEmployeeForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Contact Information */}
                  <FormField
                    control={createEmployeeForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john.doe@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createEmployeeForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password */}
                  <FormField
                    control={createEmployeeForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"} 
                              placeholder="Enter password" 
                              {...field} 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Assignment Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={createEmployeeForm.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Department</SelectItem>
                              {departments.map((dept: Department) => (
                                <SelectItem key={dept.id} value={dept.id.toString()}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createEmployeeForm.control}
                      name="siteId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Site Assignment</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select work site" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Site Assignment</SelectItem>
                              {Array.isArray(workSites) && workSites.length > 0 ? (
                                workSites.map((site: any) => (
                                  <SelectItem key={site.id} value={site.id.toString()}>
                                    {site.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="loading" disabled>
                                  {workSitesLoading ? 'Loading sites...' : 'No work sites available'}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => {
                      setIsCreateEmployeeOpen(false);
                      createEmployeeForm.reset();
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createEmployeeMutation.isPending}>
                      {createEmployeeMutation.isPending ? 'Creating...' : 'Create Employee'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Departments Section */}
      {departments.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Departments ({departments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {departments.map((dept: Department) => (
                <Badge key={dept.id} variant="outline" className="text-sm">
                  {dept.name}
                  {dept.description && (
                    <span className="ml-1 text-gray-500">- {dept.description}</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((employee: Employee) => (
          <Card key={employee.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    {employee.profileImage ? (
                      <AdaptiveImage
                        src={employee.profileImage}
                        alt={`${employee.firstName} ${employee.lastName}`}
                        className="w-12 h-12 rounded-full object-cover"
                        sizes="thumbnail"
                        fallback={
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-bold">
                              {employee.firstName[0]}{employee.lastName[0]}
                            </span>
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </span>
                      </div>
                    )}
                    <Dialog open={imageDialogEmployee?.id === employee.id} onOpenChange={(open) => !open && setImageDialogEmployee(null)}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="absolute -bottom-1 -right-1 rounded-full w-6 h-6 p-0"
                          onClick={() => setImageDialogEmployee(employee)}
                        >
                          <Camera className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Employee Profile Image</DialogTitle>
                          <DialogDescription>
                            Upload a new profile image for {employee.firstName} {employee.lastName} or remove the current one.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {employee.profileImage && (
                            <div className="flex justify-center mb-4">
                              <CompressedImagePreview
                                src={employee.profileImage}
                                alt={`${employee.firstName} ${employee.lastName}`}
                                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                                showCompressionInfo={true}
                                fallback={
                                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-600 font-bold text-lg">
                                      {employee.firstName[0]}{employee.lastName[0]}
                                    </span>
                                  </div>
                                }
                              />
                            </div>
                          )}
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={5242880} // 5MB
                            allowedFileTypes={["image/*"]}
                            onGetUploadParameters={handleGetUploadParameters}
                            onComplete={handleUploadComplete}
                            buttonClassName="w-full"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadEmployeeImageMutation.isPending ? 'Processing & Compressing...' : 'Upload & Compress Image'}
                          </ObjectUploader>
                          {employee.profileImage && (
                            <Button
                              variant="destructive"
                              onClick={() => removeEmployeeImageMutation.mutate(employee.id)}
                              disabled={removeEmployeeImageMutation.isPending}
                              className="w-full"
                            >
                              <X className="h-4 w-4 mr-2" />
                              {removeEmployeeImageMutation.isPending ? 'Removing...' : 'Remove Image'}
                            </Button>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{employee.firstName} {employee.lastName}</CardTitle>
                    <p className="text-sm text-gray-600">{employee.email}</p>
                  </div>
                </div>
                <Badge variant={employee.isActive ? "default" : "secondary"}>
                  {employee.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <Users className="h-4 w-4 mr-2" />
                {getDepartmentName(employee.departmentId)}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-4 w-4 mr-2" />
                {getSiteName(employee.siteId)}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="h-4 w-4 mr-2" />
                Joined {new Date(employee.createdAt).toLocaleDateString()}
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditEmployee(employee)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteEmployeeMutation.mutate(employee.id)}
                  disabled={deleteEmployeeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {employees.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Employees Yet</h3>
            <p className="text-gray-600 mb-4">Get started by adding your first employee to the system.</p>
            <Button onClick={() => setIsCreateEmployeeOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Employee
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Employee Dialog */}
      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editEmployeeForm}>
            <form onSubmit={editEmployeeForm.handleSubmit((data) => 
              editingEmployee && updateEmployeeMutation.mutate({ id: editingEmployee.id, data })
            )} className="space-y-6">
              
              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editEmployeeForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter first name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editEmployeeForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact Information */}
              <FormField
                control={editEmployeeForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editEmployeeForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assignment Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editEmployeeForm.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Department</SelectItem>
                          {departments.map((dept: Department) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editEmployeeForm.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Site Assignment</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select work site" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Site Assignment</SelectItem>
                          {Array.isArray(workSites) && workSites.map((site: any) => (
                            <SelectItem key={site.id} value={site.id.toString()}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingEmployee(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateEmployeeMutation.isPending}>
                  {updateEmployeeMutation.isPending ? 'Updating...' : 'Update Employee'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}