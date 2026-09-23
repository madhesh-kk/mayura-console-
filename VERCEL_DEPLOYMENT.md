# Complete Fresh Deployment Guide - Vercel

## Project Overview
- **Frontend**: React + Vite (shop-bridge)
- **Backend API**: Node.js + Express (api-server)
- **Database**: Optional PostgreSQL
- **Hosting**: Vercel (both frontend and backend)

---

## STEP 1: Deploy Backend API to Vercel

### 1.1 Create a `vercel.json` in api-server root

Create file: `artifacts/api-server/vercel.json`

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "dist/index.mjs": {
      "runtime": "nodejs20.x"
    }
  }
}
```

### 1.2 Update api-server package.json

Ensure these scripts exist in `artifacts/api-server/package.json`:

```json
"scripts": {
  "dev": "node ./build.mjs && node --enable-source-maps ./dist/index.mjs",
  "build": "node ./build.mjs",
  "start": "node --enable-source-maps ./dist/index.mjs"
}
```

### 1.3 Get your Render API URL (if using Render)

If you already deployed API on Render:
1. Go to https://render.com/dashboard
2. Find your API service
3. Copy the URL (looks like: `https://api-xxxxx.onrender.com`)

**SAVE THIS URL - you'll need it for the frontend**

---

## STEP 2: Deploy Frontend to Vercel

### 2.1 Create `.env.production` in shop-bridge

Create file: `artifacts/shop-bridge/.env.production`

```
VITE_API_URL=https://your-render-api-url.onrender.com
```

Replace with your actual Render API URL from Step 1.3

### 2.2 Create `vercel.json` for frontend

Create file: `vercel.json` (root level)

```json
{
  "version": 2,
  "buildCommand": "pnpm --filter @workspace/shop-bridge run build",
  "outputDirectory": "artifacts/shop-bridge/dist/public",
  "env": {
    "VITE_API_URL": "@vite-api-url"
  },
  "routes": [
    {
      "src": "/(.*)",
      "dest": "artifacts/shop-bridge/dist/public/$1"
    }
  ]
}
```

### 2.3 Commit all changes

```bash
cd e:\transfer_replit\Two-Shop-Order-and-Inventory

git add .

git commit -m "Prepare for Vercel deployment: add vercel.json configs and .env files"

git push origin main
```

---

## STEP 3: Deploy on Vercel (Manual Steps)

### 3.1 Create Vercel Account

1. Go to https://vercel.com
2. Click "Sign Up"
3. Choose "GitHub" to sign up with GitHub
4. Authorize Vercel to access your GitHub repositories

### 3.2 Deploy Frontend First

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. Select your GitHub repository (`madhesh-kk/mayura-console-` or your repo name)
3. Click **"Import"**

**Configure Project Settings:**

- **Framework Preset**: Vite
- **Root Directory**: Leave empty (Vercel will auto-detect)
- **Build Command**: `pnpm --filter @workspace/shop-bridge run build`
- **Output Directory**: `artifacts/shop-bridge/dist/public`
- **Install Command**: `pnpm install`

**Add Environment Variables:**

Click "Environment Variables" and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | Your Render API URL (e.g., `https://api-xxxxx.onrender.com`) |

4. Click **"Deploy"** and wait for deployment to complete

**You'll get a URL like**: `https://mayura-console.vercel.app`

### 3.3 Deploy Backend (Optional - if not using Render)

If you want to deploy API to Vercel too:

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. Select the same GitHub repository
3. Click **"Import"**

**Configure for API:**

- **Framework Preset**: Other
- **Root Directory**: `artifacts/api-server`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

4. Click **"Deploy"**

---

## STEP 4: Verify Deployment

### 4.1 Test Frontend

1. Open your Vercel frontend URL in browser
2. You should see the login page
3. Try logging in with:
   - **Business ID**: `1805` or `180586`
   - **Role**: `shop1` or `shop2`
   - **Name**: Any name

### 4.2 Check if API Connection Works

1. Open browser DevTools (**F12**)
2. Go to **Console** tab
3. Open **Network** tab
4. Try to create an order
5. You should see API requests going to your Render URL

### 4.3 Common Issues

**Issue**: "Business ID verification is unavailable"
- **Solution**: Check that your API URL in `.env.production` is correct
- **Action**: Update environment variable in Vercel → Project Settings → Environment Variables

**Issue**: Page shows 404
- **Solution**: Check that `outputDirectory` is correct in `vercel.json`
- **Action**: Redeploy after fixing

**Issue**: Build fails
- **Solution**: Check build logs in Vercel dashboard
- **Action**: Click on failed deployment → Logs tab

---

## STEP 5: Update API CORS (if needed)

Your API needs to allow requests from your Vercel frontend URL.

### Update `artifacts/api-server/src/app.ts`:

```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:5173',  // Local dev
    'http://localhost:3000',  // Local API
    'https://mayura-console.vercel.app',  // Replace with your Vercel URL
    'https://your-render-api-url.onrender.com',  // Your API URL
  ],
  credentials: true,
}));
```

Then commit and push:

```bash
git add artifacts/api-server/src/app.ts
git commit -m "Add CORS for Vercel frontend URL"
git push origin main
```

**Vercel will auto-redeploy from the new code.**

---

## STEP 6: Final Verification Checklist

- [ ] Frontend deployed on Vercel
- [ ] Backend/API running on Render (or deployed separately)
- [ ] Can access frontend URL in browser
- [ ] Login page loads
- [ ] Can log in with business ID `1805`
- [ ] Can create/view orders
- [ ] Different business IDs show different data
- [ ] No CORS errors in browser console
- [ ] No "Business ID verification" errors

---

## Quick Reference URLs

After deployment, you'll have:

| Service | URL |
|---------|-----|
| Frontend | `https://your-project.vercel.app` |
| API (Render) | `https://api-xxxxx.onrender.com` |
| GitHub Repo | `https://github.com/madhesh-kk/mayura-console-` |
| Vercel Dashboard | `https://vercel.com/dashboard` |

---

## Troubleshooting

### Build Failures

**Check:**
1. Vercel Logs: Dashboard → Project → Deployments → Failed → Logs
2. Ensure `buildCommand` is correct
3. Ensure `outputDirectory` exists after build

**Fix:**
```bash
# Test locally
pnpm --filter @workspace/shop-bridge run build
```

### Runtime Errors

**Check:**
1. Browser Console (F12 → Console)
2. Vercel Function Logs
3. API server logs (if custom)

**Common causes:**
- Wrong API URL in environment variables
- CORS not configured
- API server not running

### API Connection Issues

**Test API manually:**
```bash
curl https://your-render-api-url.onrender.com/api/healthz
```

Should return `200 OK`

---

## Next Steps (Optional)

- [ ] Set up custom domain
- [ ] Enable automatic deployments from GitHub
- [ ] Add monitoring/alerts
- [ ] Configure Firebase for live data sync
- [ ] Set up CI/CD pipeline

---

## Support

- Vercel Docs: https://vercel.com/docs
- Render Docs: https://render.com/docs
- GitHub: https://github.com/madhesh-kk/mayura-console-
