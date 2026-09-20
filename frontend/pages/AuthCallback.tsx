import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if this callback is for password recovery
        if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')) {
          navigate('/reset-password' + window.location.search + window.location.hash);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          toast({
            title: "Authentication failed",
            description: error.message,
            variant: "destructive",
          });
          navigate('/');
          return;
        }

        if (data.session) {
          console.log('Google authentication successful');
          
          // Check if user profile exists
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .single();

          if (profileError && profileError.code === 'PGRST116') {
            // Profile doesn't exist, create one
            const { error: insertError } = await supabase
              .from('user_profiles')
              .insert([
                {
                  id: data.session.user.id,
                  full_name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name || 'Citizen',
                  role: 'citizen',
                }
              ]);

            if (insertError) {
              console.error('Error creating user profile:', insertError);
            }
          }

          toast({
            title: "Welcome!",
            description: "You've successfully signed in with Google.",
          });

          // Redirect to the intended page or dashboard
          const redirectTo = sessionStorage.getItem('auth_redirect_to');
          sessionStorage.removeItem('auth_redirect_to');
          navigate(redirectTo || '/dashboard');
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Completing sign in...</h2>
        <p className="text-gray-600">Please wait while we finish setting up your account.</p>
      </div>
    </div>
  );
}