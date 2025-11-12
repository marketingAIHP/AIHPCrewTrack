import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { setAuthToken, setUser, setUserType } from '@/lib/auth';
import { Users } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  const loginMutation = useMutation({
    
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest('POST', '/api/admin/login', data);
      return response.json();
    },
    onSuccess: (data) => {
      setAuthToken(data.token);
      setUser(data.admin);
      setUserType('admin');
      toast({
        title: 'Success',
        description: 'Logged in successfully',
      });
      setLocation('/admin/dashboard');
    },
    onError: (error) => {
      const errorMessage = error.message || 'Login failed';
      
      // Check if it's an email verification error
      if (errorMessage.includes('Email not verified')) {
        setShowResendVerification(true);
        setResendEmail(form.getValues('email'));
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('POST', '/api/admin/resend-verification', { email });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data.message || 'Verification email sent successfully',
      });
      setShowResendVerification(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification email',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900">
      <Card className="w-full max-w-md shadow-xl bg-white dark:bg-slate-800/90 dark:border-slate-700">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="bg-black rounded-xl p-3 shadow-sm">
              <img 
                src="/logo-192.png" 
                alt="AIHP CrewTrack Logo" 
                className="h-12 w-12 object-contain"
              />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-black dark:text-white">A</span><span className="text-red-600">I</span><span className="text-black dark:text-white">HP</span> <span className="text-black dark:text-white">CrewTrack</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Admin Portal Login</p>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@company.com"
                {...form.register('email')}
                className="w-full dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
              {form.formState.errors.email && (
                <p className="text-error dark:text-red-400 text-sm mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...form.register('password')}
                className="w-full dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
              {form.formState.errors.password && (
                <p className="text-error dark:text-red-400 text-sm mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="rememberMe" {...form.register('rememberMe')} />
                <Label htmlFor="rememberMe" className="text-sm text-slate-600 dark:text-slate-400">
                  Remember me
                </Label>
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
            </Button>

            {showResendVerification && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Your email is not verified. Need to resend the verification email?
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="flex-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => resendVerificationMutation.mutate(resendEmail)}
                    disabled={resendVerificationMutation.isPending || !resendEmail}
                    className="dark:border-slate-600 dark:text-slate-200"
                  >
                    {resendVerificationMutation.isPending ? 'Sending...' : 'Resend'}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResendVerification(false)}
                  className="w-full text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </Button>
              </div>
            )}
            
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Don't have an admin account?{' '}
                <Link href="/admin/signup" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Create one
                </Link>
              </p>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-800 px-2 text-slate-500 dark:text-slate-400">Or</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">Are you an employee?</p>
                <Button 
                  variant="outline" 
                  onClick={() => setLocation('/employee/login')}
                  className="w-full border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Employee Portal
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
