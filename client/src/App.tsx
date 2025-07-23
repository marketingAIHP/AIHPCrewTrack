import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin-login";
import AdminSignup from "@/pages/admin-signup";
import AdminDashboard from "@/pages/admin-dashboard";
import EmployeeManagement from "@/pages/employee-management";
import SiteManagement from "@/pages/site-management";
import LiveTracking from "@/pages/live-tracking";
import MobileWorker from "@/pages/mobile-worker";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AdminLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/signup" component={AdminSignup} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/employees" component={EmployeeManagement} />
      <Route path="/admin/sites" component={SiteManagement} />
      <Route path="/admin/tracking" component={LiveTracking} />
      <Route path="/worker" component={MobileWorker} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
