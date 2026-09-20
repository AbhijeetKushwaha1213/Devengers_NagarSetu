import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Mail, Lock, AlertCircle, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { LoginAccessType } from '../../../backend/services/auth';
import { getFriendlyAuthErrorMessage } from '@/utils/authErrors';
import { getDashboardRouteForRole, isRoleAllowedForPortal } from '@/utils/roleRouting';

const OfficialLogin: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPortal = (searchParams.get('portal') === 'authority' ? 'authority' : 'worker') as LoginAccessType;
  
  const [portalType, setPortalType] = useState<LoginAccessType>(initialPortal);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, logOut, currentUser, userProfile } = useAuth();

  // Session guard: if a user arrives at this page with a session whose role
  // doesn't match the target portal (e.g., citizen navigating to /official/login?portal=authority
  // via direct URL), sign out the stale session so the login form starts clean.
  useEffect(() => {
    const role = userProfile?.role || (currentUser as { role?: string } | null)?.role;
    if (currentUser && role && !isRoleAllowedForPortal(String(role), portalType)) {
      console.log(`[OfficialLogin] Stale session detected (role=${role}, portal=${portalType}). Signing out.`);
      logOut().catch((err: unknown) => console.error('[OfficialLogin] Auto sign-out failed:', err));
    }
  }, [currentUser, userProfile, portalType, logOut]);

  const handlePortalSwitch = (type: LoginAccessType) => {
    setPortalType(type);
    setError('');
    setSearchParams(type === 'authority' ? { portal: 'authority' } : {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Canonical login flow using unified auth contract
      const result = await login({
        email: formData.email,
        password: formData.password,
        accessType: portalType,
      });

      // Use the authoritative role from the login result, not the portal type,
      // to determine the correct dashboard route. This ensures the routing
      // matches the actual user_profiles.role from the database.
      const targetRoute = getDashboardRouteForRole(result.user.role);

      // Use window.location.href instead of navigate() because the AuthProvider
      // sets loading=true during login, which unmounts/remounts the entire
      // <BrowserRouter> tree. A React Router navigate() call issued before the
      // remount is silently lost. window.location.href survives the React
      // lifecycle and guarantees the redirect reaches the correct dashboard.
      window.location.href = targetRoute;
      return; // prevent finally from clearing loading state before redirect
    } catch (err) {
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            {portalType === 'worker' ? (
              <Wrench className="w-8 h-8 text-white" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            NagarSetu
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {portalType === 'worker' ? 'Worker Access Portal' : 'Authority Access Portal'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          {/* Portal Selector Toggle */}
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1 mb-6">
            <button
              type="button"
              onClick={() => handlePortalSwitch('worker')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                portalType === 'worker'
                  ? 'bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Worker Access
            </button>
            <button
              type="button"
              onClick={() => handlePortalSwitch('authority')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                portalType === 'authority'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Authority Access
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder={portalType === 'worker' ? 'worker@municipality.gov' : 'admin@municipality.gov'}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={() => navigate('/official/forgot-password')}
              >
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                portalType === 'worker'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Authenticating...' : `Login to ${portalType === 'worker' ? 'Worker' : 'Authority'} Portal`}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Back to Main Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficialLogin;
