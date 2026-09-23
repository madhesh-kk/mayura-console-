# Visual Deployment Guide

## Architecture After Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│                                                                 │
│  Opens: https://mayura-console.vercel.app                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Requests
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VERCEL (Frontend)                             │
│                                                                 │
│  Project: mayura-console                                        │
│  URL: https://mayura-console.vercel.app                         │
│                                                                 │
│  ├─ index.html                                                  │
│  ├─ assets/                                                     │
│  │  ├─ index-xxx.js (React app)                                 │
│  │  └─ index-xxx.css (Tailwind styles)                          │
│  └─ robots.txt                                                  │
│                                                                 │
│  Environment: VITE_API_URL=https://api-xxx.onrender.com        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ API Calls (CORS enabled)
                         │ /api/bridge
                         │ /api/owner/...
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RENDER (Backend API)                          │
│                                                                 │
│  Service: api-server                                            │
│  URL: https://api-xxxxx.onrender.com                            │
│                                                                 │
│  ├─ /api/healthz                                                │
│  ├─ /api/bridge                                                 │
│  ├─ /api/owner/login                                            │
│  ├─ /api/owner/business-id-status                               │
│  └─ /api/owner/...                                              │
│                                                                 │
│  Database: PostgreSQL (optional)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Timeline

```
Day 1 - Preparation (5 min)
├─ Create .env.production in shop-bridge
├─ Create vercel.json in root
├─ Get Render API URL
└─ Ready for deployment

Day 1 - Deployment (10 min)
├─ Push code to GitHub
├─ Create Vercel account
├─ Import GitHub repo to Vercel
├─ Configure build settings
├─ Add environment variables
├─ Click Deploy
└─ ✅ Live in 2-3 minutes!

Day 1 - Testing (5 min)
├─ Open Vercel URL
├─ Test login with Business ID 1805
├─ Create test order
└─ ✅ Verify everything works
```

---

## File Structure After Deployment

```
Your GitHub Repo
├── vercel.json                          ✅ Tells Vercel how to build
├── artifacts/
│   ├── shop-bridge/                     ← Frontend
│   │   ├── .env.production              ✅ Contains VITE_API_URL
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── ...
│   │   └── dist/public/                 ← Built files (deployed)
│   │       ├── index.html
│   │       ├── assets/
│   │       └── robots.txt
│   │
│   └── api-server/                      ← Backend (already on Render)
│       ├── package.json
│       ├── src/
│       ├── dist/                        ← Built files
│       └── ...
```

---

## Data Flow Diagram

```
┌──────────────┐
│ Shop 1 User  │
│ Business ID: │────┐
│     1805     │    │
└──────────────┘    │
                    │
┌──────────────┐    │     ┌──────────────────────┐
│ Shop 2 User  │    │────→│  Vercel Frontend     │
│ Business ID: │    │     │                      │
│   180586     │    │     │ Shows login page     │
└──────────────┘    │     │ Manages sessions     │
                    │     │ Handles UI/UX        │
┌──────────────┐    │     └──────────────────────┘
│ Owner        │    │              │
│              │────┘              │ API calls with:
└──────────────┘                   │ - businessId
                                   │ - username
                                   │ - role
                                   ▼
                      ┌──────────────────────┐
                      │  Render Backend      │
                      │                      │
                      │ Validates login      │
                      │ Returns data for     │
                      │ specific businessId  │
                      │                      │
                      └─────────────────────░┘
                                   │
                                   ▼
                      ┌──────────────────────┐
                      │  Demo/Local Storage  │
                      │  or Database         │
                      │                      │
                      │ Stores separate data │
                      │ for each businessId  │
                      └──────────────────────┘
```

---

## Step-by-Step Click Guide

### Step 1: GitHub Push
```
PowerShell
$ cd e:\transfer_replit\Two-Shop-Order-and-Inventory
$ git add .
$ git commit -m "Deploy to Vercel"
$ git push origin main
✓ Done! Code is on GitHub
```

### Step 2: Vercel Account
```
1. Open https://vercel.com
2. Sign Up with GitHub
3. Authorize Vercel
✓ Account created
```

### Step 3: Import Project
```
1. Click "Add New Project"
2. Select your GitHub repo
3. Click "Import"
✓ Project imported
```

### Step 4: Configure Build
```
Fill in these fields:

Build Command:
pnpm --filter @workspace/shop-bridge run build

Output Directory:
artifacts/shop-bridge/dist/public

✓ Configuration complete
```

### Step 5: Add Environment Variable
```
Click "Environment Variables"

Add:
Key: VITE_API_URL
Value: https://api-xxxxx.onrender.com

✓ Variable added
```

### Step 6: Deploy
```
Click "Deploy"

Wait 2-3 minutes...

See: "Congratulations! Your deployment is ready"
URL: https://mayura-console.vercel.app

✓ DEPLOYED! 🎉
```

---

## Success Indicators

### ✅ Frontend is working:
```
- URL loads without 404
- HTML page appears (not blank)
- Login form visible
- No JavaScript errors in console (F12)
```

### ✅ API Connection works:
```
- Can log in successfully
- No "Business ID verification is unavailable" error
- API requests in Network tab show 200 OK
- Data appears on screen
```

### ✅ App is fully functional:
```
- Can create orders
- Can view inventory
- Different business IDs show different data
- Data persists after page reload
- Logout and login works
```

---

## Common Deployment Issues & Fixes

### ❌ Issue: Build Failed

**Logs show**: "Cannot find module"

**Fix**:
1. Check package.json exists
2. Ensure all dependencies are listed
3. Run locally: `pnpm install && pnpm --filter @workspace/shop-bridge run build`

### ❌ Issue: Page Loads But is Blank

**Logs show**: "dist/public/index.html not found"

**Fix**:
1. Verify output directory: `artifacts/shop-bridge/dist/public`
2. Check that build was successful
3. Rebuild: `pnpm --filter @workspace/shop-bridge run build`

### ❌ Issue: Login fails with API error

**Console shows**: "API_URL is empty" or "Cannot POST /api/..."

**Fix**:
1. Check Environment Variables in Vercel
2. VITE_API_URL must be set to your Render URL
3. Redeploy after fixing variable
4. Clear browser cache (Ctrl+Shift+Delete)

### ❌ Issue: CORS error in console

**Console shows**: "No 'Access-Control-Allow-Origin' header"

**Fix**:
1. Your API server CORS is not configured correctly
2. Update `artifacts/api-server/src/app.ts`
3. Add your Vercel URL to CORS whitelist
4. Redeploy API on Render
5. Clear browser cache

---

## Monitoring After Deployment

### Check Vercel Logs:
1. Vercel Dashboard → Your Project
2. Click "Deployments" tab
3. Select latest deployment
4. Click "Logs" to see build output

### Check Runtime Performance:
1. Vercel Dashboard → Your Project
2. Click "Analytics" tab
3. See page load times, errors, etc.

### Monitor API:
1. Render Dashboard → Your API Service
2. Check "Logs" for errors
3. Check "Metrics" for uptime

---

## You're Ready to Deploy! 🚀

**Next Action**: Follow DEPLOYMENT_STEPS.txt step by step

**Questions?** Check VERCEL_DEPLOYMENT.md for detailed troubleshooting
