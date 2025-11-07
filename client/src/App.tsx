import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin-login";
import AdminSignup from "@/pages/admin-signup";
import AdminDashboard from "@/pages/admin-dashboard";
import EmployeeManagement from "@/pages/employee-management";
import EmployeeProfile from "@/pages/employee-profile";
import SiteManagement from "@/pages/site-management-fixed";
import LiveTracking from "@/pages/live-tracking";
import MobileWorker from "@/pages/mobile-worker";
import EmployeeLogin from "@/pages/employee-login";
import EmployeeDashboard from "@/pages/employee-dashboard";
import ActiveEmployees from "@/pages/active-employees";
import WorkSitesList from "@/pages/work-sites-list";
import OnSiteNow from "@/pages/on-site-now";
import Notifications from "@/pages/notifications";
import AdminProfile from "@/pages/admin-profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AdminLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/signup" component={AdminSignup} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/employee-management" component={EmployeeManagement} />
      <Route path="/employee-management" component={EmployeeManagement} />
      <Route path="/admin/employees/:id" component={EmployeeProfile} />
      <Route path="/admin/employees/:id/profile" component={EmployeeProfile} />
      <Route path="/admin/active-employees" component={ActiveEmployees} />
      <Route path="/admin/sites" component={SiteManagement} />
      <Route path="/site-management" component={SiteManagement} />
      <Route path="/admin/work-sites" component={WorkSitesList} />
      <Route path="/admin/on-site-now" component={OnSiteNow} />
      <Route path="/admin/notifications" component={Notifications} />
      <Route path="/admin/profile" component={AdminProfile} />
      <Route path="/admin/tracking" component={LiveTracking} />
      <Route path="/admin/live-tracking" component={LiveTracking} />
      <Route path="/employee/login" component={EmployeeLogin} />
      <Route path="/employee/dashboard" component={EmployeeDashboard} />
      <Route path="/worker" component={MobileWorker} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
