import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const exportFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  fromEmail: z.string().email('Please enter a valid sender email address'),
  subject: z.string().min(1, 'Subject is required').default('Employee Attendance Report - Last 30 Days'),
});

type ExportFormData = z.infer<typeof exportFormSchema>;

interface ExportReportDialogProps {
  children: React.ReactNode;
}

export default function ExportReportDialog({ children }: ExportReportDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ExportFormData>({
    resolver: zodResolver(exportFormSchema),
    defaultValues: {
      email: '',
      fromEmail: '',
      subject: 'Employee Attendance Report - Last 30 Days',
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (data: ExportFormData) => {
      const response = await fetch('/api/admin/export-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send report');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Report Sent Successfully',
        description: 'The attendance report has been sent to the specified email address.',
      });
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to send the report. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ExportFormData) => {
    exportMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Export Attendance Report
          </DialogTitle>
          <DialogDescription>
            Send a comprehensive 30-day attendance report via email. The report will include 
            check-in/out times, work sites, and attendance summaries for all employees.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fromEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Email (Your Email)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="admin@company.com" 
                      type="email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Send Report To</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="recipient@example.com" 
                      type="email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Subject</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Employee Attendance Report"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={exportMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={exportMutation.isPending}
                className="min-w-[120px]"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Send Report
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}