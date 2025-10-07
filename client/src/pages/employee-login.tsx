import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { Building2, Users, Lock, Mail } from 'lucide-react';

const employeeLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type EmployeeLoginForm = z.infer<typeof employeeLoginSchema>;

export default function EmployeeLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string>('');

  const form = useForm<EmployeeLoginForm>({
    resolver: zodResolver(employeeLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: EmployeeLoginForm) => {
      const response = await fetch('/api/employee/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userType', 'employee');
      toast({
        title: 'Welcome!',
        description: 'Successfully logged in as employee.',
      });
      setLocation('/employee/dashboard');
    },
    onError: (error: any) => {
      setError(error.message || 'Login failed. Please try again.');
    },
  });

  const onSubmit = (data: EmployeeLoginForm) => {
    setError('');
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 shadow-lg">
              <img 
                src="/logo-192.png" 
                alt="AIHP CrewTrack Logo" 
                className="h-14 w-auto"
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AIHP CrewTrack</h1>
          <p className="text-gray-600">Employee Portal</p>
        </div>

        {/* Login Card */}
        <Card className="w-full shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Employee Sign In</span>
            </CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your work dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input 
                            {...field} 
                            type="email" 
                            placeholder="your.email@company.com"
                            className="pl-10"
                            disabled={loginMutation.isPending}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input 
                            {...field} 
                            type="password" 
                            placeholder="Enter your password"
                            className="pl-10"
                            disabled={loginMutation.isPending}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>
            </Form>

            <Separator />

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Are you an administrator?
              </p>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/admin/login')}
                className="w-full"
              >
                Go to Admin Portal
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Contact your administrator if you need help accessing your account</p>
        </div>
      </div>
    </div>
  );
}