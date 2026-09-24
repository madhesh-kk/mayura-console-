# Frontend Configuration for PostgreSQL

## Overview
The frontend (Netlify) automatically connects to the backend API which now uses PostgreSQL. No code changes needed on the frontend!

## How It Works

### Authentication Flow
1. **Login Page**: User enters credentials (username, password, business ID)
2. **Frontend sends to**: `POST /api/owner/login`
3. **Backend queries**: PostgreSQL `owner_accounts` table
4. **Returns**: Success/error response
5. **Frontend stores**: Session in localStorage

### Credentials Update Flow
1. **Settings Page**: User updates username/password
2. **Frontend sends to**: `POST /api/owner/security`
3. **Backend updates**: PostgreSQL `owner_accounts` table
4. **Frontend receives**: New credentials confirmation
5. **Session updates**: localStorage with new credentials

## Environment Variables (Already Configured)

### Netlify
- **Variable**: `VITE_API_URL`
- **Value**: `https://mayura-console.onrender.com`
- **Purpose**: Points frontend to backend API

This is already set in Netlify, so no changes needed!

## Frontend API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/owner/login` | POST | Authenticate owner |
| `/api/owner/register` | POST | Register new account |
| `/api/owner/business-id-status` | GET | Check if business ID exists |
| `/api/owner/security` | POST | Update credentials |
| `/api/owner/recovery-code` | POST | Generate recovery code |
| `/api/owner/recover` | POST | Recover account |
| `/api/bridge` | GET/PUT | Get/update shop data |

## What Changed on Backend (Frontend Transparent)

✅ **Old**: Read/write to `owner-accounts.json` file
✅ **New**: Read/write to PostgreSQL database
✅ **Frontend**: No changes needed - same API endpoints!

## Testing Frontend

### Test 1: Login with Default Credentials
1. Go to https://mayura-console-shop-bridge.netlify.app
2. Username: `mayura`
3. Password: `12345678`
4. Business ID: `1212`
5. Should see dashboard ✅

### Test 2: Update Credentials
1. Go to Settings (gear icon)
2. Change username/password
3. Click "Update owner account"
4. See success message ✅

### Test 3: Code Push Persistence
1. Push code changes to GitHub
2. Wait for Render to redeploy (~3-5 minutes)
3. Try logging in with updated credentials
4. Should work! ✅ (Previously would fail with JSON files)

## Troubleshooting

### Issue: Login fails with "API connection error"
**Causes**:
- Render API is down/not running
- `VITE_API_URL` environment variable not set in Netlify
- Network connectivity issue

**Solution**:
1. Check Render dashboard - API should be "Live"
2. Check Netlify environment variables - `VITE_API_URL` should be set
3. Check browser console (F12) for specific error

### Issue: Credentials don't persist after code push
**Cause**: DATABASE_URL not set on Render API

**Solution**:
1. Go to Render API service settings
2. Add `DATABASE_URL` environment variable
3. Render will restart automatically

### Issue: "Incorrect owner credentials" after updating
**Cause**: Maybe querying wrong database or credentials not updated

**Solution**:
1. Check PostgreSQL is running on Render
2. Check API logs for SQL errors
3. Try logging in with default `mayura/12345678`

## Frontend Code Overview

### Key Files
- `artifacts/shop-bridge/src/App.tsx` - Main app with login/settings
- `artifacts/shop-bridge/src/lib/api.ts` - API configuration
- `artifacts/shop-bridge/src/hooks/use-shop-data.ts` - Data fetching

### Login Flow (App.tsx, lines ~2200+)
```typescript
async function submit(event: FormEvent) {
  // For owner role:
  const response = await fetch(apiUrl("/api/owner/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: cleanBusinessId,
      username: ownerUsername.trim(),
      password: ownerPassword,
    }),
  });
  // If 200 OK, save session to localStorage and log in
}
```

### Settings/Security Update (App.tsx, lines ~2030+)
```typescript
async function submit(event: FormEvent) {
  const response = await fetch(apiUrl("/api/owner/security"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: currentBusinessId,
      username: oldUsername,
      password: oldPassword,
      newBusinessId: newBusinessId,
      newUsername: newUsername,
      newPassword: newPassword,
    }),
  });
  // Updates credentials in backend (now PostgreSQL!)
}
```

## Session Management

### How Sessions Work
1. **Local Storage**: Session saved with key `shop-bridge-session`
2. **Session Object**:
   ```javascript
   {
     username: "madhesh",
     businessId: "1212",
     role: "owner" // or "shop1", "shop2"
   }
   ```
3. **Persistence**: Survives page refresh, but not browser restart (unless you stay logged in)

### Logout
- Clears localStorage session
- Returns to login page
- No data left on device

## Performance Notes

✅ **Frontend performance unchanged** - same API response times
✅ **Database queries** are fast and indexed
✅ **No N+1 queries** - single lookup by business ID
✅ **Scaling** - PostgreSQL handles many concurrent users

## Future Enhancements

### Possible additions (not required now):
- [ ] Audit logging - track credential changes
- [ ] Two-factor authentication
- [ ] SSO/OAuth integration
- [ ] Password expiration policies
- [ ] IP-based access restrictions

---

## Summary

✅ Frontend requires **NO CHANGES** - fully compatible with PostgreSQL backend
✅ API endpoints remain identical
✅ Environment variables already configured
✅ Sessions work the same way
✅ Data now persists permanently in database

**You're ready to test!** 🚀
