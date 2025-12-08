import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Users, Plus, MapPin, Clock, Edit, Trash2, Camera, Upload, X, Eye, EyeOff } from 'lucide-react';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';

import { getAuthToken } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
// Supabase Storage upload - using direct FormData instead of Uppy

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
  isRemote: z.boolean().optional(),
});

const editEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  siteId: z.string().optional(),
  isRemote: z.boolean().optional(),
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
      isRemote: false,
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
      isRemote: false,
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
      const payload = {
        ...data,
        departmentId: data.departmentId && data.departmentId !== 'none' ? parseInt(data.departmentId) : null,
        siteId: data.siteId && data.siteId !== 'none' ? parseInt(data.siteId) : null,
        phone: data.phone || undefined,
        employeeId: data.employeeId || undefined,
        isRemote: data.isRemote || false,
      };
      // Sending employee creation request
      return await apiRequest('POST', '/api/admin/employees', payload);
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
      const payload = {
        ...data,
        departmentId: data.departmentId && data.departmentId !== 'none' ? parseInt(data.departmentId) : null,
        siteId: data.siteId && data.siteId !== 'none' ? parseInt(data.siteId) : null,
        phone: data.phone || undefined,
        isRemote: data.isRemote || false,
      };
      // Sending employee update request
      return await apiRequest('PUT', `/api/admin/employees/${id}`, payload);
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
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete employee.",
        variant: "destructive",
      });
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createDepartmentSchema>) => {
      return await apiRequest('POST', '/api/admin/departments', data);
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
      // Update employee record with Supabase image URL
      const response = await fetch(`/api/admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profileImage: imageURL }),
      });
      if (!response.ok) throw new Error('Failed to update employee profile image');
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Profile image updated successfully
      toast({
        title: "Success",
        description: "Profile image uploaded successfully.",
      });
      // Invalidate all employee queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees', variables.employeeId] });
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
        const text = await response.text();
        let errorData: any = { message: 'Failed to get upload parameters' };
        try { errorData = JSON.parse(text); } catch {}
        throw new Error(errorData.message || 'Failed to get upload parameters');
      }
      
      const { uploadURL } = await response.json();
      // Upload parameters received
      
      // Ensure URL is absolute (add base URL if relative)
      const fullURL = uploadURL.startsWith('http') 
        ? uploadURL 
        : `${window.location.origin}${uploadURL}`;
      
      return {
        method: 'PUT' as const,
        url: fullURL,
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        }
      };
    } catch (error) {
      throw error;
    }
  };

  const handleUploadComplete = (result: any) => {
    if (result.successful && result.successful.length > 0 && imageDialogEmployee) {
      const uploadedFile = result.successful[0];
      
      // Extract imageURL from multiple possible locations
      const imageURL = uploadedFile.uploadURL || 
                       (uploadedFile.response as any)?.body?.uploadURL || 
                       (uploadedFile.response as any)?.body?.url ||
                       (uploadedFile.response as any)?.uploadURL || 
                       (uploadedFile as any).url;
      
      if (imageURL && imageDialogEmployee) {
        uploadEmployeeImageMutation.mutate({ 
          employeeId: imageDialogEmployee.id, 
          imageURL 
        });
      } else {
        toast({
          title: "Upload Error",
          description: "Image uploaded but URL not found. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Upload Failed",
        description: "Image upload was not successful. Please try again.",
        variant: "destructive",
      });
    }
  };

  // NEW: Direct FormData upload to Supabase Storage
  const handleProfileImageUpload = async (file: File) => {
    try {
      // Uploading to Supabase Storage
      
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch('/api/upload', {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image to Supabase');
      }

      const data = await response.json();
      // Image uploaded successfully

      if (data.profileImage && imageDialogEmployee) {
        uploadEmployeeImageMutation.mutate({
          employeeId: imageDialogEmployee.id,
          imageURL: data.profileImage,
        });
      } else {
        throw new Error('No profile image URL returned from upload');
      }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image. Please try again.",
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
    editEmployeeForm.setValue('isRemote', employee.isRemote || false);
  };

  if (employeesLoading || departmentsLoading) {
    return (
      <div className="container mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-slate-800 rounded border-2 border-slate-300 dark:border-slate-600"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-9 px-2 sm:px-3">
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <Users className="h-4 w-4 sm:h-6 sm:w-6 md:h-7 md:w-7 mr-2 sm:mr-3 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">Employee Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 ml-6 sm:ml-9 hidden sm:block">Manage your workforce and departments</p>
            </div>
          </div>
          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <Dialog open={isCreateDepartmentOpen} onOpenChange={setIsCreateDepartmentOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <DialogHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-4 -mx-4 -mt-4 mb-4 border-b border-blue-200 dark:border-blue-800">
                <DialogTitle className="text-blue-900 dark:text-blue-100 font-bold flex items-center gap-2">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  Create New Department
                </DialogTitle>
                <DialogDescription className="text-blue-700 dark:text-blue-300 mt-1">
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
                        <FormLabel className="text-slate-900 dark:text-slate-100">Department Name</FormLabel>
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
                        <FormLabel className="text-slate-900 dark:text-slate-100">Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter department description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-3 sm:p-4 -mx-4 -mb-4 border-t border-blue-200 dark:border-blue-800 mt-4 flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button 
                      type="submit" 
                      disabled={createDepartmentMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                    >
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
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mx-2 sm:mx-auto">
              <DialogHeader className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 rounded-lg p-3 sm:p-4 -mx-4 -mt-4 mb-3 sm:mb-4 border-b border-green-200 dark:border-green-800">
                <DialogTitle className="text-green-900 dark:text-green-100 font-bold flex items-center gap-2 text-sm sm:text-base">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-2">
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  Create New Employee
                </DialogTitle>
                <DialogDescription className="text-green-700 dark:text-green-300 mt-1 text-xs sm:text-sm">
                  Add a new employee to your workforce.
                </DialogDescription>
              </DialogHeader>
              <Form {...createEmployeeForm}>
                <form onSubmit={createEmployeeForm.handleSubmit((data) => createEmployeeMutation.mutate(data))} className="space-y-4 sm:space-y-6 px-1 sm:px-0">
                  
                  {/* Employee ID */}
                  <FormField
                    control={createEmployeeForm.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-900 dark:text-slate-100">Employee ID</FormLabel>
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
                          <FormLabel className="text-slate-900 dark:text-slate-100">First Name</FormLabel>
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
                          <FormLabel className="text-slate-900 dark:text-slate-100">Last Name</FormLabel>
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
                        <FormLabel className="text-slate-900 dark:text-slate-100">Email</FormLabel>
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
                        <FormLabel className="text-slate-900 dark:text-slate-100">Phone Number</FormLabel>
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
                        <FormLabel className="text-slate-900 dark:text-slate-100">Password</FormLabel>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <FormField
                      control={createEmployeeForm.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-100">Department</FormLabel>
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
                          <FormLabel className="text-slate-900 dark:text-slate-100">Work Site Assignment</FormLabel>
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

                  <DialogFooter className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 rounded-lg p-3 sm:p-4 -mx-4 -mb-4 border-t border-green-200 dark:border-green-800 mt-4 flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateEmployeeOpen(false);
                        createEmployeeForm.reset();
                      }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700 w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createEmployeeMutation.isPending}
                      className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md w-full sm:w-auto"
                    >
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
        <Card className="mb-6 border-2 border-slate-300 dark:border-slate-600 shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border-b-2 border-slate-300 dark:border-slate-600">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
              Departments ({departments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-3">
              {departments.map((dept: Department) => (
                <Badge 
                  key={dept.id} 
                  variant="outline" 
                  className="px-4 py-2 text-sm bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border-2 border-slate-300 dark:border-slate-600 text-blue-900 dark:text-blue-300 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/50 dark:hover:to-purple-900/50 transition-all cursor-default shadow-sm"
                >
                  <Users className="h-3 w-3 mr-2" />
                  <span className="font-semibold">{dept.name}</span>
                  {dept.description && (
                    <span className="ml-2 text-blue-700 dark:text-blue-400">- {dept.description}</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employees Grid */}


      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((employee: Employee) => (
          <Card key={employee.id} className="hover:shadow-xl transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-md overflow-hidden group bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
            <CardHeader className="pb-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/30 dark:to-purple-900/30 border-b-2 border-slate-300 dark:border-slate-600">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="relative">
                    <AuthenticatedImage
                      src={employee.profileImage}
                      alt={`${employee.firstName} ${employee.lastName}`}
                      className="w-16 h-16 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800 group-hover:ring-blue-400 dark:group-hover:ring-blue-600 transition-all"
                      fallback={
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800 group-hover:ring-blue-400 dark:group-hover:ring-blue-600 transition-all">
                          <span className="text-white font-bold text-xl">{employee.firstName[0]}{employee.lastName[0]}</span>
                        </div>
                      }
                    />
                    <Dialog open={imageDialogEmployee?.id === employee.id} onOpenChange={(open) => !open && setImageDialogEmployee(null)}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="absolute -bottom-1 -right-1 rounded-full w-7 h-7 p-0 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md border-2 border-white dark:border-slate-800"
                          onClick={() => setImageDialogEmployee(employee)}
                        >
                          <Camera className="h-3.5 w-3.5 text-white" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[95vw] sm:w-full sm:max-w-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mx-2 sm:mx-auto">
                        <DialogHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-3 sm:p-4 -mx-4 -mt-4 mb-3 sm:mb-4 border-b border-blue-200 dark:border-blue-800">
                          <DialogTitle className="text-blue-900 dark:text-blue-100 font-bold flex items-center gap-2 text-sm sm:text-base">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2">
                              <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            Employee Profile Image
                          </DialogTitle>
                          <DialogDescription className="text-blue-700 dark:text-blue-300 mt-1 text-xs sm:text-sm">
                            Upload a new profile image for {employee.firstName} {employee.lastName} or remove the current one.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {employee.profileImage && (
                            <div className="flex justify-center mb-4">
                              <div className="relative">
                                <AuthenticatedImage
                                  src={employee.profileImage}
                                  alt={`${employee.firstName} ${employee.lastName}`}
                                  className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-xl ring-4 ring-blue-200 dark:ring-blue-800"
                                  fallback={
                                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-xl ring-4 ring-blue-200 dark:ring-blue-800">
                                      <span className="text-white font-bold text-2xl">
                                        {employee.firstName[0]}{employee.lastName[0]}
                                      </span>
                                    </div>
                                  }
                                />
                              </div>
                            </div>
                          )}
                          <Button
                            variant="default"
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = async (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  await handleProfileImageUpload(file);
                                }
                              };
                              input.click();
                            }}
                            disabled={uploadEmployeeImageMutation.isPending}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadEmployeeImageMutation.isPending ? 'Uploading...' : 'Upload New Image'}
                          </Button>
                          {employee.profileImage && (
                            <Button
                              variant="destructive"
                              onClick={() => removeEmployeeImageMutation.mutate(employee.id)}
                              disabled={removeEmployeeImageMutation.isPending}
                              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-md"
                            >
                              <X className="h-4 w-4 mr-2" />
                              {removeEmployeeImageMutation.isPending ? 'Removing...' : 'Remove Image'}
                            </Button>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {employee.firstName} {employee.lastName}
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{employee.email}</p>
                  </div>
                </div>
                <Badge 
                  variant={employee.isActive ? "default" : "secondary"}
                  className={employee.isActive 
                    ? "bg-gradient-to-r from-green-500 to-green-600 text-white border-0 shadow-sm" 
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-0"
                  }
                >
                  {employee.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center text-sm text-slate-700 dark:text-slate-300 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg px-3 py-2 border-2 border-slate-300 dark:border-slate-600">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mr-3">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium">{getDepartmentName(employee.departmentId)}</span>
              </div>
              <div className="flex items-center text-sm text-slate-700 dark:text-slate-300 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg px-3 py-2 border-2 border-slate-300 dark:border-slate-600">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mr-3">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium truncate">{getSiteName(employee.siteId)}</span>
              </div>
              <div className="flex items-center text-sm text-slate-700 dark:text-slate-300 bg-orange-50/50 dark:bg-orange-900/20 rounded-lg px-3 py-2 border-2 border-slate-300 dark:border-slate-600">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mr-3">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium">Joined {new Date(employee.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t-2 border-slate-300 dark:border-slate-600">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditEmployee(employee)}
                  className="hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteEmployeeMutation.mutate(employee.id)}
                  disabled={deleteEmployeeMutation.isPending}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-200 dark:hover:border-red-700 border-slate-200 dark:border-slate-700 transition-all"
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
        <Card className="text-center py-12 border-2 border-dashed border-slate-300 dark:border-slate-600 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
          <CardContent>
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-purple-100 rounded-full flex items-center justify-center">
              <Users className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No Employees Yet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Get started by adding your first employee to the system.</p>
            <Button 
              onClick={() => setIsCreateEmployeeOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Employee
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Employee Dialog */}
      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mx-2 sm:mx-auto">
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-3 sm:p-4 -mx-4 -mt-4 mb-3 sm:mb-4 border-b border-blue-200 dark:border-blue-800">
            <DialogTitle className="text-blue-900 dark:text-blue-100 font-bold flex items-center gap-2 text-sm sm:text-base">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2">
                <Edit className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              Edit Employee
            </DialogTitle>
            <DialogDescription className="text-blue-700 dark:text-blue-300 mt-1 text-xs sm:text-sm">
              Update employee information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editEmployeeForm}>
            <form onSubmit={editEmployeeForm.handleSubmit((data) => 
              editingEmployee && updateEmployeeMutation.mutate({ id: editingEmployee.id, data })
            )} className="space-y-4 sm:space-y-6 px-1 sm:px-0">
              
              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={editEmployeeForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-900 dark:text-slate-100">First Name</FormLabel>
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
                      <FormLabel className="text-slate-900 dark:text-slate-100">Last Name</FormLabel>
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
                    <FormLabel className="text-slate-900 dark:text-slate-100">Email</FormLabel>
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
                    <FormLabel className="text-slate-900 dark:text-slate-100">Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assignment Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={editEmployeeForm.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-900 dark:text-slate-100">Department</FormLabel>
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
                      <FormLabel className="text-slate-900 dark:text-slate-100">Work Site Assignment</FormLabel>
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

              {/* Remote Work Toggle */}
              <FormField
                control={editEmployeeForm.control}
                name="isRemote"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50">
                    <div className="space-y-0.5 flex-1 pr-2">
                      <FormLabel className="text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Remote Work
                      </FormLabel>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        Allow this employee to check in from anywhere
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="flex-shrink-0"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-3 sm:p-4 -mx-4 -mb-4 border-t border-blue-200 dark:border-blue-800 mt-4 flex-col sm:flex-row gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingEmployee(null)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700 w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateEmployeeMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md w-full sm:w-auto"
                >
                  {updateEmployeeMutation.isPending ? 'Updating...' : 'Update Employee'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}