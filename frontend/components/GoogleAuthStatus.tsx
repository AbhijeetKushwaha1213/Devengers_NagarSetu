import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GoogleAuthStatusProps {
  onClose?: () => void;
}

export default function GoogleAuthStatus({ onClose }: GoogleAuthStatusProps) {
  const [status, setStatus] = useState<{
    configured: boolean;
    testing: boolean;
    error?: string;
  }>({ configured: false, testing: true });

  useEffect(() => {
    checkGoogleAuthStatus();
  }, []);

  const checkGoogleAuthStatus = async () => {
    setStatus({ configured: false, testing: true });
    
    try {
      // Try to initiate Google OAuth to see if it's configured
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true // This prevents actual redirect
        }
      });

      if (error) {
        if (error.message?.includes('OAuth') || error.message?.includes('provider')) {
          setStatus({ 
            configured: false, 
            testing: false, 
            error: 'Google OAuth provider not configured in Supabase' 
          });
        } else {
          setStatus({ 
            configured: false, 
            testing: false, 
            error: error.message 
          });
        }
      } else {
        setStatus({ configured: true, testing: false });
      }
    } catch (error) {
      const err = error as Error;
      setStatus({ 
        configured: false, 
        testing: false, 
        error: err.message || 'Unknown error' 
      });
    }
  };

  const getStatusIcon = () => {
    if (status.testing) {
      return <AlertCircle className="h-5 w-5 text-yellow-500 animate-pulse" />;
    }
    return status.configured 
      ? <CheckCircle className="h-5 w-5 text-green-500" />
      : <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusBadge = () => {
    if (status.testing) {
      return <Badge variant="outline" className="text-yellow-600">Testing...</Badge>;
    }
    return status.configured 
      ? <Badge className="bg-green-100 text-green-800">Configured</Badge>
      : <Badge variant="destructive">Not Configured</Badge>;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getStatusIcon()}
            Google OAuth Status
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.testing ? (
          <p className="text-sm text-gray-600">Checking Google OAuth configuration...</p>
        ) : status.configured ? (
          <div className="space-y-2">
            <p className="text-sm text-green-700">
              ✅ Google OAuth is properly configured and ready to use.
            </p>
            <p className="text-xs text-gray-500">
              Users can sign in with their Google accounts.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-700">
              ❌ Google OAuth is not configured properly.
            </p>
            {status.error && (
              <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                Error: {status.error}
              </p>
            )}
            <div className="text-xs text-gray-600 space-y-1">
              <p className="font-medium">To fix this:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Set up Google OAuth in Google Cloud Console</li>
                <li>Enable Google provider in Supabase Authentication</li>
                <li>Add your Client ID and Secret to Supabase</li>
              </ol>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => window.open('https://console.cloud.google.com/', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Google Cloud Console
            </Button>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkGoogleAuthStatus}
            disabled={status.testing}
          >
            Recheck
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}