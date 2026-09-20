# 🚀 Deployment Guide

## Vercel Deployment (Recommended)

### Prerequisites
- GitHub/GitLab repository
- Vercel account
- Environment variables configured

### Step 1: Connect Repository to Vercel

1. **Login to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub/GitLab

2. **Import Project**
   - Click "New Project"
   - Import your repository
   - Select the repository containing your UrbanCare project

### Step 2: Configure Project Settings

1. **Framework Preset**: Vite (auto-detected)
2. **Build Command**: `npm run build` (auto-configured)
3. **Output Directory**: `dist` (auto-configured)
4. **Install Command**: `npm install` (auto-configured)

### Step 3: Environment Variables

Add these environment variables in Vercel Dashboard:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_AUTHORITY_ACCESS_CODE=your_secure_access_code
```

**Important**: 
- Use production values, not development ones
- Generate a new secure authority access code for production
- Ensure Supabase URL and keys are for your production database

### Step 4: Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Your app will be available at `https://your-project.vercel.app`

### Step 5: Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

## Environment-Specific Configuration

### Development
```env
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_AUTHORITY_ACCESS_CODE=DEV_CODE_2024
```

### Production
```env
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_AUTHORITY_ACCESS_CODE=SECURE_PROD_CODE_2024_A7F3E9B2
```

## Build Optimization

### 1. Bundle Analysis
```bash
npm run build
npm run preview
```

### 2. Performance Optimization
- Images are optimized automatically by Vercel
- Static assets are cached with long expiration
- Gzip compression enabled by default

### 3. Security Headers
The `vercel.json` includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Troubleshooting

### Common Issues

1. **Build Fails**
   - Check TypeScript errors: `npm run lint`
   - Verify all dependencies are installed
   - Check environment variables are set

2. **Runtime Errors**
   - Verify environment variables in Vercel dashboard
   - Check Supabase configuration
   - Verify Google Maps API key permissions

3. **Authentication Issues**
   - Update Supabase redirect URLs to include your Vercel domain
   - Check Google OAuth configuration

### Build Logs
- Access build logs in Vercel dashboard
- Use `console.log` for debugging (remove in production)

## Continuous Deployment

### Automatic Deployment
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment

### Manual Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Performance Monitoring

### Vercel Analytics
- Enable in Project Settings → Analytics
- Monitor Core Web Vitals
- Track user interactions

### Lighthouse Scores
- Run Lighthouse audits regularly
- Aim for 90+ scores in all categories
- Monitor performance regressions

## Rollback Strategy

### Quick Rollback
1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "Promote to Production"

### Git-based Rollback
```bash
git revert <commit-hash>
git push origin main
```

## Security Checklist

- [ ] Environment variables are production-ready
- [ ] Authority access codes are secure and rotated
- [ ] Supabase RLS policies are enabled
- [ ] API keys have proper restrictions
- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] Dependencies are up to date

## Post-Deployment

1. **Test Core Functionality**
   - User registration/login
   - Issue reporting
   - Map functionality
   - Authority features

2. **Monitor Performance**
   - Check Vercel Analytics
   - Monitor error rates
   - Verify load times

3. **Update Documentation**
   - Update README with live URL
   - Document any deployment-specific configurations