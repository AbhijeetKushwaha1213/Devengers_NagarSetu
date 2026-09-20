# Google Sign-In Setup Guide

## Status: ✅ Already Implemented!

Google Sign-In is already fully implemented in your application. You just need to configure it in Supabase.

## How It Works

### Frontend (Already Done ✅)
- **AuthModal Component**: Has "Continue with Google" button
- **Auth Context**: `signInWithGoogle()` function implemented
- **OAuth Flow**: Redirects to Google → Returns to `/auth/callback`
- **Profile Creation**: Automatically creates user profile after sign-in

### What You Need to Do

Configure Google OAuth in Supabase Dashboard.

## Setup Steps

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen if prompted:
   - User Type: External
   - App name: NagarSetu
   - User support email: Your email
   - Developer contact: Your email
6. Application type: **Web application**
7. Name: NagarSetu Web App
8. **Authorized JavaScript origins**:
   - `http://localhost:5173` (for development)
   - `https://yourdomain.com` (for production)
9. **Authorized redirect URIs**:
   - `https://vzqtjhoevvjxdgocnfju.supabase.co/auth/v1/callback`
   - `http://localhost:54321/auth/v1/callback` (if using local Supabase)
10. Click **Create**
11. Copy the **Client ID** and **Client Secret**

### Step 2: Configure in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `vzqtjhoevvjxdgocnfju`
3. Go to **Authentication** → **Providers**
4. Find **Google** in the list
5. Toggle **Enable Sign in with Google**
6. Paste your **Client ID**
7. Paste your **Client Secret**
8. Click **Save**

### Step 3: Test Google Sign-In

1. Restart your dev server (if running)
2. Open your application
3. Click "Sign In" or "Get Started"
4. Click "Continue with Google"
5. You should be redirected to Google sign-in
6. After signing in, you'll be redirected back to your app
7. Your profile should be created automatically

## Troubleshooting

### Error: "OAuth provider not configured"

**Solution**: Enable Google provider in Supabase Dashboard (Step 2 above)

### Error: "redirect_uri_mismatch"

**Solution**: Add the correct redirect URI in Google Cloud Console:
```
https://vzqtjhoevvjxdgocnfju.supabase.co/auth/v1/callback
```

### Error: "Access blocked: This app's request is invalid"

**Solution**: 
1. Check OAuth consent screen is configured
2. Add your email as a test user (if app is in testing mode)
3. Verify authorized domains are correct

### Google Sign-In button doesn't work

**Check 1**: Open browser console (F12) for errors

**Check 2**: Verify Supabase configuration:
```bash
# In Supabase Dashboard → Authentication → Providers
# Google should be enabled with Client ID and Secret
```

**Check 3**: Check if redirect URL is correct:
```typescript
// Should be in SupabaseAuthContext.tsx
redirectTo: `${window.location.origin}/auth/callback`
```

### User redirected but not signed in

**Check**: AuthCallback component at `/auth/callback`
- Should handle the OAuth callback
- Should create user profile
- Should redirect to appropriate page

## Code Reference

### AuthModal Component
Location: `src/components/AuthModal.tsx`

```typescript
const handleGoogleSignIn = async () => {
  setGoogleLoading(true);
  try {
    await signInWithGoogle(redirectTo);
    // User will be redirected to Google
  } catch (error) {
    console.error('Google auth error:', error);
    setGoogleLoading(false);
  }
};
```

### Auth Context
Location: `src/contexts/SupabaseAuthContext.tsx`

```typescript
const signInWithGoogle = async (redirectTo?: string) => {
  if (redirectTo) {
    sessionStorage.setItem('auth_redirect_to', redirectTo);
  }
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
  
  if (error) throw error;
};
```

### Auth Callback
Location: `src/pages/AuthCallback.tsx`

Handles the OAuth callback and creates user profile.

## Testing Checklist

- [ ] Google OAuth credentials created
- [ ] Redirect URI configured in Google Cloud Console
- [ ] Google provider enabled in Supabase
- [ ] Client ID and Secret added to Supabase
- [ ] "Continue with Google" button visible
- [ ] Clicking button redirects to Google
- [ ] After Google sign-in, redirected back to app
- [ ] User profile created automatically
- [ ] User is signed in successfully

## Production Deployment

### Vercel Environment Variables
No additional environment variables needed for Google Sign-In!
The OAuth configuration is stored in Supabase, not in your app.

### Update Redirect URIs
When deploying to production, add your production domain to:

1. **Google Cloud Console** → Authorized redirect URIs:
   ```
   https://yourdomain.com
   https://vzqtjhoevvjxdgocnfju.supabase.co/auth/v1/callback
   ```

2. **Supabase Dashboard** → Authentication → URL Configuration:
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: `https://yourdomain.com/**`

## Security Notes

1. **Never commit** Google Client Secret to git
2. **Use different credentials** for development and production
3. **Restrict OAuth consent screen** to specific domains
4. **Add test users** if app is in testing mode
5. **Verify email domains** if needed

## Support Links

- [Supabase Google OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)

---

**Status**: ✅ Code is ready - Just configure in Supabase Dashboard
**Time Required**: 10-15 minutes
**Difficulty**: Easy
