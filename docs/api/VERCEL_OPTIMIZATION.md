# ⚡ Vercel Optimization Guide

## Overview

This guide covers specific optimizations for deploying UrbanCare on Vercel, ensuring maximum performance, security, and reliability.

## 🚀 Build Optimizations

### 1. Vite Configuration

Our `vite.config.ts` is optimized for Vercel:

```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimizations for Vercel
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          maps: ['@googlemaps/js-api-loader', '@googlemaps/react-wrapper'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    }
  }
}));
```

### 2. Bundle Splitting

Automatic code splitting is configured to:
- Separate vendor libraries
- Split Google Maps components
- Isolate UI components
- Reduce initial bundle size

### 3. Asset Optimization

```json
// vercel.json - Asset caching
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 🔒 Security Configuration

### 1. Security Headers

```json
// vercel.json - Security headers
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### 2. Environment Variables Security

**Development vs Production**:
```bash
# Development (.env.local)
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_AUTHORITY_ACCESS_CODE=DEV_CODE_2024

# Production (Vercel Dashboard)
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_AUTHORITY_ACCESS_CODE=SECURE_PROD_CODE_2024_A7F3E9B2C1D4F6H8
```

**Best Practices**:
- Never commit `.env.local` to git
- Use different values for dev/prod
- Rotate authority access codes regularly
- Use Vercel's environment variable encryption

## 📊 Performance Optimizations

### 1. Image Optimization

Vercel automatically optimizes images, but we can help:

```typescript
// Use Vercel Image Optimization
const optimizedImageUrl = `/_vercel/image?url=${encodeURIComponent(imageUrl)}&w=800&q=75`;
```

### 2. Lazy Loading

```typescript
// Lazy load heavy components
const IssueMap = lazy(() => import('@/components/IssueMap'));
const AuthorityDashboard = lazy(() => import('@/pages/AuthorityDashboard'));

// Use with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <IssueMap />
</Suspense>
```

### 3. Preloading Critical Resources

```html
<!-- In index.html -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://maps.googleapis.com">
<link rel="preconnect" href="https://your-project.supabase.co">
```

## 🌐 CDN and Caching Strategy

### 1. Static Asset Caching

```json
// vercel.json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=86400"
        }
      ]
    }
  ]
}
```

### 2. API Response Caching

```typescript
// Service Worker for API caching (optional)
const CACHE_NAME = 'urbancare-api-v1';
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache Supabase responses
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## 🔄 Deployment Pipeline

### 1. Automatic Deployments

```yaml
# .github/workflows/deploy.yml (if using GitHub Actions)
name: Deploy to Vercel
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm run test
      - name: Build
        run: npm run build
      - name: Deploy to Vercel
        uses: vercel/action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

### 2. Preview Deployments

Vercel automatically creates preview deployments for:
- Pull requests
- Non-main branch pushes
- Manual deployments

### 3. Deployment Checks

```bash
# Use our deployment script
npm run deploy:check

# Manual checks
npm run lint
npm run type-check
npm run build
```

## 📈 Monitoring and Analytics

### 1. Vercel Analytics

Enable in Vercel Dashboard:
- Core Web Vitals monitoring
- Real User Monitoring (RUM)
- Performance insights
- Error tracking

### 2. Custom Monitoring

```typescript
// Performance monitoring
export const trackPerformance = (name: string, duration: number) => {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    window.gtag('event', 'timing_complete', {
      name: name,
      value: Math.round(duration)
    });
  }
};

// Error tracking
export const trackError = (error: Error, context?: string) => {
  console.error('Application Error:', error, context);
  
  // Send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Integration with error tracking service
  }
};
```

## 🔧 Vercel-Specific Features

### 1. Static Site Optimization

This project is configured as a static site with no serverless functions, optimized for:
- Fast global CDN delivery
- Automatic image optimization
- Edge caching
- Security headers

### 2. Future Enhancements

If you need serverless functionality in the future, you can add:
- Edge functions for dynamic content
- API routes for backend logic
- Middleware for request processing

### 3. Incremental Static Regeneration (ISR)

For future static content:
```typescript
// For blog posts or documentation
export async function getStaticProps() {
  return {
    props: { /* data */ },
    revalidate: 60, // Regenerate every 60 seconds
  };
}
```

## 🚨 Troubleshooting

### Common Vercel Issues

1. **Build Timeouts**
   - Optimize dependencies
   - Use build cache
   - Split large bundles

2. **Memory Issues**
   - Reduce bundle size
   - Optimize images
   - Use lazy loading

3. **Environment Variables**
   - Check variable names (case-sensitive)
   - Verify values in Vercel dashboard
   - Redeploy after changes

### Performance Debugging

```bash
# Analyze bundle size
npm run build:analyze

# Check build output
npm run build && ls -la dist/

# Test production build locally
npm run preview
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Build passes locally
- [ ] Linting passes
- [ ] TypeScript compilation succeeds
- [ ] No console errors in production build

### Post-Deployment
- [ ] Site loads correctly
- [ ] Authentication works
- [ ] Maps functionality works
- [ ] Database connections work
- [ ] All routes accessible
- [ ] Performance metrics acceptable

### Security Checklist
- [ ] Environment variables are production-ready
- [ ] No hardcoded secrets in code
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] API keys have proper restrictions

## 🎯 Performance Targets

### Core Web Vitals
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Bundle Size Targets
- **Initial Bundle**: < 200KB gzipped
- **Total JavaScript**: < 500KB gzipped
- **Images**: WebP format, optimized sizes

### Loading Performance
- **Time to Interactive**: < 3s
- **First Contentful Paint**: < 1.5s
- **Speed Index**: < 2s

This optimization guide ensures your UrbanCare deployment on Vercel is fast, secure, and reliable!