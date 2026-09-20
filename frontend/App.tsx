import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/SupabaseAuthContext";
import { LocationProvider, useLocation } from "./contexts/LocationContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import LocationPermissionModal from "./components/LocationPermissionModal";
import NotificationCenter from "./components/NotificationCenter";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import UserHomepage from "./pages/UserHomepage";
import Issues from "./pages/Issues";
import IssueDetail from "./pages/IssueDetail";
import Profile from "./pages/Profile";
import Events from "./pages/Events";
import NotFound from "./pages/NotFound";
import ReportIssue from "./pages/ReportIssue";
import UserOnboarding from "./pages/UserOnboarding";
import EventDetail from "./pages/EventDetail";
import AuthorityDashboard from "./pages/AuthorityDashboard";
import AuthCallback from "./pages/AuthCallback";
import OfficialLogin from "./pages/official/OfficialLogin";
import OfficialOnboarding from "./pages/official/OfficialOnboarding";
import OfficialDashboard from "./pages/official/OfficialDashboard";
import IssueDetails from "./pages/official/IssueDetails";
import UploadResolution from "./pages/official/UploadResolution";
import OfficialProfile from "./pages/official/OfficialProfile";
import ResetPassword from "./pages/ResetPassword";
import OfficialForgotPassword from "./pages/official/OfficialForgotPassword";

import { getDashboardRouteForRole } from './utils/roleRouting';

const queryClient = new QueryClient();

// ProtectedRoute component to handle authentication
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, isNewUser, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner fullScreen message="Verifying session..." />;
  }
  
  // If not logged in, redirect to landing page
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  
  // If new user, redirect to onboarding
  if (isNewUser) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
};

// OnboardingRoute component to handle first-time users
const OnboardingRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, isNewUser, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner fullScreen message="Verifying session..." />;
  }
  
  // If not logged in, redirect to landing page
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  
  // If not a new user, redirect to dashboard
  if (!isNewUser) {
    const role = currentUser?.role || '';
    return <Navigate to={getDashboardRouteForRole(role)} replace />;
  }
  
  return <>{children}</>;
};

// RoleProtectedRoute component to guard privileged routes by user_profiles.role
const RoleProtectedRoute = ({ 
  children, 
  allowedRoles, 
  fallbackUrl = "/" 
}: { 
  children: React.ReactNode; 
  allowedRoles: string[]; 
  fallbackUrl?: string;
}) => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Verifying permissions..." />;
  }

  if (!currentUser) {
    return <Navigate to={fallbackUrl} replace />;
  }

  const role = userProfile?.role || currentUser?.role || '';
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardRouteForRole(role)} replace />;
  }

  return <>{children}</>;
};

// HomeRoute component to handle /home route
const HomeRoute = () => {
  const { currentUser, userProfile, isNewUser, loading } = useAuth();
  
  // Show loading while auth state is being determined
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading your dashboard..." />;
  }
  
  // If logged in and not a new user, redirect to role-specific dashboard
  if (currentUser && !isNewUser) {
    const role = userProfile?.role || currentUser?.role || '';
    return <Navigate to={getDashboardRouteForRole(role)} replace />;
  }
  
  // If logged in but new user, redirect to onboarding
  if (currentUser && isNewUser) {
    return <Navigate to="/onboarding" replace />;
  }
  
  // If not logged in, show the public Index page
  return <Index />;
};

// SafeRoute component with error boundary for individual routes
const SafeRoute = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

// AppRoutes component to handle routing after auth context is loaded
const AppRoutes = () => {
  const { loading } = useAuth();
  const { showLocationModal, setShowLocationModal, updateUserLocation } = useLocation();

  // Add a timeout fallback for loading state
  const [showFallback, setShowFallback] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setShowFallback(true);
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timer);
  }, [loading]);

  // Handle location permission granted
  const handleLocationGranted = (location: { lat: number; lng: number; address: string }) => {
    updateUserLocation({
      ...location,
      timestamp: Date.now()
    });
  };

  // If loading for too long, show fallback
  if (loading && showFallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Taking longer than expected...</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Home Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SafeRoute><Landing /></SafeRoute>} />
        <Route path="/home" element={<SafeRoute><HomeRoute /></SafeRoute>} />
        <Route path="/dashboard" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['citizen', 'community_member']}>
              <UserHomepage />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/issues" element={<SafeRoute><Issues /></SafeRoute>} />
        <Route path="/issues/:id" element={<SafeRoute><IssueDetail /></SafeRoute>} />
        <Route path="/issues/report" element={
          <SafeRoute>
            <ProtectedRoute>
              <ReportIssue />
            </ProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/profile" element={
          <SafeRoute>
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/onboarding" element={
          <SafeRoute>
            <OnboardingRoute>
              <UserOnboarding />
            </OnboardingRoute>
          </SafeRoute>
        } />
        <Route path="/events" element={<SafeRoute><Events /></SafeRoute>} />
        <Route path="/events/:id" element={<SafeRoute><EventDetail /></SafeRoute>} />
        
        {/* Authority / Municipal Admin Routes */}
        <Route path="/authority" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['municipal_admin', 'administrator', 'pradhan']}>
              <AuthorityDashboard />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/authority-dashboard" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['municipal_admin', 'administrator', 'pradhan']}>
              <AuthorityDashboard />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/municipal-admin/dashboard" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['municipal_admin', 'administrator', 'pradhan']}>
              <AuthorityDashboard />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        
        <Route path="/auth/callback" element={<SafeRoute><AuthCallback /></SafeRoute>} />
        <Route path="/reset-password" element={<SafeRoute><ResetPassword /></SafeRoute>} />
        
        {/* Worker Portal Routes */}
        <Route path="/official/login" element={<SafeRoute><OfficialLogin /></SafeRoute>} />
        <Route path="/official/forgot-password" element={<SafeRoute><OfficialForgotPassword /></SafeRoute>} />
        <Route path="/official/onboarding" element={<SafeRoute><OfficialOnboarding /></SafeRoute>} />
        
        <Route path="/worker" element={<Navigate to="/worker/dashboard" replace />} />
        <Route path="/worker/dashboard" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['worker', 'panchayat_worker']} fallbackUrl="/official/login">
              <OfficialDashboard />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/worker/issue/:id" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['worker', 'panchayat_worker', 'municipal_admin', 'administrator']} fallbackUrl="/official/login">
              <IssueDetails />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/worker/issue/:id/upload-resolution" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['worker', 'panchayat_worker']} fallbackUrl="/official/login">
              <UploadResolution />
            </RoleProtectedRoute>
          </SafeRoute>
        } />

        <Route path="/official/dashboard" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['worker', 'panchayat_worker']} fallbackUrl="/official/login">
              <OfficialDashboard />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/official/issue/:id" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['worker', 'panchayat_worker', 'municipal_admin', 'administrator']} fallbackUrl="/official/login">
              <IssueDetails />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/official/issue/:id/upload-resolution" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['worker', 'panchayat_worker']} fallbackUrl="/official/login">
              <UploadResolution />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        <Route path="/official/profile" element={
          <SafeRoute>
            <RoleProtectedRoute allowedRoles={['worker', 'panchayat_worker', 'municipal_admin', 'administrator', 'pradhan']} fallbackUrl="/official/login">
              <OfficialProfile />
            </RoleProtectedRoute>
          </SafeRoute>
        } />
        
        <Route path="*" element={<SafeRoute><NotFound /></SafeRoute>} />
      </Routes>
      
      {/* Location Permission Modal */}
      <LocationPermissionModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationGranted={handleLocationGranted}
      />

      {/* Global Notification Center */}
      <NotificationCenter />
    </BrowserRouter>
  );
};

const App = () => {
  const [appError, setAppError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Log app initialization
    console.log('Nagar Setu App initializing...');
    console.log('Environment:', import.meta.env.MODE);
    console.log('Supabase URL available:', !!import.meta.env.VITE_SUPABASE_URL);
    
    // Test if basic functionality works
    try {
      // Test if we can access localStorage
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
    } catch (error) {
      console.error('localStorage not available:', error);
      setAppError('Browser storage not available');
    }
  }, []);

  if (appError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">App Error</h1>
          <p className="text-gray-600 mb-4">{appError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <LocationProvider>
              <NotificationProvider>
                <Toaster />
                <Sonner />
                <AppRoutes />
              </NotificationProvider>
            </LocationProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;