# Quick Start Deployment Checklist

## Prerequisites
✅ GitHub account with your code pushed
✅ Render API URL (if you deployed API on Render)

---

## 5 SIMPLE STEPS

### STEP 1: Create Environment File
**File**: `artifacts/shop-bridge/.env.production`

```
VITE_API_URL=https://your-render-api-url.onrender.com
```

### STEP 2: Create Vercel Config
**File**: `vercel.json` (in root)

```json
{
  "version": 2,
  "buildCommand": "pnpm --filter @workspace/shop-bridge run build",
  "outputDirectory": "artifacts/shop-bridge/dist/public"
}
```

### STEP 3: Push to GitHub

```bash
git add .
git commit -m "Prepare deployment"
git push origin main
```

### STEP 4: Deploy on Vercel

1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repository
4. **Build Command**: `pnpm --filter @workspace/shop-bridge run build`
5. **Output Directory**: `artifacts/shop-bridge/dist/public`
6. Add Environment Variable: `VITE_API_URL` = your Render URL
7. Click "Deploy"

### STEP 5: Test

1. Open the Vercel URL provided
2. Log in with Business ID `1805`
3. Create a test order
4. Verify data appears

---

## That's it! 🎉

Your app is now live on Vercel!

**Frontend URL**: https://your-project.vercel.app  
**API URL**: https://your-render-api.onrender.com

---

## If Something Goes Wrong

1. Check Vercel Logs: Dashboard → Deployments → Failed → Logs
2. Verify `VITE_API_URL` is correct
3. Check browser console (F12) for errors
4. Ensure API is running

See `VERCEL_DEPLOYMENT.md` for detailed troubleshooting.
