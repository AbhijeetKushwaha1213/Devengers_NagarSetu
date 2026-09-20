import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Building, 
  IdCard, 
  Lock, 
  LogOut, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2, 
  XCircle,
  Briefcase
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User as UserType } from '@/types';
import { getDashboardRouteForRole, getRoleDisplayName } from '@/utils/roleRouting';

interface OrganizationalDetails {
  departmentName: string | null;
  municipalityName: string | null;
  wardName: string | null;
  panchayatName: string | null;
  blockName: string | null;
}

const OfficialProfile: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserType | null>(null);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [orgData, setOrgData] = useState<OrganizationalDetails>({
    departmentName: null,
    municipalityName: null,
    wardName: null,
    panchayatName: null,
    blockName: null,
  });
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fetchUserProfile = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        navigate('/official/login');
        return;
      }

      setAuthEmail(authUser.email || '');

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      }

      if (profile) {
        setUser(profile);

        // Fetch canonical relational data in parallel without leaking sensitive fields
        const org: OrganizationalDetails = {
          departmentName: null,
          municipalityName: null,
          wardName: null,
          panchayatName: null,
          blockName: null,
        };

        const fetches: Promise<void>[] = [];

        if (profile.department_id) {
          fetches.push(
            supabase
              .from('departments')
              .select('name')
              .eq('id', profile.department_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.name) org.departmentName = data.name;
              })
          );
        }

        if (profile.municipality_id) {
          fetches.push(
            supabase
              .from('municipalities')
              .select('name')
              .eq('id', profile.municipality_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.name) org.municipalityName = data.name;
              })
          );
        }

        if (profile.ward_id) {
          fetches.push(
            supabase
              .from('wards')
              .select('name, ward_number')
              .eq('id', profile.ward_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  org.wardName = data.name 
                    ? `${data.name} (Ward ${data.ward_number ?? ''})` 
                    : `Ward ${data.ward_number ?? ''}`;
                }
              })
          );
        }

        if (profile.panchayat_id) {
          fetches.push(
            supabase
              .from('panchayats')
              .select('name')
              .eq('id', profile.panchayat_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.name) org.panchayatName = data.name;
              })
          );
        }

        if (profile.block_id) {
          fetches.push(
            supabase
              .from('blocks')
              .select('name')
              .eq('id', profile.block_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.name) org.blockName = data.name;
              })
          );
        }

        await Promise.allSettled(fetches);
        setOrgData(org);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setShowChangePassword(false);
      
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      const err = error as Error;
      setPasswordError(err.message || 'Failed to change password');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/official/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading official profile...</p>
        </div>
      </div>
    );
  }

  const roleTitle = getRoleDisplayName(user?.role);
  const dashboardDestination = getDashboardRouteForRole(user?.role);
  const isActive = user?.is_active !== false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(dashboardDestination)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Official Profile
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isActive 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}
            >
              {isActive ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active Account
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  Inactive Account
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Identity Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                <User className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {user?.full_name || 'Official Member'}
              </h2>
              <div className="inline-flex items-center gap-2 mt-1">
                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold tracking-wide uppercase">
                  {roleTitle}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <User className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Full Name</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                    {user?.full_name || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Official Email */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Mail className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Email Address</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                    {user?.email || authEmail || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Employee ID */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <IdCard className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Employee ID</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                    {user?.employee_id || 'Not Assigned'}
                  </p>
                </div>
              </div>

              {/* Department */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Building className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Department</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                    {orgData.departmentName || user?.department || 'General Public Works'}
                  </p>
                </div>
              </div>

              {/* Role Title */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Database Role</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                    {user?.role || 'worker'}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Briefcase className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Deployment Status</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                    {isActive ? 'Active Duty' : 'Deactivated'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Jurisdiction Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Jurisdiction & Operational Area
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Municipality (Urban) */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Municipality</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                  {orgData.municipalityName || (user?.municipality_id ? `Assigned (${user.municipality_id.slice(0, 8)})` : 'Urban Municipality Central')}
                </p>
              </div>

              {/* Ward (Urban) */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Ward</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                  {orgData.wardName || (user?.ward_id ? `Ward (${user.ward_id.slice(0, 8)})` : 'All Wards / Central')}
                </p>
              </div>

              {/* Panchayat (Rural) */}
              {user?.role === 'panchayat_worker' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Gram Panchayat</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                    {orgData.panchayatName || (user?.panchayat_id ? `Panchayat (${user.panchayat_id.slice(0, 8)})` : 'Assigned Panchayat')}
                  </p>
                </div>
              )}

              {/* Block (Rural) */}
              {orgData.blockName && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Development Block</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                    {orgData.blockName}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Change Password Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Security & Credentials
            </h3>

            {!showChangePassword ? (
              <button
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                <Lock className="w-5 h-5" />
                Change Password
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    required
                    minLength={6}
                  />
                </div>

                {passwordError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Update Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassword(false);
                      setPasswordData({ newPassword: '', confirmPassword: '' });
                      setPasswordError('');
                    }}
                    className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {passwordSuccess && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-800 dark:text-green-300 font-medium">
                  ✓ Password changed successfully
                </p>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <LogOut className="w-5 h-5" />
              Sign Out from Official Portal
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OfficialProfile;
