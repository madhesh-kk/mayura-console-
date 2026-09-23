# Deployment Guide - Steepbridge Two-Shop Order & Inventory App

## Current Status
- ✅ **API Server**: Already deployed on Render (https://your-render-api-url.onrender.com)
- ⏳ **Frontend (shop-bridge)**: Ready to deploy

## Deployment Steps

### Step 1: Update Your Render API URL
Replace `https://your-render-api-url.onrender.com` with your actual Render API URL in:

**File: `artifacts/shop-bridge/.env.production`**
```
VITE_API_URL=https://your-actual-render-api-url.onrender.com
```

Get your actual URL from your Render dashboard:
1. Go to [render.com](https://render.com)
2. Find your API service (e.g., "api-server")
3. Copy the URL from the dashboard (looks like `https://api-dapptkt2...onrender.com`)

### Step 2: Commit Changes to Git
```bash
cd e:\transfer_replit\Two-Shop-Order-and-Inventory

# Stage all changes
git add .

# Commit the deployment configurations
git commit -m "Prepare for production deployment: fix Tailwind CSS, add business ID data isolation"

# Push to GitHub
git push origin main
```

### Step 3: Deploy Frontend on Render

#### Option A: Deploy as Static Site (Recommended)

1. Go to [render.com](https://render.com)
2. Click **New +** → **Static Site**
3. Select your GitHub repository
4. Fill in the settings:
   - **Name**: `shop-bridge` (or your preferred name)
   - **Build Command**: `pnpm --filter @workspace/shop-bridge run build`
   - **Publish Directory**: `artifacts/shop-bridge/dist/public`
   - **Environment**: Leave as default (Node.js)

5. Add Environment Variables:
   ```
   VITE_API_URL = https://your-render-api-url.onrender.com
   ```

6. Click **Create Static Site** and wait for deployment

#### Option B: Deploy with Custom Domain
If you have a custom domain:
1. After deployment completes, go to your site settings
2. Click **Add Custom Domain**
3. Enter your domain and follow DNS setup instructions

### Step 4: Configure API CORS (if needed)

Your API server on Render needs to allow requests from your frontend URL.

**Update `artifacts/api-server/src/app.ts`:**
```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:5173',  // Dev
    'https://your-shop-bridge-url.onrender.com',  // Production
  ],
  credentials: true,
}));
```

Then redeploy your API:
```bash
git add artifacts/api-server/src/app.ts
git commit -m "Add CORS for production frontend URL"
git push origin main
```

### Step 5: Test the Deployed App

1. Open your deployed frontend URL in a browser
2. Try logging in:
   - **Business ID**: `1805` or `180586`
   - **Role**: Select `shop1` or `shop2`
   - **Name**: Any name

3. Verify:
   - ✅ Data persists after login/logout
   - ✅ Different business IDs show different data
   - ✅ Orders, inventory, and restocks work

### Troubleshooting

#### Problem: "Business ID verification is unavailable"
- **Solution**: Check that your API is running on Render and the `VITE_API_URL` is correct
- **Check**: Open browser DevTools → Network tab and verify API calls are going to the right URL

#### Problem: "Cannot GET /api/..."
- **Solution**: API server may have crashed or CORS is not configured
- **Check**: Visit your Render API URL directly to see if it's running

#### Problem: Data not persisting between sessions
- **Solution**: This is normal in demo mode (localStorage). For Firebase integration:
  1. Set up a Firebase project
  2. Add Firebase credentials as environment variables:
     ```
     VITE_FIREBASE_API_KEY=...
     VITE_FIREBASE_PROJECT_ID=...
     VITE_FIREBASE_DATABASE_URL=...
     ```

### Environment Variables Summary

**For Frontend (`shop-bridge`)**:
- `VITE_API_URL`: Your Render API base URL

**For API Server**:
- `DATABASE_URL`: PostgreSQL connection string (if using database)
- `CORS_ORIGIN`: Frontend URL for CORS

### Next Steps

1. **Set up a custom domain** (optional but recommended)
2. **Configure Firebase** for live data sync across multiple shops
3. **Set up monitoring** on Render to track uptime and errors
4. **Configure automatic deployments** from GitHub (already enabled by default)

### Support

For issues:
- Check Render logs: Dashboard → your service → Logs
- Review browser console for errors (DevTools → Console)
- Verify environment variables are set correctly

---

## Rollback Guide

If something goes wrong:

```bash
# Revert last commit
git revert HEAD

# Push to GitHub
git push origin main

# Render will auto-redeploy from the updated code
```

## Quick Verification Checklist

- [ ] API is running on Render
- [ ] Frontend builds successfully: `pnpm --filter @workspace/shop-bridge run build`
- [ ] `VITE_API_URL` points to actual Render API URL
- [ ] Git changes committed and pushed
- [ ] Frontend deployed on Render
- [ ] Can log in with business IDs
- [ ] Data persists across sessions
- [ ] No CORS errors in console
