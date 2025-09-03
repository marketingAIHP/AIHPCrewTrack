import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Upload, X } from 'lucide-react';
import { ObjectUploader } from '@/components/ObjectUploader';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
// import type { UploadResult } from '@uppy/core';

interface EmployeeData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  profileImage?: string;
}

interface EmployeeProfileDialogProps {
  employee: EmployeeData;
  isOpen: boolean;
  onClose: () => void;
}

const updateProfileSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().optional(),
});

export function EmployeeProfileDialog({ employee, isOpen, onClose }: EmployeeProfileDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      phone: employee.phone || '',
      address: employee.address || '',
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateProfileSchema>) => {
      return await apiRequest('/api/employee/profile', 'PUT', data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employee/profile'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  // Profile image mutations
  const uploadImageMutation = useMutation({
    mutationFn: async (imageURL: string) => {
      const response = await fetch('/api/employee/profile-image', {
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
        description: "Profile image has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employee/profile'] });
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
      const response = await fetch('/api/employee/profile-image', {
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
        description: "Profile image has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employee/profile'] });
      setIsImageDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Removal Failed",
        description: error.message || "Failed to remove profile image.",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: `profile-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        contentType: 'image/*',
      }),
    });
    
    if (!response.ok) throw new Error('Failed to get upload parameters');
    return response.json();
  };

  const handleUploadComplete = (result: any) => {
    if (result && result.length > 0 && result[0].successful) {
      const uploadedFile = result[0];
      if (uploadedFile.uploadURL) {
        uploadImageMutation.mutate(uploadedFile.uploadURL);
      }
    }
  };

  const onSubmit = (data: z.infer<typeof updateProfileSchema>) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Profile</DialogTitle>
            <DialogDescription>
              Update your personal information and profile picture.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Profile Image Section */}
            <div className="flex items-center justify-center">
              <div className="relative">
                {employee.profileImage ? (
                  <AuthenticatedImage
                    src={employee.profileImage}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover"
                    fallback={
                      <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-medium text-gray-700">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </span>
                      </div>
                    }
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-medium text-gray-700">
                      {employee.firstName[0]}{employee.lastName[0]}
                    </span>
                  </div>
                )}
                <Button
                  size="sm"
                  className="absolute -bottom-1 -right-1 rounded-full w-6 h-6 p-0"
                  onClick={() => setIsImageDialogOpen(true)}
                >
                  <Camera className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Profile Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <div className="text-sm text-gray-900">{employee.firstName} {employee.lastName}</div>
                  <p className="text-xs text-gray-500">Name cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <div className="text-sm text-gray-900">{employee.email}</div>
                  <p className="text-xs text-gray-500">Email cannot be changed</p>
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter your address" 
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateProfileMutation.isPending}>
                    {updateProfileMutation.isPending ? 'Updating...' : 'Update Profile'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Upload Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
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
            {employee.profileImage && (
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
    </>
  );
}