import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, UserPlus, MapPin, Phone, Mail, User, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';

const addEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  siteId: z.string().optional(),
  departmentId: z.string().optional(),
});

type AddEmployeeData = z.infer<typeof addEmployeeSchema>;

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  siteId?: number;
  departmentId?: number;
  profileImage?: string;
  isActive: boolean;
  siteName?: string;
  departmentName?: string;
}

interface WorkSite {
  id: number;
  name: string;
  address: string;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface EmployeeManagementProps {
  isExpanded?: boolean;
  onToggle?: () => void;
}

export default function EmployeeManagement({ isExpanded = false, onToggle }: EmployeeManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ['/api/admin/employees'],
    enabled: !!getAuthToken(),
  });

  const { data: workSites = [] } = useQuery<WorkSite[]>({
    queryKey: ['/api/admin/sites'],
    enabled: !!getAuthToken(),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/admin/departments'],
    enabled: !!getAuthToken(),
  });

  const form = useForm<AddEmployeeData>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      siteId: '',
      departmentId: '',
    },
  });

  const addEmployeeMutation = useMutation({
    mutationFn: async (data: AddEmployeeData) => {
      const payload = {
        ...data,
        siteId: data.siteId ? parseInt(data.siteId) : undefined,
        departmentId: data.departmentId ? parseInt(data.departmentId) : undefined,
      };
      const token = getAuthToken();
      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add employee');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Employee added successfully!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add employee',
        variant: 'destructive',
      });
    },
  });

  const filteredEmployees = employees.filter(employee =>
    `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.phone.includes(searchTerm)
  );

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const onSubmit = (data: AddEmployeeData) => {
    addEmployeeMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle 
            className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={onToggle}
          >
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <User className="h-5 w-5" />
            Employee Management
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({employees.length} employees)
            </span>
          </CardTitle>
          {isExpanded && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
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
                      control={form.control}
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
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="john.doe@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
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
                          <Input placeholder="••••••••" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No department</SelectItem>
                            {departments.map((dept) => (
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
                    control={form.control}
                    name="siteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned Work Site (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a work site" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No assignment</SelectItem>
                            {workSites.map((site) => (
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
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                      disabled={addEmployeeMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={addEmployeeMutation.isPending}
                    >
                      {addEmployeeMutation.isPending ? 'Adding...' : 'Add Employee'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search employees by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Employee Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-lg p-2">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Employees</p>
                <p className="text-2xl font-bold text-blue-900">{employees.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-lg p-2">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Active Employees</p>
                <p className="text-2xl font-bold text-green-900">
                  {employees.filter(emp => emp.isActive).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="bg-orange-100 rounded-lg p-2">
                <User className="h-5 w-5 text-orange-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">With Departments</p>
                <p className="text-2xl font-bold text-orange-900">
                  {employees.filter(emp => emp.departmentId).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Employee List */}
        {employeesLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="bg-gray-200 rounded-full w-12 h-12"></div>
                  <div className="flex-1 space-y-2">
                    <div className="bg-gray-200 h-4 rounded w-1/4"></div>
                    <div className="bg-gray-200 h-3 rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="font-medium text-gray-900 mb-2">
              {searchTerm ? 'No employees found' : 'No employees yet'}
            </p>
            <p className="text-sm text-gray-600">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Add your first employee to get started'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmployees.map((employee) => (
              <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    {employee.profileImage ? (
                      <AvatarImage src={employee.profileImage} alt={`${employee.firstName} ${employee.lastName}`} />
                    ) : (
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getInitials(employee.firstName, employee.lastName)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {employee.firstName} {employee.lastName}
                    </h4>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {employee.email}
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {employee.phone}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {employee.departmentId && (
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="h-4 w-4 mr-1" />
                          {employee.departmentName || 'Department assigned'}
                        </div>
                      )}
                      {employee.siteId && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          {employee.siteName || 'Site assigned'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={employee.isActive ? "default" : "secondary"}>
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {employee.departmentId && (
                    <Badge variant="outline">
                      <User className="h-3 w-3 mr-1" />
                      Department
                    </Badge>
                  )}
                  {employee.siteId && (
                    <Badge variant="outline">
                      <MapPin className="h-3 w-3 mr-1" />
                      Site
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      )}
      {!isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-lg p-2">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Total</p>
                  <p className="text-xl font-bold text-blue-900">{employees.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-2">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Active</p>
                  <p className="text-xl font-bold text-green-900">
                    {employees.filter(emp => emp.isActive).length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-orange-100 rounded-lg p-2">
                  <User className="h-5 w-5 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Departments</p>
                  <p className="text-xl font-bold text-orange-900">
                    {employees.filter(emp => emp.departmentId).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}