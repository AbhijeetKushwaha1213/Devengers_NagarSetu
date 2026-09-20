
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Lock, User, ArrowRight, Globe, Shield } from 'lucide-react';
import Button from './Button';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { validateAuthorityAccessCode, sanitizeAccessCode } from "@/utils/authValidation";
import { supabase } from "@/lib/supabase";
import { LoginAccessType } from '../../backend/services/auth';
import { getDashboardRouteForRole } from '@/utils/roleRouting';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTo?: string;
  userType?: 'citizen' | 'authority' | 'worker';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, redirectTo, userType = 'citizen' }) => {
  const navigate = useNavigate();
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [authorityAccessCode, setAuthorityAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const departments = [
    'Public Works',
    'Transportation',
    'Water & Sewerage',
    'Electricity',
    'Health Department',
    'Environmental Services',
    'Parks & Recreation',
    'Building & Planning',
    'Police Department',
    'Fire Department',
    'Other'
  ];

  const { toast } = useToast();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isSignIn) {
        const accessType: LoginAccessType = 
          userType === 'authority' ? 'authority' :
          userType === 'worker' ? 'worker' : 'citizen';

        const result = await signIn(email, password, accessType);
        toast({
          title: "Signed in successfully",
          description: `Welcome back, ${result.user.full_name || 'user'}!`,
        });
        onClose();

        // Use the authoritative role from the login result for routing,
        // and window.location.href to survive the AuthProvider loading
        // re-render that unmounts/remounts BrowserRouter.
        const targetRoute = redirectTo || getDashboardRouteForRole(result.user.role);
        window.location.href = targetRoute;
        return;
      } else {
        // Sign up logic - validate authority access code if needed
        if (userType === 'authority') {
          if (!authorityAccessCode.trim()) {
            toast({
              title: "Authority access code required",
              description: "Please enter your authority access code to create an authority account.",
              variant: "destructive",
            });
            return;
          }
          
          setIsValidatingCode(true);
          const sanitizedCode = sanitizeAccessCode(authorityAccessCode);
          const isValidCode = await validateAuthorityAccessCode(sanitizedCode);
          setIsValidatingCode(false);
          
          if (!isValidCode) {
            toast({
              title: "Invalid authority access code",
              description: "The access code you entered is incorrect. Please contact your administrator.",
              variant: "destructive",
            });
            setAuthorityAccessCode(''); // Clear the field for security
            return;
          }
        }
        
        const finalDepartment = department === 'Other' ? customDepartment : department;
        await signUp(email, password, name, userType, finalDepartment);
        toast({
          title: "Account created",
          description: userType === 'authority' 
            ? "Your authority account has been created successfully" 
            : "Your account has been created successfully",
        });
        onClose();
        if (redirectTo) {
          navigate(redirectTo);
        }
      }
    } catch (error) {
      // Error handling is done in the context
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
      setIsValidatingCode(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle(redirectTo);
      // Note: User will be redirected to Google, so the code below won't execute
      // The success handling will happen in the AuthCallback component
    } catch (error) {
      // Error handling is done in the context
      console.error('Google auth error:', error);
      setGoogleLoading(false);
    }
  };



  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address to receive a password reset link.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: "Reset link sent",
        description: "Please check your inbox for instructions to reset your password.",
      });
    } catch (error) {
      console.error("Password reset error:", error);
      const err = error as Error;
      toast({
        title: "Password reset failed",
        description: err.message || "Failed to send reset link. Please check the email and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignIn(!isSignIn);
    setIsForgotPassword(false);
    setResetEmailSent(false);
    // Clear form when switching modes
    setEmail('');
    setPassword('');
    setName('');
    setDepartment('');
    setCustomDepartment('');
    setAuthorityAccessCode('');
  };

  const handleClose = () => {
    // Clear form when closing
    setEmail('');
    setPassword('');
    setName('');
    setDepartment('');
    setCustomDepartment('');
    setAuthorityAccessCode('');
    setIsLoading(false);
    setGoogleLoading(false);
    setIsValidatingCode(false);
    setIsForgotPassword(false);
    setResetEmailSent(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-auto overflow-hidden border border-gray-200">
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="p-6 sm:p-8">
          {isForgotPassword ? (
            <div>
              <h2 className="text-2xl font-semibold mb-1 text-gray-900">
                Reset Password
              </h2>
              <p className="text-gray-600 mb-6 text-sm">
                {resetEmailSent
                  ? "We've sent a password reset link to your email."
                  : "Enter your email address and we'll send you a link to reset your password."}
              </p>

              {resetEmailSent ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                    <p className="font-semibold mb-1">Check your inbox</p>
                    <p>
                      If an account exists for <span className="font-medium text-green-950">{email}</span>, you will receive an email with instructions to reset your password.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setResetEmailSent(false);
                    }}
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium mb-1.5 text-gray-700">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="your.email@example.com"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                  >
                    Send Reset Link
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(false)}
                      className="text-sm text-blue-600 hover:underline font-medium focus:outline-none"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold mb-1 text-gray-900">
                {isSignIn ? 'Welcome back' : `Create ${userType === 'authority' ? 'Authority' : 'Citizen'} Account`}
              </h2>
              <p className="text-gray-600 mb-6">
                {redirectTo === '/issues/report' 
                  ? 'Please sign in to report an issue and help improve your community'
                  : isSignIn 
                    ? `Sign in to your ${userType} account to continue` 
                    : userType === 'authority'
                      ? 'Join as an authority to manage and resolve community issues'
                      : 'Join our community to help improve your neighborhood'
                }
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isSignIn && (
                  <>
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-1.5 text-gray-700">
                        Name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Your name"
                          required={!isSignIn}
                          disabled={isLoading || googleLoading}
                        />
                      </div>
                    </div>

                    {userType === 'authority' && (
                      <>
                        <div>
                          <label htmlFor="department" className="block text-sm font-medium mb-1.5 text-gray-700">
                            Department
                          </label>
                          <select
                            id="department"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required={!isSignIn && userType === 'authority'}
                            disabled={isLoading || googleLoading || isValidatingCode}
                          >
                            <option value="">Select Department</option>
                            {departments.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                          
                          {department === 'Other' && (
                            <div className="mt-2">
                              <input
                                type="text"
                                value={customDepartment}
                                onChange={(e) => setCustomDepartment(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your department"
                                required={department === 'Other'}
                                disabled={isLoading || googleLoading || isValidatingCode}
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <label htmlFor="authorityAccessCode" className="block text-sm font-medium mb-1.5 text-gray-700">
                            Authority Access Code
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Shield className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                              id="authorityAccessCode"
                              type="password"
                              value={authorityAccessCode}
                              onChange={(e) => setAuthorityAccessCode(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter authority access code"
                              required={!isSignIn && userType === 'authority'}
                              disabled={isLoading || googleLoading || isValidatingCode}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Contact your administrator if you don't have an access code
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-gray-700">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Your email"
                      required
                      disabled={isLoading || googleLoading}
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Your password"
                      required
                      disabled={isLoading || googleLoading}
                      minLength={6}
                    />
                  </div>
                </div>
                
                {isSignIn && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setResetEmailSent(false);
                      }}
                      className="text-sm text-blue-600 hover:underline focus:outline-none"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
                
                <Button 
                  className="w-full group" 
                  size="lg" 
                  isLoading={isLoading || isValidatingCode}
                  disabled={googleLoading}
                >
                  <span>
                    {isValidatingCode 
                      ? 'Validating access code...' 
                      : isSignIn 
                        ? 'Sign in' 
                        : 'Create account'
                    }
                  </span>
                  {!isValidatingCode && (
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  )}
                </Button>
                
                <div className="relative flex items-center justify-center mt-6">
                  <div className="border-t border-border flex-grow" />
                  <span className="mx-3 text-xs text-muted-foreground">or continue with</span>
                  <div className="border-t border-border flex-grow" />
                </div>
                
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || googleLoading}
                  className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {googleLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  ) : (
                    <Globe className="mr-2 h-4 w-4" />
                  )}
                  <span>Continue with Google</span>
                </button>
              </form>
              
              <div className="mt-6 text-center text-sm">
                <span className="text-gray-600">
                  {isSignIn ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button 
                  className="text-blue-600 hover:underline font-medium" 
                  onClick={toggleMode}
                  disabled={isLoading || googleLoading}
                >
                  {isSignIn ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
