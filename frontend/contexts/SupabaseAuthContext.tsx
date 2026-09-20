import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { User, UserRole } from '@/types';
import { userService } from '@/services/supabaseService';
import { getErrorMessage } from '@/lib/utils';
import { authService, LoginAccessType, LoginInput, LoginResult } from '../../backend/services/auth';
import { getFriendlyAuthErrorMessage } from '@/utils/authErrors';

export interface AuthUser extends SupabaseUser {
  role?: UserRole | string;
  is_active?: boolean;
}

interface AuthContextType {
  // User state
  currentUser: AuthUser | null;
  userProfile: User | null;
  session: Session | null;
  loading: boolean;
  isNewUser: boolean;
  
  // Auth methods
  signUp: (
    email: string, 
    password: string, 
    name: string, 
    role?: UserRole, 
    department_id?: string,
    authorityAccessCode?: string
  ) => Promise<void>;
  signIn: (email: string, password: string, accessType?: LoginAccessType) => Promise<LoginResult>;
  login: (input: LoginInput) => Promise<LoginResult>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  logOut: () => Promise<void>;
  
  // Profile methods
  updateProfile: (profileData: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  
  // Utility methods
  isMunicipalAdmin: () => boolean;
  isWorker: () => boolean;
  isCitizen: () => boolean;
  isAuthority: () => boolean; // Legacy alias for isMunicipalAdmin
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const { toast } = useToast();

  const userProfileRef = useRef<User | null>(null);
  const isLoggingInRef = useRef<boolean>(false);
  const isLoadingProfileRef = useRef<string | null>(null);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  // Load user profile from database on initial load or session recovery
  const loadUserProfile = useCallback(async (userId: string, email?: string) => {
    if (isLoadingProfileRef.current === userId) {
      return;
    }
    isLoadingProfileRef.current = userId;

    try {
      console.log('[loadUserProfile] Fetching user profile for uid:', userId);
      const profile = await authService.getUserProfile(userId);
      
      if (profile && profile.full_name && profile.role) {
        const normalized: User = {
          id: profile.id,
          email: profile.email || email,
          full_name: profile.full_name,
          role: profile.role as UserRole,
          is_active: Boolean(profile.is_active),
          municipality_id: profile.municipality_id || undefined,
          ward_id: profile.ward_id || undefined,
          department_id: profile.department_id || undefined,
          employee_id: profile.employee_id || undefined,
        };
        setUserProfile(normalized);
        userProfileRef.current = normalized;
        setIsNewUser(false);

        // Enrich currentUser with role and is_active
        setCurrentUser((prev) => {
          if (!prev) return null;
          return Object.assign(prev, {
            role: profile.role,
            is_active: Boolean(profile.is_active),
          });
        });
      } else {
        // User has no user_profiles record or incomplete name/role
        setUserProfile(null);
        userProfileRef.current = null;
        setIsNewUser(true);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      setUserProfile(null);
      userProfileRef.current = null;
      setIsNewUser(true);
    } finally {
      isLoadingProfileRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) {
        setCurrentUser(session.user as AuthUser);
        loadUserProfile(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      if (!isMounted) return;
      console.error('Error fetching initial auth session:', err);
      setLoading(false);
    });

    // Listen for auth state changes synchronously without nested blocking queries
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      console.log('Auth state changed:', event, newSession?.user ? newSession.user.email : 'No user');
      setSession(newSession);

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setCurrentUser(null);
        setUserProfile(null);
        userProfileRef.current = null;
        setIsNewUser(false);
        setLoading(false);
        return;
      }

      // If active login flow is in progress, it handles profile state directly
      if (isLoggingInRef.current) {
        return;
      }

      // If user profile is already loaded for this user in memory, don't query user_profiles again
      if (userProfileRef.current && userProfileRef.current.id === newSession.user.id) {
        const enrichedUser = Object.assign(newSession.user, {
          role: userProfileRef.current.role,
          is_active: userProfileRef.current.is_active,
        });
        setCurrentUser(enrichedUser);
        setLoading(false);
        return;
      }

      // Defer profile fetch outside of the synchronous Supabase Auth event loop
      setTimeout(() => {
        if (isMounted && !isLoggingInRef.current) {
          loadUserProfile(newSession.user.id, newSession.user.email);
        }
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  /**
   * Canonical login method executing the unified authentication pipeline:
   * Portal Login -> authService.login() -> user_profiles -> AuthenticatedUser -> State
   */
  const login = async (input: LoginInput): Promise<LoginResult> => {
    isLoggingInRef.current = true;
    setLoading(true);
    try {
      console.log(`Executing canonical login for accessType: ${input.accessType}`);
      const result = await authService.login(input);

      // Establish authenticated state immediately with returned AuthenticatedUser
      const normalizedUser: User = {
        id: result.user.id,
        email: result.user.email,
        full_name: result.user.full_name,
        role: result.user.role as UserRole,
        is_active: result.user.is_active,
        municipality_id: result.user.municipality_id || undefined,
        ward_id: result.user.ward_id || undefined,
        department_id: result.user.department_id || undefined,
        employee_id: result.user.employee_id || undefined,
      };

      setUserProfile(normalizedUser);
      userProfileRef.current = normalizedUser;
      setIsNewUser(false);

      // Synchronize session and enriched current user
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session);

      if (sessionData.session?.user) {
        const enrichedUser: AuthUser = Object.assign(sessionData.session.user, {
          role: result.user.role as UserRole,
          is_active: result.user.is_active,
        });
        setCurrentUser(enrichedUser);
      }

      return result;
    } catch (error) {
      console.error("Canonical login error:", error);
      const friendlyMessage = getFriendlyAuthErrorMessage(error);
      toast({
        title: "Sign in failed",
        description: friendlyMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      isLoggingInRef.current = false;
      setLoading(false);
    }
  };

  /**
   * Alias for backwards compatibility with existing UI components
   */
  const signIn = async (
    email: string, 
    password: string, 
    accessType: LoginAccessType = 'citizen'
  ): Promise<LoginResult> => {
    return login({ email, password, accessType });
  };

  const signUp = async (
    email: string, 
    password: string, 
    name: string, 
    role: UserRole = 'citizen', 
    department_id?: string,
    authorityAccessCode?: string
  ) => {
    try {
      console.log('Attempting to sign up:', email, 'with role:', role);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        try {
          const profile = await userService.createProfile({
            id: data.user.id,
            full_name: name,
            role: role || 'citizen',
            department_id: department_id || undefined,
          });
          
          const normalized: User = {
            ...profile,
            email: data.user.email || email,
            role: (profile.role || role) as UserRole,
            is_active: true,
          };
          setUserProfile(normalized);
          userProfileRef.current = normalized;
          setIsNewUser(false);
          console.log('User profile created successfully');
        } catch (profileError) {
          console.error('Error creating user profile:', profileError);
          const fallback: User = {
            id: data.user.id,
            email: data.user.email || email,
            full_name: name,
            role: role || 'citizen',
            is_active: true,
            department_id,
          };
          setUserProfile(fallback);
          userProfileRef.current = fallback;
          setIsNewUser(false);
        }
        
        toast({
          title: "Account created",
          description: "Welcome to Nagar Setu! Your account is ready.",
        });
      }
    } catch (error) {
      console.error("Sign up error:", error);
      
      const errorMessage = getErrorMessage(error as Error);
      let userFriendlyMessage = errorMessage;
      
      if (errorMessage.includes('already registered')) {
        userFriendlyMessage = "An account with this email already exists";
      } else if (errorMessage.includes('invalid email')) {
        userFriendlyMessage = "Please enter a valid email address";
      } else if (errorMessage.includes('password')) {
        userFriendlyMessage = "Password should be at least 6 characters";
      }
      
      toast({
        title: "Sign up failed",
        description: userFriendlyMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    try {
      if (redirectTo) {
        sessionStorage.setItem('auth_redirect_to', redirectTo);
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error("Google sign in error:", error);
      const err = error as Error;
      toast({
        title: "Google sign in failed",
        description: err.message || "Please check configuration.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logOut = async () => {
    try {
      await authService.signOut();
      setUserProfile(null);
      userProfileRef.current = null;
      setCurrentUser(null);
      setSession(null);
      setIsNewUser(false);
    } catch (error) {
      console.error("Sign out error:", error);
      const err = error as Error;
      toast({
        title: "Sign out failed",
        description: err.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Profile management methods
  const updateProfile = async (profileData: Partial<User>) => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }
    
    try {
      const updatedProfile = await userService.updateProfile(currentUser.id, profileData);
      const normalized: User = {
        ...updatedProfile,
        email: currentUser.email,
        role: updatedProfile.role as UserRole,
      };
      setUserProfile(normalized);
      userProfileRef.current = normalized;
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Update failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      await loadUserProfile(currentUser.id, currentUser.email);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  // Utility role verification methods
  const isMunicipalAdmin = () => 
    userProfile?.role === 'municipal_admin' || 
    userProfile?.role === 'administrator' || 
    userProfile?.role === 'pradhan';

  const isWorker = () => 
    userProfile?.role === 'worker' || 
    userProfile?.role === 'panchayat_worker';

  const isCitizen = () => 
    userProfile?.role === 'citizen' || 
    userProfile?.role === 'community_member' || 
    (!isMunicipalAdmin() && !isWorker());

  // Backwards compatibility alias
  const isAuthority = () => isMunicipalAdmin();
  
  const hasPermission = (permission: string) => {
    if (!userProfile) return false;
    
    switch (permission) {
      case 'manage_issues':
        return isMunicipalAdmin() || isWorker();
      case 'assign_issues':
        return isMunicipalAdmin();
      case 'create_events':
        return isMunicipalAdmin();
      case 'report_issues':
        return true;
      case 'comment_issues':
        return true;
      default:
        return false;
    }
  };

  const value: AuthContextType = {
    // User state
    currentUser,
    userProfile,
    session,
    loading,
    isNewUser,
    
    // Auth methods
    signUp,
    signIn,
    login,
    signInWithGoogle,
    logOut,
    
    // Profile methods
    updateProfile,
    refreshProfile,
    
    // Utility methods
    isMunicipalAdmin,
    isWorker,
    isCitizen,
    isAuthority,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};