import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const OfficialForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim()) {
      setError('Please enter your official email address.');
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err) {
      console.error('Official password reset error:', err);
      const error = err as Error;
      setError(error.message || 'Failed to send password reset link. Please verify your email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 shadow-lg shadow-blue-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            NagarSetu
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Official's Portal • Reset Password
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          {success ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Check Your Inbox
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                  If an account is associated with <span className="font-medium text-gray-900 dark:text-white">{email}</span>, we have sent a secure password reset link.
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                Please follow the instructions in the email to set up your new password. The link will expire shortly for security.
              </div>

              <button
                type="button"
                onClick={() => navigate('/official/login')}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Enter your registered official email address and we'll send you a link to reset your password.
                </p>

                <label htmlFor="official-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="official-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white placeholder-gray-400"
                    placeholder="official@municipality.gov"
                    disabled={loading}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending link...' : 'Send Reset Link'}
              </button>

              {/* Back to login */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/official/login')}
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfficialForgotPassword;
