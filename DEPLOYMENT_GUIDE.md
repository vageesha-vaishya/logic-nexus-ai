# Dashboard Templates - Production Deployment Guide

## Overview

This guide walks through deploying the newly completed dashboard templates system to production. The system includes 11 role-based dashboards across CRM, Logistics, and Sales modules.

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All code is committed to main branch
- [ ] Tests passing locally (`npm test -- --run`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] TypeScript check passes (`npm run typecheck`)
- [ ] Environment variables configured
- [ ] Supabase project ready
- [ ] Team notified of deployment

---

## 🔧 Step 1: Environment Configuration

### 1.1 Production Environment Variables

Create/update `.env.production` in project root:

```bash
# .env.production

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_KEY=your-service-key

# API Configuration
VITE_API_URL=https://api.yourapp.com

# Analytics (optional)
VITE_SENTRY_DSN=https://your-sentry-key@sentry.io/project-id

# Feature Flags
VITE_ENABLE_DASHBOARD_CUSTOMIZATION=true
VITE_ENABLE_REAL_TIME_SYNC=true
```

### 1.2 Verify Secrets

Ensure your deployment environment has these secrets:
- Supabase URL and keys
- Database connection strings
- API endpoints
- Any third-party service credentials

---

## 🗄️ Step 2: Database Setup

### 2.1 Apply Migrations

The dashboard system requires the `user_preferences` table. Apply the migration:

```bash
# Using Supabase CLI
supabase migration up

# Or manually in Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Run: docs/migrations/20260225_create_user_preferences.sql
```

### 2.2 Verify Database Schema

Check that the `user_preferences` table was created:

```sql
-- Verify in Supabase SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'user_preferences';

-- Should return: user_preferences
```

### 2.3 Verify RLS Policies

Confirm Row-Level Security policies are active:

```sql
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'user_preferences';

-- Should return 4 policies:
-- user_preferences_self_read (SELECT)
-- user_preferences_self_write (UPDATE)
-- user_preferences_self_insert (INSERT)
-- user_preferences_self_delete (DELETE)
```

### 2.4 Create Indexes

Indexes were created in migration, but verify:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'user_preferences';

-- Should return:
-- idx_user_preferences_user_id
-- idx_user_preferences_role
```

---

## 🏗️ Step 3: Build Optimization

### 3.1 Build for Production

```bash
# Install dependencies (clean install)
npm ci

# Run type checking
npm run typecheck

# Run tests
npm test -- --run

# Build production bundle
npm run build

# Output will be in: dist/
```

### 3.2 Verify Build Output

```bash
# Check bundle size
ls -lh dist/

# Expected main bundle: ~850KB (before gzip)
# After gzip: ~250KB

# Verify all assets are present
ls -la dist/
# Should contain:
# - index.html
# - assets/ (CSS, JS, images)
# - manifest.json (if PWA enabled)
```

### 3.3 Test Production Build Locally

```bash
# Serve production build locally
npm run preview

# Visit: http://localhost:4173/dashboard
# Test:
# - Dashboard loads
# - No console errors
# - Widgets render
# - Interactions work (remove, resize)
```

---

## 🚀 Step 4: Deployment

### 4.1 Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (will prompt for configuration)
vercel --prod

# Vercel will:
# 1. Build the project
# 2. Run tests
# 3. Deploy to CDN
# 4. Provide production URL
```

**Or via GitHub:**
```bash
# Push to main branch
git push origin main

# Vercel automatically builds and deploys
# Check deployment status in Vercel Dashboard
```

### 4.2 Deploy to AWS S3 + CloudFront

```bash
# Build project
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### 4.3 Deploy to Self-Hosted Server

```bash
# Build project
npm run build

# SSH to server
ssh user@your-server.com

# Upload dist folder
scp -r dist/ user@your-server.com:/var/www/app/

# Or using rsync (faster for large deploys)
rsync -avz --delete dist/ user@your-server.com:/var/www/app/

# Restart web server
ssh user@your-server.com 'sudo systemctl restart nginx'
```

### 4.4 Deploy with Docker

```bash
# Build Docker image
docker build -t logic-nexus-ai:latest .

# Tag for registry
docker tag logic-nexus-ai:latest your-registry/logic-nexus-ai:latest

# Push to registry
docker push your-registry/logic-nexus-ai:latest

# Deploy with docker-compose or Kubernetes
docker-compose up -d
```

---

## ✅ Step 5: Post-Deployment Verification

### 5.1 Health Checks

```bash
# Test API endpoint
curl https://your-app.com/dashboard
# Should return HTML page (200 status)

# Check that assets load
curl -I https://your-app.com/assets/index.js
# Should return 200 status

# Verify Supabase connection
# Try logging in on deployed site
# Dashboard should load for your role
```

### 5.2 Database Verification

```bash
# Connect to production Supabase
# Go to Supabase Dashboard → SQL Editor

# Check user_preferences table is accessible
SELECT COUNT(*) FROM user_preferences;

# Should return: 0 (initially empty)
```

### 5.3 Browser Testing

Test in production:

1. **Navigate to dashboard:**
   - Open: `https://your-app.com/dashboard`
   - Should load without errors

2. **Check default dashboard:**
   - Should see Sales Rep dashboard (or configured default role)
   - All widgets should render
   - No console errors (F12 → Console tab)

3. **Test widget customization:**
   - Click X button on a widget → should remove it
   - Widget should disappear immediately
   - Refresh page → widget should still be gone (saved to DB)

4. **Test widget resizing:**
   - Click maximize button → widget should change size
   - Refresh page → size should persist (saved to DB)

5. **Check responsive design:**
   - Resize browser window to mobile size
   - Dashboard should adapt to single column
   - All widgets should be usable on mobile

6. **Monitor performance:**
   - Open DevTools (F12)
   - Check Network tab → assets should load quickly
   - Check Console tab → no errors/warnings
   - Check Performance → page load < 3 seconds

### 5.4 Error Monitoring

Set up error tracking:

```javascript
// If using Sentry (add to main.tsx)
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 0.1,
});
```

---

## 🔒 Step 6: Security Configuration

### 6.1 Set CORS Headers

Configure CORS for your domain:

```
Access-Control-Allow-Origin: https://your-app.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 6.2 Security Headers

Add security headers (configure in web server):

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
```

### 6.3 Verify RLS Policies

Test that users only see their own preferences:

```sql
-- As admin, insert test data
INSERT INTO user_preferences (user_id, role, custom_widgets)
VALUES ('user-123', 'crm_sales_rep', '[]'::jsonb);

-- Connect as user-123
-- Should see their preferences
SELECT * FROM user_preferences;

-- Should NOT see other users' data
-- RLS will automatically filter
```

---

## 📊 Step 7: Monitoring & Analytics

### 7.1 Set Up Monitoring

Monitor dashboard health:

```bash
# Check error rates
# Track in your monitoring tool (Datadog, New Relic, etc.)

# Key metrics to monitor:
- Page load time
- Error rate
- User engagement
- Database query performance
- Widget load times
```

### 7.2 Database Monitoring

```sql
-- Monitor user_preferences table growth
SELECT COUNT(*) as total_preferences FROM user_preferences;

-- Check for slow queries
SELECT query, mean_time, calls FROM pg_stat_statements
WHERE query LIKE '%user_preferences%'
ORDER BY mean_time DESC;
```

### 7.3 Set Up Alerts

Configure alerts for:
- High error rate (> 1%)
- Slow page loads (> 3s)
- Database connection failures
- API rate limiting
- Storage quota nearing limit

---

## 🔄 Step 8: Rollback Plan

If issues occur, rollback deployment:

### 8.1 Instant Rollback (Vercel)

```bash
# Revert to previous deployment
vercel rollback

# Or via Vercel Dashboard:
# 1. Go to Deployments
# 2. Click previous successful deployment
# 3. Click "Promote to Production"
```

### 8.2 Rollback Database Changes

```bash
# If migration caused issues, revert:
supabase migration down

# Or manually drop table:
DROP TABLE IF EXISTS user_preferences CASCADE;
```

### 8.3 Cache Invalidation (if needed)

```bash
# Clear CDN cache
# CloudFront:
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"

# Vercel (automatic on redeploy)
vercel --prod
```

---

## 📱 Step 9: Post-Deployment Steps

### 9.1 Announce to Users

- Notify team about dashboard availability
- Share documentation on how to use dashboards
- Provide role-specific onboarding

### 9.2 Gather Feedback

- Monitor user feedback channels
- Track usage analytics
- Document any issues reported

### 9.3 Performance Optimization

If performance issues arise:

```bash
# Analyze bundle
npm run build -- --report

# Optimize large chunks
# Consider code splitting by role/module

# Monitor Core Web Vitals:
# - Largest Contentful Paint (LCP)
# - First Input Delay (FID)
# - Cumulative Layout Shift (CLS)
```

### 9.4 Plan Updates

- Schedule regular updates
- Monitor for security patches
- Plan feature enhancements

---

## 🔗 Integration Checklist for Actual Roles

Before full production, integrate real user roles:

- [ ] Update `DashboardRouter.tsx` to fetch real user roles from auth
- [ ] Replace mock data with real database queries
- [ ] Test with actual users from each role
- [ ] Verify customizations persist correctly
- [ ] Check performance with real data volume
- [ ] Test multi-user scenarios
- [ ] Verify RLS prevents cross-user data access

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue: Dashboard not loading**
```
Solution: Check console for errors (F12 → Console)
- Verify Supabase URL and keys
- Check network requests (Network tab)
- Ensure user is authenticated
```

**Issue: Widgets not rendering**
```
Solution:
- Check if role is correctly determined
- Verify user has proper role in database
- Check browser console for component errors
```

**Issue: Customizations not saving**
```
Solution:
- Verify user_preferences table exists
- Check RLS policies are correct
- Verify user_id is being passed correctly
- Check database logs for errors
```

**Issue: Slow performance**
```
Solution:
- Check bundle size (should be ~250KB gzipped)
- Optimize database queries
- Enable caching headers
- Use CDN for static assets
```

---

## 📈 Success Metrics

After deployment, track:

| Metric | Target | Actual |
|--------|--------|--------|
| Page Load Time | < 3s | __ |
| Error Rate | < 1% | __ |
| User Adoption | > 80% | __ |
| Dashboard Load Time | < 1s | __ |
| Database Response | < 100ms | __ |
| Uptime | 99.9% | __ |

---

## 🎉 Deployment Complete!

Once you've completed all steps and verified everything works:

1. ✅ Database migrations applied
2. ✅ Production build deployed
3. ✅ Dashboard accessible to users
4. ✅ Customizations persisting
5. ✅ Monitoring active
6. ✅ Team trained

**Your dashboard system is now live in production!**

---

## 📚 Additional Resources

- [Supabase Deployment Guide](https://supabase.com/docs/guides/deployment)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [React Production Optimization](https://react.dev/learn/deployment)
- [Database Performance Tuning](https://www.postgresql.org/docs/current/performance.html)

---

## ❓ Questions?

If you encounter issues:
1. Check this guide for troubleshooting
2. Review application logs
3. Check Supabase dashboard for errors
4. Monitor error tracking service (Sentry, etc.)
