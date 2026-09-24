# Testing Guide - PostgreSQL Database Integration

## Overview
This guide walks through testing the new PostgreSQL database setup to ensure credentials persist correctly.

## Pre-Testing Checklist

Before testing, verify:
- [ ] PostgreSQL database created on Render ✅
- [ ] DATABASE_URL set on Render API service ✅
- [ ] API service restarted (should happen automatically) ✅
- [ ] Frontend deployed on Netlify ✅
- [ ] All code pushed to GitHub ✅

---

## Test 1: Login with Default Credentials

**Objective**: Verify API can connect to PostgreSQL database

### Steps:
1. Open https://mayura-console-shop-bridge.netlify.app
2. Enter:
   - **Your name**: `mayura`
   - **Owner username**: `mayura`
   - **Owner password**: `12345678`
   - **Business ID**: `1212`
   - **Which shop are you using?**: Select `Owner`
3. Click **Login** button

### Expected Result:
✅ Successfully logs in and shows dashboard
✅ No "Incorrect owner credentials" error
✅ Can see inventory, orders sections

### If it fails:
Check:
1. Is Render API service status **Live**? (Check dashboard)
2. Is PostgreSQL service status **Available**? (Check dashboard)
3. Is `DATABASE_URL` environment variable set?
4. Check API logs for errors (click on API service → Logs)

---

## Test 2: View Current Account Info

**Objective**: Verify reading credentials from database works

### Steps:
1. After logging in as owner
2. Click **Settings** (gear icon) in top right
3. Look at "Current credentials" section

### Expected Result:
✅ Shows current username: `mayura`
✅ Shows current Business ID: `1212`
✅ No SQL or database errors

---

## Test 3: Update Credentials

**Objective**: Verify writing to database works

### Steps:
1. In Settings page, fill:
   - **Current Business ID**: `1212`
   - **Current username**: `mayura`
   - **Current password**: `12345678`
   - **New Business ID**: `1212` (keep same)
   - **New username**: `testuser` (or your choice)
   - **New password**: `newpass123` (at least 6 chars)
2. Click **Update owner account**

### Expected Result:
✅ See success message: "Owner account updated successfully"
✅ Fields update to show new credentials
✅ Can stay logged in with new credentials

### If it fails:
Error: "The old username or password is incorrect"
- Double-check current password is `12345678`
- Try again

---

## Test 4: THE CRITICAL TEST - Persistence After Code Push

**Objective**: Verify credentials persist when Render redeploys (the whole point!)

### Part A: Push Code to Trigger Redeployment

1. Make a small test change locally:
   ```bash
   # Add a comment or change anything
   echo "# Test deployment" >> README.md
   ```

2. Commit and push:
   ```bash
   git add README.md
   git commit -m "Test: trigger redeployment"
   git push origin main
   ```

3. Watch Render dashboard:
   - API service should show new deployment starting
   - Status will show "Building" → "Deploying" → "Live"
   - Wait until status is **Live** (usually 2-3 minutes)

### Part B: Test Login After Redeployment

1. **Log out**: Click on profile → Logout (or close browser)

2. **Go to login page**: https://mayura-console-shop-bridge.netlify.app

3. **Try logging in with your NEW credentials**:
   - **Owner username**: `testuser` (what you set in Test 3)
   - **Owner password**: `newpass123` (what you set in Test 3)
   - **Business ID**: `1212`
   - **Role**: `Owner`

4. Click **Login**

### Expected Result:
✅ **LOGIN WORKS!** 🎉
✅ This proves credentials persisted through redeployment
✅ This is the key improvement over JSON files

### If it fails:
❌ Login shows "Incorrect owner credentials"
- This means database didn't persist
- Check troubleshooting section below

---

## Test 5: Multiple Business IDs

**Objective**: Verify database handles multiple business IDs

### Steps:
1. Go to Settings
2. Update **New Business ID** to `6565`
3. Keep username as `testuser`
4. New password: `pass6565`
5. Click **Update owner account**

### Expected Result:
✅ Success message appears
✅ Business ID changes to `6565`
✅ Can log out and log back in with new Business ID

### Part B: Test Both IDs Work

1. Log out
2. Log in with Business ID `1212` and credentials `testuser / newpass123`
   - Should work ✅
3. Log out
4. Log in with Business ID `6565` and credentials `testuser / pass6565`
   - Should also work ✅

### Result:
✅ Database supports multiple business IDs
✅ Each has independent credentials

---

## Test 6: Default Account Creation

**Objective**: Verify new business IDs auto-create with defaults

### Steps:
1. Go to login page
2. Try logging in with:
   - **Business ID**: `9999` (new, never used)
   - **Owner username**: `mayura`
   - **Owner password**: `12345678`
   - **Role**: `Owner`
3. Click **Login**

### Expected Result:
✅ Login succeeds even though 9999 never existed
✅ Account auto-created with default credentials
✅ New account appears in database

---

## Test 7: Data Isolation Between Business IDs

**Objective**: Verify each business ID has separate data

### Steps:
1. Log in with Business ID `1212`
2. Add inventory items or create orders
3. Log out
4. Log in with Business ID `6565`
5. Check if items from 1212 appear

### Expected Result:
✅ Business ID `6565` has different data than `1212`
✅ Each business is isolated
✅ No data bleeding between IDs

---

## Test 8: Verify with pgAdmin (Optional)

**Objective**: Directly query database to verify data

### Prerequisites:
- Free [pgAdmin account](https://www.pgadmin.org/download/)

### Steps:
1. Create pgAdmin account and sign in
2. Register new server:
   - Name: `Mayura DB`
   - Host: (from your PostgreSQL Render service)
   - Port: 5432
   - Username: (from connection string)
   - Password: (from connection string)
3. Navigate: Servers → Mayura DB → Databases → mayura_db → Schemas → public → Tables → owner_accounts
4. Right-click → View/Edit Data

### Expected Result:
✅ See all owner accounts in table:
   - business_id: `1212`, `6565`, `9999`, etc.
   - username: `testuser`, `mayura`, etc.
   - Hashed passwords (not plaintext!) ✅

---

## Troubleshooting

### Problem: Test 1 fails - "API connection error"

**Possible Causes:**
1. Render API not running
2. API logs show errors
3. DATABASE_URL not set

**Solutions:**
1. Check Render dashboard - is API service "Live"?
2. Click API service → Logs and look for errors
3. Go to Settings → Environment and verify DATABASE_URL is there
4. Try restarting API (click Restart button)

### Problem: Test 4 fails - Credentials don't persist

**Possible Causes:**
1. Database not actually connected
2. Data didn't save on first update
3. Wrong DATABASE_URL value

**Solutions:**
1. Check PostgreSQL service is "Available"
2. Look at API logs for SQL errors
3. Verify DATABASE_URL format is correct (postgresql://...)
4. Try Test 3 again to update credentials
5. Check pgAdmin to see if data saved to DB

### Problem: Test 5 fails - Can't switch business IDs

**Cause**: Business ID migration logic not working

**Solution:**
1. Try keeping Business ID the same (1212)
2. Update just username and password
3. Then test with same Business ID

### Problem: "Table does not exist" error

**Cause**: Tables weren't created when API started

**Solution:**
1. Go to Render API service
2. Click **Restart** button
3. Check logs to see if tables are created
4. Wait 1-2 minutes and try again

---

## Success Criteria

Your PostgreSQL setup is working correctly if:

✅ Test 1: Can log in with default credentials
✅ Test 2: Can view account settings
✅ Test 3: Can update credentials successfully
✅ Test 4: **MOST IMPORTANT** - Credentials persist after code push
✅ Test 5: Multiple business IDs work independently
✅ Test 6: New business IDs auto-create
✅ Test 7: Data is isolated between business IDs
✅ Test 8 (Optional): Can view data in pgAdmin

---

## Performance Notes

After testing, you should notice:
- ✅ Same login speed as before (database queries are fast)
- ✅ Same data update speed
- ✅ No SQL errors in logs
- ✅ Smooth credential updates

---

## What to Do After Tests Pass

1. **Update credentials to your preference:**
   - Go to Settings
   - Change to your desired username/password

2. **Delete temporary test business IDs** (optional):
   - Use pgAdmin to delete test entries
   - Or just leave them (won't affect anything)

3. **Clean up old JSON files** (optional):
   - You can delete: `artifacts/data/owner-accounts.json`
   - No longer needed! Data is in PostgreSQL

4. **Enjoy persistent credentials!**
   - Push code freely without losing credentials
   - Update password anytime
   - Multiple business IDs with different credentials

---

## Common Questions

**Q: Why do I need to test after code push?**
A: The whole point of PostgreSQL is that data persists. This test proves it works!

**Q: Can I use the same credentials for multiple business IDs?**
A: No, each business ID has its own credentials. This is by design for security.

**Q: What if I forget my password?**
A: Use the "Forgot owner credentials?" recovery flow, or reset to default: `mayura / 12345678`

**Q: Is my data safe?**
A: Yes! Passwords are hashed with scrypt (not stored in plaintext). Database is on Render's secure servers.

---

## Next Step

Once all tests pass, proceed to **Task #6: Verify data persists across deployments** 🚀
