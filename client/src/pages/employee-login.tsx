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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl p-3 shadow-sm ring-1 ring-blue-200/50 dark:ring-blue-500/30">
              <img 
                src="/logo-192.png" 
                alt="AIHP CrewTrack Logo" 
                className="h-12 w-12 object-contain"
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">AIHP CrewTrack</h1>
          <p className="text-slate-600 dark:text-slate-400">Employee Portal</p>
        </div>

        {/* Login Card */}
        <Card className="w-full shadow-lg bg-white dark:bg-slate-800/90 dark:border-slate-700">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center space-x-2 text-slate-900 dark:text-slate-100">
              <Users className="h-5 w-5" />
              <span>Employee Sign In</span>
            </CardTitle>
            <CardDescription className="text-center text-slate-600 dark:text-slate-400">
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
                      <FormLabel className="text-slate-700 dark:text-slate-300">Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <Input 
                            {...field} 
                            type="email" 
                            placeholder="your.email@company.com"
                            className="pl-10 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
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
                      <FormLabel className="text-slate-700 dark:text-slate-300">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <Input 
                            {...field} 
                            type="password" 
                            placeholder="Enter your password"
                            className="pl-10 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
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
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>
            </Form>

            <Separator className="dark:bg-slate-700" />

            <div className="text-center space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Are you an administrator?
              </p>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/admin/login')}
                className="w-full border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Go to Admin Portal
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Contact your administrator if you need help accessing your account</p>
        </div>
      </div>
    </div>
  );
}