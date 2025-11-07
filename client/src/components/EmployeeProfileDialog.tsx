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
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { useRef } from 'react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Profile image upload to Supabase
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await response.json();
      const imageURL = data.profileImage || data.url || data.uploadURL;

      if (!imageURL) {
        throw new Error('No image URL returned from server');
      }

      // Update profile image in database
      const updateResponse = await fetch('/api/employee/profile-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageURL }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update profile image');
      }

      return updateResponse.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Image Uploaded",
        description: "Profile image has been updated successfully.",
      });
      // Invalidate all queries that might show this employee's profile
      queryClient.invalidateQueries({ queryKey: ['/api/employee/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/locations'] });
      setIsImageDialogOpen(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5242880) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      uploadImageMutation.mutate(file);
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
                <AuthenticatedImage
                  src={employee.profileImage}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm"
                  fallback={
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="text-white font-bold text-2xl">{employee.firstName[0]}{employee.lastName[0]}</span>
                    </div>
                  }
                />
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
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              id="profile-image-upload"
              disabled={uploadImageMutation.isPending}
            />
            <label htmlFor="profile-image-upload">
              <Button
                variant="outline"
                className="w-full cursor-pointer"
                disabled={uploadImageMutation.isPending}
                asChild
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadImageMutation.isPending ? 'Uploading...' : 'Upload New Image'}
                </span>
              </Button>
            </label>
            {employee.profileImage && (
              <Button
                variant="destructive"
                onClick={() => removeImageMutation.mutate()}
                disabled={removeImageMutation.isPending || uploadImageMutation.isPending}
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