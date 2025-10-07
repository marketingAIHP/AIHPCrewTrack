import { Link, useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { setAuthToken, setUser, setUserType } from '@/lib/auth';
import { UserPlus } from 'lucide-react';

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  companyName: z.string().min(1, 'Company name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one letter, one number, and one special character'),
  confirmPassword: z.string().min(8, 'Password confirmation is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

export default function AdminSignup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      companyName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: Omit<SignupForm, 'confirmPassword'>) => {
      const response = await apiRequest('POST', '/api/admin/signup', data);
      return response.json();
    },
    onSuccess: (data) => {
      setAuthToken(data.token);
      setUser(data.admin);
      setUserType('admin');
      toast({
        title: 'Success',
        description: 'Account created successfully',
      });
      setLocation('/admin/dashboard');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Signup failed',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: SignupForm) => {
    const { confirmPassword, ...signupData } = data;
    signupMutation.mutate(signupData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 shadow-lg">
              <img 
                src="/logo-192.png" 
                alt="AIHP CrewTrack Logo" 
                className="h-16 w-auto"
              />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AIHP CrewTrack</h1>
            <p className="text-gray-600 mt-2">Create Admin Account - Setup Your Organization</p>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  {...form.register('firstName')}
                />
                {form.formState.errors.firstName && (
                  <p className="text-error text-sm mt-1">{form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  {...form.register('lastName')}
                />
                {form.formState.errors.lastName && (
                  <p className="text-error text-sm mt-1">{form.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </Label>
              <Input
                id="companyName"
                placeholder="ABC Construction Co."
                {...form.register('companyName')}
              />
              {form.formState.errors.companyName && (
                <p className="text-error text-sm mt-1">{form.formState.errors.companyName.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@company.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-error text-sm mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...form.register('password')}
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be 8+ characters with letters, numbers, and special characters (@$!%*?&)
              </p>
              {form.formState.errors.password && (
                <p className="text-error text-sm mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-error text-sm mt-1">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-blue-700 text-white"
              disabled={signupMutation.isPending}
            >
              {signupMutation.isPending ? 'Creating Account...' : 'Create Admin Account'}
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/admin/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
