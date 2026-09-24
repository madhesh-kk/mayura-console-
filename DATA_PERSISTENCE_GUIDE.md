# Data Persistence Guide

## Problem
When you push code changes to GitHub and Render redeploys, the data files (`owner-accounts.json`, `business-id-history.json`) were being reset to defaults, losing:
- Custom owner passwords
- Custom business IDs
- All user data

## Solution
Data files are now **ignored by Git** and kept only on the Render server.

## How It Works

### ✅ What's Protected
These files are NOT version controlled (not in Git):
- `artifacts/data/owner-accounts.json` - Owner accounts with passwords
- `artifacts/data/business-id-history.json` - Business ID history

### ✅ Why This Works
1. **Local development**: Your `owner-accounts.json` stays on your machine (not pushed to GitHub)
2. **On Render**: The file stays on the Render server and is NOT overwritten when you push code
3. **Redeploy safety**: Code changes don't affect data anymore!

## Important Notes

### When to Use This Approach
✅ Use this when:
- You want to keep user data between deployments
- You have custom passwords
- You want data persistence on production

### When NOT to Use This Approach
❌ Don't use this when:
- You want to reset data during deployment
- You need to backup/version control user data
- You're working with a full database (use PostgreSQL/Firebase instead)

## For Future Updates

### When You Want to Modify Code
You can now safely:
1. Make code changes
2. Commit and push to GitHub
3. Render will redeploy
4. Your data files will stay intact! ✅

### Example Workflow
```bash
# Make code changes
git add src/App.tsx
git commit -m "Update UI"
git push origin main

# Render redeploys automatically
# ✅ Your owner-accounts.json is NOT touched
# ✅ Your business data persists
```

## If You Need to Reset Data

If you want to reset owner accounts:

### Option 1: Delete and Recreate
1. SSH into Render server
2. Delete `artifacts/data/owner-accounts.json`
3. Render will create a new one with defaults on next startup

### Option 2: Manually Edit on Server
1. Access Render dashboard
2. Use Shell/SSH to edit the file directly
3. Or use the admin recovery flow in the app

## File Locations

### Local (Your Machine)
- `artifacts/data/owner-accounts.json` (ignored, won't push)
- `artifacts/data/business-id-history.json` (ignored, won't push)

### GitHub Repository
- `.gitignore` (tracks what NOT to version control)
- `artifacts/data/owner-accounts.json.example` (template only, for reference)

### Render Server (Production)
- `artifacts/data/owner-accounts.json` (actual data, persists across deployments)
- `artifacts/data/business-id-history.json` (actual data, persists across deployments)

## Backup Your Data

Since data files are NOT in Git, make regular backups:

### Manual Backup
1. SSH into Render server
2. Download `artifacts/data/owner-accounts.json`
3. Keep a copy safely

### Automated Backup (Recommended)
Consider using:
- Database instead of JSON files (PostgreSQL)
- Firebase Realtime Database
- Cloud storage with periodic exports

## Configuration

### Current Setup
- `.gitignore` prevents data files from being tracked
- Render environment keeps files between deployments
- Example file provides template for new deployments

### To Add New Business IDs
1. Add entry to `owner-accounts.json` on Render server
2. OR use the app's owner recovery/registration flow

## Questions?

If data is lost or you need to restore:
1. Check if the file exists on Render using SSH
2. Restore from backup if available
3. Or re-create accounts using the app's owner login flow

---

**Bottom Line**: Your data is now safe from code deployments! ✅
