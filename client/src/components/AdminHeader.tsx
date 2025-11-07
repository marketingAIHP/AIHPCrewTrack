import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { getAuthToken, logout } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import NotificationDropdown from '@/components/NotificationDropdown';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';

interface AdminHeaderProps {
  showProfile?: boolean;
}

export function AdminHeader({ showProfile = true }: AdminHeaderProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: adminProfile } = useQuery({
    queryKey: ['/api/admin/profile'],
    queryFn: async () => {
      const response = await fetch('/api/admin/profile', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
    enabled: showProfile,
  });

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.',
    });
    setLocation('/admin/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
        {/* Clickable Logo and Text - Navigates to Dashboard */}
        <Link href="/admin/dashboard">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-md bg-black dark:bg-slate-800 flex items-center justify-center">
              <img src="/logo-192.png" alt="AIHP" className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 bg-gradient-to-r from-blue-400 to-purple-400 dark:from-blue-300 dark:to-purple-300 bg-clip-text text-transparent">AIHP CrewTrack</h1>
              <p className="text-xs bg-gradient-to-r from-blue-400 to-purple-400 dark:from-blue-300 dark:to-purple-300 bg-clip-text text-transparent">Admin Dashboard</p>
            </div>
          </div>
        </Link>
        {showProfile && (
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <Link href="/admin/profile">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <div className="h-8 w-8 rounded-full overflow-hidden">
                  <AuthenticatedImage
                    src={adminProfile?.profileImage}
                    alt="Admin Avatar"
                    className="h-8 w-8 object-cover"
                    fallback={
                      <div className="h-8 w-8 bg-blue-600 text-white text-sm flex items-center justify-center rounded-full font-bold">
                        {adminProfile?.firstName?.[0] || ''}{adminProfile?.lastName?.[0] || ''}
                      </div>
                    }
                  />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {adminProfile?.firstName && adminProfile?.lastName
                      ? `${adminProfile.firstName} ${adminProfile.lastName}`
                      : 'Administrator'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Administrator</p>
                </div>
              </div>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

