import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, MapPin, Bell, BarChart3, Users, Shield, Wrench, Construction, TrendingUp, CheckCircle, FileText, AlertTriangle, LogOut, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from '@/lib/supabase';

// Lazy load the showcase component for better initial load performance
const CompactResolvedShowcase = lazy(() => import('@/components/CompactResolvedShowcase'));

const STATS_CACHE_KEY = 'nagarsetu_realtime_stats';
const DEFAULT_PLATFORM_STATS = {
  totalIssues: 0,
  resolvedIssues: 0,
  activeCitizens: 0,
};

// Animated Number Counter Component
const AnimatedCounter = ({ 
  value, 
  colorClass, 
  suffix = '' 
}: { 
  value: number; 
  colorClass: string; 
  suffix?: string 
}) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 1200;
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * easeProgress);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };

    requestAnimationFrame(updateCounter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const formatted = displayValue >= 1000 
    ? `${(displayValue / 1000).toFixed(1)}k+` 
    : `${displayValue}${suffix}`;

  return (
    <h2 className={`text-6xl font-bold ${colorClass} drop-shadow-lg tracking-tight transition-all duration-300`}>
      {formatted}
    </h2>
  );
};

// Real-Time Statistics Component
const RealTimeStats = () => {
  const [stats, setStats] = useState(() => {
    try {
      const cached = localStorage.getItem(STATS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.totalIssues === 'number') {
          return {
            totalIssues: parsed.totalIssues,
            resolvedIssues: parsed.resolvedIssues ?? 0,
            activeCitizens: parsed.activeCitizens ?? 0,
          };
        }
      }
    } catch (e) {
      // Ignore localStorage read errors
    }
    return DEFAULT_PLATFORM_STATS;
  });

  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    setIsUpdating(true);
    try {
      // 12-second timeout guarantee to handle cold start and remote latency
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Stats query timeout')), 12000);
      });

      type QueryResult = { count?: number | null; data?: Array<{ reporter_id?: string | null }> | null };

      const queryPromise = Promise.allSettled([
        supabase.from('issues').select('*', { count: 'exact', head: true }),
        supabase.from('issues').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('issues').select('reporter_id').limit(150)
      ]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
      });

      const [totalResult, resolvedResult, citizensResult] = (await Promise.race([
        queryPromise,
        timeoutPromise
      ])) as [
        PromiseSettledResult<QueryResult>,
        PromiseSettledResult<QueryResult>,
        PromiseSettledResult<QueryResult>
      ];

      let total = 0;
      let resolved = 0;
      let citizens = 0;

      if (totalResult?.status === 'fulfilled' && typeof totalResult.value?.count === 'number') {
        total = totalResult.value.count;
      }
      if (resolvedResult?.status === 'fulfilled' && typeof resolvedResult.value?.count === 'number') {
        resolved = resolvedResult.value.count;
      }
      if (citizensResult?.status === 'fulfilled' && Array.isArray(citizensResult.value?.data)) {
        citizens = new Set(
          citizensResult.value.data
            .map((issue: { reporter_id?: string | null }) => issue.reporter_id)
            .filter(Boolean)
        ).size;
      }

      const updated = {
        totalIssues: total,
        resolvedIssues: resolved,
        activeCitizens: citizens,
      };

      setStats(updated);

      try {
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(updated));
      } catch (e) {
        // Ignore localStorage write errors
      }
    } catch (err) {
      // Retain fallback / cached stats gracefully
      console.debug('RealTimeStats fetch deferred or timed out, keeping cached stats:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="py-16 px-6 bg-white/10 backdrop-blur-md rounded-t-3xl -mt-12 border-t border-white/20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Total Issues Reported */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <Card className="shadow-2xl border-none bg-white/20 backdrop-blur-md border border-white/30 overflow-hidden hover:bg-white/25 transition-all">
              <CardContent className="p-8 text-center relative">
                <div className="absolute top-4 right-4">
                  <FileText className="w-8 h-8 text-yellow-300 opacity-50" />
                </div>
                <div className="mb-4">
                  <AnimatedCounter 
                    value={stats.totalIssues} 
                    colorClass="text-yellow-300" 
                  />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Total Issues Reported</h3>
                <p className="text-white/80 text-sm">Community reports submitted</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Issues Resolved to Date */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <Card className="shadow-2xl border-none bg-white/20 backdrop-blur-md border border-white/30 overflow-hidden hover:bg-white/25 transition-all">
              <CardContent className="p-8 text-center relative">
                <div className="absolute top-4 right-4">
                  <CheckCircle className="w-8 h-8 text-green-300 opacity-50" />
                </div>
                <div className="mb-4">
                  <AnimatedCounter 
                    value={stats.resolvedIssues} 
                    colorClass="text-green-300" 
                  />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Issues Resolved to Date</h3>
                <p className="text-white/80 text-sm">Successfully completed</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Citizens */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative"
          >
            <Card className="shadow-2xl border-none bg-white/20 backdrop-blur-md border border-white/30 overflow-hidden hover:bg-white/25 transition-all">
              <CardContent className="p-8 text-center relative">
                <div className="absolute top-4 right-4">
                  <Users className="w-8 h-8 text-blue-300 opacity-50" />
                </div>
                <div className="mb-4">
                  <AnimatedCounter 
                    value={stats.activeCitizens} 
                    colorClass="text-blue-300" 
                    suffix="+" 
                  />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Active Citizens</h3>
                <p className="text-white/80 text-sm">Engaged community members</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Live Update Indicator */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
            <div className={`w-2 h-2 rounded-full ${isUpdating ? 'bg-amber-400 animate-ping' : 'bg-green-400 animate-pulse'}`}></div>
            <span className="text-white/90 text-sm">
              {isUpdating ? 'Refreshing Live Statistics...' : 'Live Statistics - Updates in Real-Time'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

import { getDashboardRouteForRole, isRoleAllowedForPortal, getRoleDisplayName } from '@/utils/roleRouting';

export default function Landing() {
  const navigate = useNavigate();
  const { currentUser, userProfile, logOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<'citizen' | 'authority' | null>(null);
  const [showDevModal, setShowDevModal] = useState(false);
  const [portalSwitchTarget, setPortalSwitchTarget] = useState<{
    portal: 'citizen' | 'authority' | 'worker';
    label: string;
    loginPath: string;
  } | null>(null);
  const [isSwitchingPortal, setIsSwitchingPortal] = useState(false);

  const effectiveRole = userProfile?.role || currentUser?.role;

  const handleGetStarted = () => {
    // Scroll to the user type selection section
    document.getElementById('user-selection')?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Portal-aware access handler.
   * - Same portal as current role → redirect to dashboard
   * - Different portal → show confirmation dialog → sign out → target login
   * - Not logged in → go directly to target login
   */
  const handlePortalAccess = (targetPortal: 'citizen' | 'authority' | 'worker') => {
    const portalConfig = {
      citizen: { label: 'Citizen', loginPath: '__citizen_modal__' },
      authority: { label: 'Authority', loginPath: '/official/login?portal=authority' },
      worker: { label: 'Worker', loginPath: '/official/login?portal=worker' },
    };

    if (currentUser) {
      // Citizen portal is open to all authenticated users
      if (targetPortal === 'citizen') {
        navigate('/dashboard');
        return;
      }

      // Check if current role matches official portal
      if (effectiveRole && isRoleAllowedForPortal(String(effectiveRole), targetPortal)) {
        navigate(getDashboardRouteForRole(effectiveRole));
        return;
      }

      // Different portal → show portal switch dialog
      setPortalSwitchTarget({
        portal: targetPortal,
        label: portalConfig[targetPortal].label,
        loginPath: portalConfig[targetPortal].loginPath,
      });
      return;
    }

    // Not logged in → go directly to target login
    if (targetPortal === 'citizen') {
      setSelectedUserType('citizen');
      setAuthModalOpen(true);
    } else {
      navigate(portalConfig[targetPortal].loginPath);
    }
  };

  const handleCitizenAccess = () => handlePortalAccess('citizen');
  const handleAuthorityAccess = () => handlePortalAccess('authority');
  const handleWorkerAccess = () => handlePortalAccess('worker');

  /**
   * Portal switch confirmation: sign out current session, then navigate to target portal login.
   */
  const handlePortalSwitchConfirm = async () => {
    if (!portalSwitchTarget) return;
    setIsSwitchingPortal(true);
    try {
      await logOut();
      if (portalSwitchTarget.loginPath === '__citizen_modal__') {
        // For citizen portal, close dialog first then open auth modal
        setPortalSwitchTarget(null);
        setSelectedUserType('citizen');
        setAuthModalOpen(true);
      } else {
        setPortalSwitchTarget(null);
        navigate(portalSwitchTarget.loginPath);
      }
    } catch (err) {
      console.error('[Landing] Portal switch sign-out failed:', err);
      toast({ title: 'Sign out failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSwitchingPortal(false);
    }
  };

  const handlePortalSwitchCancel = () => {
    setPortalSwitchTarget(null);
  };

  const handleAuthSuccess = () => {
    // After successful authentication, redirect to citizen dashboard
    setAuthModalOpen(false);
    navigate('/dashboard');
    setSelectedUserType(null);
  };

  const handleAuthClose = () => {
    setAuthModalOpen(false);
    setSelectedUserType(null);
  };

  return (
    <div 
      className="min-h-screen text-white font-sans relative"
      style={{
        backgroundImage: 'url(/cityscape-bg.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="text-center py-24 px-6">
          <motion.h1 
            initial={{ opacity: 0, y: -30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 1 }} 
            className="text-5xl font-bold mb-4 text-white drop-shadow-lg"
          >
            Nagar Setu: Smarter Cities, Empowered Citizens
          </motion.h1>
          <p className="text-lg text-white/90 max-w-3xl mx-auto mb-8 drop-shadow-md">
            A next-gen civic engagement platform where citizens report issues instantly, and governments respond smarter with AI-driven prioritization and resolve them.
          </p>
          <Button 
            onClick={handleGetStarted}
            className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 text-lg rounded-full shadow-lg"
          >
            Get Started
          </Button>
        </section>

        {/* Real-Time Statistics Section */}
        <RealTimeStats />

        {/* User Selection Section */}
        <section id="user-selection" className="py-20 px-6 bg-black/30 backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-center mb-12 text-white drop-shadow-lg">Choose Your Access Type</h2>
          <div className="flex flex-col md:flex-row justify-center gap-8 max-w-6xl mx-auto">
          
            {/* Citizen Access */}
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              className="bg-white/20 p-8 rounded-2xl text-center shadow-xl w-full md:w-1/3 backdrop-blur-md border border-white/20"
            >
              <Users className="w-16 h-16 text-pink-400 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-4 text-pink-400">Citizen Access</h3>
              <p className="text-white/90 text-sm mb-6">
                Report civic issues, track progress, and help build a better community. Join thousands of citizens making a difference.
              </p>
              <Button 
                onClick={handleCitizenAccess}
                className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-full w-full"
              >
                Access as Citizen
              </Button>
            </motion.div>

            {/* Authority Access */}
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              className="bg-white/20 p-8 rounded-2xl text-center shadow-xl w-full md:w-1/3 backdrop-blur-md border border-white/20"
            >
              <Shield className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-4 text-blue-400">Authority Access</h3>
              <p className="text-white/90 text-sm mb-6">
                Manage reported issues, coordinate responses, and track resolution progress with advanced analytics and AI insights.
              </p>
              <Button 
                onClick={handleAuthorityAccess}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full w-full"
              >
                Access as Authority
              </Button>
            </motion.div>

            {/* Worker Access */}
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              className="bg-white/20 p-8 rounded-2xl text-center shadow-xl w-full md:w-1/3 backdrop-blur-md border border-white/20 relative"
            >
              <Wrench className="w-16 h-16 text-orange-400 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-4 text-orange-400">Worker Access</h3>
              <p className="text-white/90 text-sm mb-6">
                Field workers can view assigned tasks, update progress, and complete civic maintenance work efficiently.
              </p>
              <Button 
                onClick={handleWorkerAccess}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full w-full"
              >
                Access as Worker
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Resolved Issues Showcase - Compact Grid View */}
        <Suspense fallback={
          <div className="py-16 px-6 bg-black/20 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white/80">Loading success stories...</p>
            </div>
          </div>
        }>
          <CompactResolvedShowcase />
        </Suspense>

      {/* CTA Section */}
      <section className="text-center py-20 bg-white/15 backdrop-blur-md border-t border-white/20">
        <h2 className="text-4xl font-bold mb-6 text-white drop-shadow-lg">Join the Future of Smart Governance</h2>
        <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-md">
          Be part of the change. Report civic issues, monitor progress, and help build cleaner, more connected cities.
        </p>
        <Button 
          onClick={handleGetStarted}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 text-lg rounded-full shadow-xl"
        >
          Get Started Now
        </Button>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-400 bg-gray-950 border-t border-gray-800">
        © 2025 Nagar Setu | Empowering Citizens for Smarter Cities
      </footer>

      {/* Portal Switch Confirmation Dialog */}
      <Dialog open={!!portalSwitchTarget} onOpenChange={(open) => { if (!open) handlePortalSwitchCancel(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Switch Portal
            </DialogTitle>
            <DialogDescription>
              You need to sign in with a different account to access this portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <LogOut className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-900">
                    You're currently signed in as <strong>{getRoleDisplayName(effectiveRole as string)}</strong>.
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    To access the <strong>{portalSwitchTarget?.label}</strong> portal, you'll need to sign in with a {portalSwitchTarget?.label} account.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Your current session will be signed out before proceeding to the {portalSwitchTarget?.label} login.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handlePortalSwitchCancel}
                disabled={isSwitchingPortal}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePortalSwitchConfirm}
                disabled={isSwitchingPortal}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSwitchingPortal ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Signing out...
                  </>
                ) : (
                  <>
                    Continue to {portalSwitchTarget?.label} Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={handleAuthClose}
        redirectTo={selectedUserType === 'citizen' ? '/dashboard' : '/authority-dashboard'}
        userType={selectedUserType || 'citizen'}
      />

      {/* Under Development Modal */}
      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Construction className="h-6 w-6 text-orange-500" />
              Under Development
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Wrench className="h-8 w-8 text-orange-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-orange-900 mb-2">Worker Portal Coming Soon!</h3>
                  <p className="text-sm text-orange-800">
                    We're currently building an advanced portal for field workers to manage and complete assigned tasks efficiently.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">Upcoming Features:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>View assigned tasks with GPS navigation</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Upload before/after photos of completed work</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Real-time task updates and notifications</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Performance tracking and achievements</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Stay tuned!</strong> The worker portal will be available soon with powerful tools for municipal field workers.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDevModal(false)}
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  setShowDevModal(false);
                  handleCitizenAccess();
                }}
                className="bg-pink-500 hover:bg-pink-600"
              >
                Try Citizen Access
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}