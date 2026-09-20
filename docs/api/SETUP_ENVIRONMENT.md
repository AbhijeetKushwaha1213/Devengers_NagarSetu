# Environment Setup Guide

## Problem
The map feature is not working because the Google Maps API key is missing.

## Quick Fix

### Step 1: Create `.env.local` File

Create a file named `.env.local` in the root directory with the following content:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://vzqtjhoevvjxdgocnfju.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE

# Google Maps API (REQUIRED for map features)
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE

# Google Cloud Vision API (Optional)
VITE_GOOGLE_CLOUD_VISION_API_KEY=YOUR_VISION_API_KEY_HERE

# Authority Access Code (for admin registration)
VITE_AUTHORITY_ACCESS_CODE=SECURE_CODE_2024
```

### Step 2: Get Your Supabase Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `vzqtjhoevvjxdgocnfju`
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **anon public** key → Use as `VITE_SUPABASE_ANON_KEY`

### Step 3: Get Google Maps API Key

#### Option A: Use Existing Key (If You Have One)
If you already have a Google Maps API key, use it.

#### Option B: Create New Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Geocoding API**
   - **Places API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the API key
6. **Important:** Restrict the key:
   - Click on the key → **Application restrictions**
   - Select "HTTP referrers"
   - Add your domains:
     - `http://localhost:*`
     - `https://yourdomain.com/*`
   - **API restrictions** → Select:
     - Maps JavaScript API
     - Geocoding API
     - Places API

### Step 4: Update `.env.local`

Replace the placeholder values with your actual keys:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key  # Your actual key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key  # Your actual key
VITE_AUTHORITY_ACCESS_CODE=your-authority-access-code
```

### Step 5: Restart Development Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
# or
yarn dev
# or
bun dev
```

### Step 6: Test the Map

1. Open the application
2. Navigate to "Report Issue" page
3. Click on the location field
4. The map should now load correctly

## Troubleshooting

### Map Still Not Loading?

**Check 1: API Key is Set**
```bash
# In your terminal:
echo $VITE_GOOGLE_MAPS_API_KEY
```

**Check 2: Restart Dev Server**
Environment variables are only loaded when the dev server starts.

**Check 3: Check Browser Console**
Open DevTools (F12) → Console tab
Look for errors like:
- "Google Maps API key is missing"
- "RefererNotAllowedMapError"
- "ApiNotActivatedMapError"

**Check 4: Verify API is Enabled**
Go to Google Cloud Console → APIs & Services → Enabled APIs
Ensure these are enabled:
- Maps JavaScript API
- Geocoding API
- Places API

**Check 5: Check Billing**
Google Maps requires billing to be enabled (even for free tier).
Go to Google Cloud Console → Billing

### Common Errors

#### Error: "RefererNotAllowedMapError"
**Solution:** Add your domain to API key restrictions in Google Cloud Console

#### Error: "ApiNotActivatedMapError"
**Solution:** Enable the required APIs in Google Cloud Console

#### Error: "This API project is not authorized to use this API"
**Solution:** Enable billing in Google Cloud Console

#### Map shows but says "For development purposes only"
**Solution:** This is normal for unrestricted keys. Add billing or restrictions.

## Environment Variables Explained

### Required Variables

- **VITE_SUPABASE_URL**: Your Supabase project URL
- **VITE_SUPABASE_ANON_KEY**: Public anonymous key for Supabase
- **VITE_GOOGLE_MAPS_API_KEY**: Google Maps API key (REQUIRED for maps)

### Optional Variables

- **VITE_GOOGLE_CLOUD_VISION_API_KEY**: For AI-powered image analysis
- **VITE_AUTHORITY_ACCESS_CODE**: Secret code for admin registration

## Security Notes

1. **Never commit `.env.local` to git** (it's already in `.gitignore`)
2. **Use different keys for development and production**
3. **Restrict API keys** to specific domains
4. **Rotate keys regularly** if exposed
5. **Use environment variables in Vercel** for production deployment

## Production Deployment

For Vercel deployment, add environment variables in:
**Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add the same variables as in `.env.local` but with production values.

## Quick Command Reference

```bash
# Create .env.local file
touch .env.local

# Edit .env.local
nano .env.local
# or
code .env.local

# Check if file exists
ls -la .env.local

# Restart dev server
npm run dev
```

## Need Help?

- [Google Maps API Documentation](https://developers.google.com/maps/documentation)
- [Supabase API Settings](https://supabase.com/dashboard/project/_/settings/api)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

**Status:** Follow steps above to fix the map feature
**Time Required:** 5-10 minutes
