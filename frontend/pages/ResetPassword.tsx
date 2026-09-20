import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import Button from '@/components/Button';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if recovery session is active
    const checkSession = async () => {
      try {
        // Check if there is an auth code in the query parameters (PKCE flow)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data?.session) {
            setHasValidSession(true);
            setCheckingSession(false);
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasValidSession(true);
        } else {
          // Check hash parameters for recovery token
          const hash = window.location.hash;
          if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
            setHasValidSession(true);
          }
        }
      } catch (err) {
        console.error('Error checking recovery session:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();

    // Listen for PASSWORD_RECOVERY or session change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both password fields are identical.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: 'Password updated successfully!',
        description: 'You can now sign in with your new password.',
      });
    } catch (error) {
      console.error('Failed to update password:', error);
      const err = error as Error;
      toast({
        title: 'Password update failed',
        description: err.message || 'Failed to update your password. The link may have expired.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 shadow-sm">
            {isSuccess ? <CheckCircle2 className="w-8 h-8 text-green-600" /> : <ShieldCheck className="w-8 h-8" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSuccess ? 'Password Reset Complete' : 'Set New Password'}
          </h1>
          <p className="text-gray-600 mt-2 text-sm">
            {isSuccess
              ? 'Your password has been successfully updated. You can now use your new password.'
              : 'Please enter a secure new password for your NagarSetu account.'}
          </p>
        </div>

        {checkingSession ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            Verifying recovery link...
          </div>
        ) : isSuccess ? (
          <div className="space-y-4">
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate('/')}
            >
              Go to Home & Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : !hasValidSession ? (
          <div className="space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              <p className="font-semibold mb-1">Session Expired or Missing</p>
              <p>This password reset link is invalid or has expired. Please request a new password reset link from the sign-in modal.</p>
            </div>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => navigate('/')}
            >
              Return to Home
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  disabled={loading}
                  className="w-full pl-10 pr-12 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  disabled={loading}
                  className="w-full pl-10 pr-12 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={loading}
            >
              Update Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
