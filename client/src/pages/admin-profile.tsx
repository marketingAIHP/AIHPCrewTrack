import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Mail, Calendar, Settings, Shield, Eye, EyeOff, Camera, Upload, X } from 'lucide-react';
import { ObjectUploader } from '@/components/ObjectUploader';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import type { UploadResult } from '@uppy/core';
import { getAuthToken, getUser } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface Admin {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string;
  createdAt: string;
}

// Form schemas
const editProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
});

const securitySchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      "Password must contain letters, numbers, and special characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  attendanceAlerts: z.boolean(),
  securityAlerts: z.boolean(),
  systemUpdates: z.boolean(),
});

export default function AdminProfile() {
  const currentUser = getUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [profileImageModalOpen, setProfileImageModalOpen] = useState(false);

  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ['/api/admin/profile'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/profile`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch admin profile');
      return response.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/admin/dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  // Form configurations
  const editProfileForm = useForm({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: admin?.firstName || '',
      lastName: admin?.lastName || '',
      email: admin?.email || '',
    },
  });

  const securityForm = useForm({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const notificationForm = useForm({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      attendanceAlerts: true,
      securityAlerts: true,
      systemUpdates: false,
    },
  });

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editProfileSchema>) => {
      const response = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profile'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof securitySchema>) => {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      if (!response.ok) throw new Error('Failed to change password');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed.",
      });
      securityForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password.",
        variant: "destructive",
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof notificationSchema>) => {
      const response = await fetch('/api/admin/notification-preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update notification preferences');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update notification preferences.",
        variant: "destructive",
      });
    },
  });

  // Profile image mutations
  const uploadImageMutation = useMutation({
    mutationFn: async (imageURL: string) => {
      const response = await fetch('/api/admin/profile-image', {
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
        description: "Your profile image has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profile'] });
      setIsImageDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload profile image.",
        variant: "destructive",
      });
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/profile-image', {
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
        description: "Your profile image has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profile'] });
    },
    onError: (error: any) => {
      toast({
        title: "Removal Failed",
        description: error.message || "Failed to remove profile image.",
        variant: "destructive",
      });
    },
  });

  // Helper functions for image handling
  const handleGetUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get upload parameters');
    const { uploadURL } = await response.json();
    return {
      method: 'PUT' as const,
      url: uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      if (uploadedFile.uploadURL) {
        uploadImageMutation.mutate(uploadedFile.uploadURL);
      }
    }
  };

  // Update form defaults when admin data loads
  if (admin && !editProfileForm.formState.isDirty) {
    editProfileForm.setValue('firstName', admin.firstName);
    editProfileForm.setValue('lastName', admin.lastName);
    editProfileForm.setValue('email', admin.email);
  }

  if (adminLoading || !admin) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link href="/admin/dashboard">
          <Button variant="ghost" size="sm" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Admin Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <AuthenticatedImage
                  src={admin.profileImage}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    if (admin.profileImage) {
                      setProfileImageModalOpen(true);
                    }
                  }}
                  fallback={
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-2xl">
                        {admin.firstName[0]}{admin.lastName[0]}
                      </span>
                    </div>
                  }
                />
                <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="absolute -bottom-1 -right-1 rounded-full w-6 h-6 p-0"
                    >
                      <Camera className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Profile Image</DialogTitle>
                      <DialogDescription>
                        Upload a new profile image or remove the current one.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={5242880} // 5MB
                        allowedFileTypes={["image/*"]}
                        onGetUploadParameters={handleGetUploadParameters}
                        onComplete={handleUploadComplete}
                        buttonClassName="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadImageMutation.isPending ? 'Processing...' : 'Upload New Image'}
                      </ObjectUploader>
                      {admin.profileImage && (
                        <Button
                          variant="destructive"
                          onClick={() => removeImageMutation.mutate()}
                          disabled={removeImageMutation.isPending}
                          className="w-full"
                        >
                          <X className="h-4 w-4 mr-2" />
                          {removeImageMutation.isPending ? 'Removing...' : 'Remove Image'}
                        </Button>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <h3 className="text-xl font-semibold">{admin.firstName} {admin.lastName}</h3>
              <Badge className="bg-blue-100 text-blue-800 mt-2">
                <Shield className="h-3 w-3 mr-1" />
                Administrator
              </Badge>
            </div>
            
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-3 text-gray-500" />
                <span className="text-sm">{admin.email}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-3 text-gray-500" />
                <span className="text-sm">
                  Admin since {new Date(admin.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Statistics */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">System Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {stats?.activeEmployees || 0}
                        </div>
                        <div className="text-sm text-gray-600">Active Employees</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {stats?.workSites || 0}
                        </div>
                        <div className="text-sm text-gray-600">Work Sites</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {stats?.onSiteNow || 0}
                        </div>
                        <div className="text-sm text-gray-600">On Site Now</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {stats?.alerts || 0}
                        </div>
                        <div className="text-sm text-gray-600">Active Alerts</div>
                      </div>
                    </Card>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Link href="/admin/employees">
                        <Button variant="outline" className="w-full justify-start">
                          Manage Employees
                        </Button>
                      </Link>
                      <Link href="/admin/sites">
                        <Button variant="outline" className="w-full justify-start">
                          Manage Sites
                        </Button>
                      </Link>
                      <Link href="/admin/live-tracking">
                        <Button variant="outline" className="w-full justify-start">
                          Live Tracking
                        </Button>
                      </Link>
                      <Link href="/admin/active-employees">
                        <Button variant="outline" className="w-full justify-start">
                          View Employees
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Account Settings
                  </h3>
                  <div className="space-y-3">
                    <Card className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Account Information</h4>
                          <p className="text-sm text-gray-600">Update your profile details</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Edit Profile
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Profile</DialogTitle>
                              <DialogDescription>
                                Update your account information here.
                              </DialogDescription>
                            </DialogHeader>
                            <Form {...editProfileForm}>
                              <form onSubmit={editProfileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
                                <FormField
                                  control={editProfileForm.control}
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
                                  control={editProfileForm.control}
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
                                <FormField
                                  control={editProfileForm.control}
                                  name="email"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Email</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Enter email address" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <DialogFooter>
                                  <Button 
                                    type="submit" 
                                    disabled={updateProfileMutation.isPending}
                                  >
                                    {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </Card>
                    
                    <Card className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Security Settings</h4>
                          <p className="text-sm text-gray-600">Change password and security preferences</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Security
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Security Settings</DialogTitle>
                              <DialogDescription>
                                Change your password and security preferences.
                              </DialogDescription>
                            </DialogHeader>
                            <Form {...securityForm}>
                              <form onSubmit={securityForm.handleSubmit((data) => updatePasswordMutation.mutate(data))} className="space-y-4">
                                <FormField
                                  control={securityForm.control}
                                  name="currentPassword"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Current Password</FormLabel>
                                      <FormControl>
                                        <div className="relative">
                                          <Input 
                                            type={showCurrentPassword ? "text" : "password"}
                                            placeholder="Enter current password" 
                                            {...field} 
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                          >
                                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={securityForm.control}
                                  name="newPassword"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>New Password</FormLabel>
                                      <FormControl>
                                        <div className="relative">
                                          <Input 
                                            type={showNewPassword ? "text" : "password"}
                                            placeholder="Enter new password" 
                                            {...field} 
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                          >
                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={securityForm.control}
                                  name="confirmPassword"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Confirm New Password</FormLabel>
                                      <FormControl>
                                        <div className="relative">
                                          <Input 
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="Confirm new password" 
                                            {...field} 
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                          >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <DialogFooter>
                                  <Button 
                                    type="submit" 
                                    disabled={updatePasswordMutation.isPending}
                                  >
                                    {updatePasswordMutation.isPending ? "Updating..." : "Change Password"}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Notification Preferences</h4>
                          <p className="text-sm text-gray-600">Manage alerts and notifications</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Configure
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Notification Preferences</DialogTitle>
                              <DialogDescription>
                                Configure your notification settings and alert preferences.
                              </DialogDescription>
                            </DialogHeader>
                            <Form {...notificationForm}>
                              <form onSubmit={notificationForm.handleSubmit((data) => updateNotificationsMutation.mutate(data))} className="space-y-4">
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="text-sm font-medium mb-3">Communication Channels</h4>
                                    <div className="space-y-3">
                                      <FormField
                                        control={notificationForm.control}
                                        name="emailNotifications"
                                        render={({ field }) => (
                                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                            <div className="space-y-0.5">
                                              <FormLabel className="text-base">Email Notifications</FormLabel>
                                              <div className="text-sm text-muted-foreground">
                                                Receive notifications via email
                                              </div>
                                            </div>
                                            <FormControl>
                                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={notificationForm.control}
                                        name="pushNotifications"
                                        render={({ field }) => (
                                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                            <div className="space-y-0.5">
                                              <FormLabel className="text-base">Push Notifications</FormLabel>
                                              <div className="text-sm text-muted-foreground">
                                                Receive browser push notifications
                                              </div>
                                            </div>
                                            <FormControl>
                                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-sm font-medium mb-3">Alert Types</h4>
                                    <div className="space-y-3">
                                      <FormField
                                        control={notificationForm.control}
                                        name="attendanceAlerts"
                                        render={({ field }) => (
                                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                            <div className="space-y-0.5">
                                              <FormLabel className="text-base">Attendance Alerts</FormLabel>
                                              <div className="text-sm text-muted-foreground">
                                                Employee check-in/out notifications
                                              </div>
                                            </div>
                                            <FormControl>
                                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={notificationForm.control}
                                        name="securityAlerts"
                                        render={({ field }) => (
                                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                            <div className="space-y-0.5">
                                              <FormLabel className="text-base">Security Alerts</FormLabel>
                                              <div className="text-sm text-muted-foreground">
                                                Important security notifications
                                              </div>
                                            </div>
                                            <FormControl>
                                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={notificationForm.control}
                                        name="systemUpdates"
                                        render={({ field }) => (
                                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                            <div className="space-y-0.5">
                                              <FormLabel className="text-base">System Updates</FormLabel>
                                              <div className="text-sm text-muted-foreground">
                                                Platform updates and maintenance
                                              </div>
                                            </div>
                                            <FormControl>
                                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button 
                                    type="submit" 
                                    disabled={updateNotificationsMutation.isPending}
                                  >
                                    {updateNotificationsMutation.isPending ? "Saving..." : "Save Preferences"}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Profile Image Modal */}
      <Dialog open={profileImageModalOpen} onOpenChange={setProfileImageModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Profile Picture</DialogTitle>
            <DialogDescription>
              {admin?.firstName} {admin?.lastName}
            </DialogDescription>
          </DialogHeader>
          {admin?.profileImage && (
            <div className="flex justify-center p-4">
              <AuthenticatedImage
                src={admin.profileImage}
                alt={`${admin.firstName} ${admin.lastName}`}
                className="max-w-full max-h-96 object-contain rounded-lg"
                fallback={
                  <div className="w-96 h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">Image not available</span>
                  </div>
                }
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}