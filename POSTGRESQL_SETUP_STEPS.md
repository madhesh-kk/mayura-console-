# PostgreSQL Setup - Complete Step-by-Step Guide

## Current Status
✅ Code updated to use PostgreSQL
✅ Frontend deployed on Netlify
✅ Backend deployed on Render (needs DATABASE_URL)
⏳ PostgreSQL database needs to be created on Render

## What You Need to Do

### Step 1: Create PostgreSQL Database on Render

1. Open [Render Dashboard](https://dashboard.render.com)
2. Click **New +** button
3. Select **PostgreSQL**
4. Fill in details:
   - **Name**: `mayura-db`
   - **Database**: `mayura_db`
   - **User**: `mayura_user` (or default)
   - **Region**: Same as your API (for best performance)
5. Click **Create Database**
6. Wait 2-3 minutes for database to be provisioned

### Step 2: Copy Database Connection String

After PostgreSQL is created:

1. Go to your **PostgreSQL service** on Render
2. Find the **Connections** section
3. Copy the **Internal Database URL** (looks like: `postgresql://user:pass@host/db`)
   - Do NOT use External URL for production
4. Keep this handy - you'll need it in the next step

### Step 3: Add DATABASE_URL to API Service

1. Go back to Render Dashboard
2. Click on your **API service** (mayura-console)
3. Go to **Settings** tab
4. Find **Environment** section
5. Click **Add Environment Variable**
6. Fill in:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the PostgreSQL URL from Step 2
7. Click **Save Changes**

**Important**: Render will automatically restart your API service when you save!

### Step 4: Wait for API to Restart

1. Watch the **Deployment** section of your API service
2. You should see a new deployment starting
3. Wait until status shows **Live** (usually 1-2 minutes)
4. Check the logs - should show database connection successful

### Step 5: Verify Database Connection

Check API logs:
1. Click on your **API service**
2. Go to **Logs** tab
3. Look for messages like:
   ```
   Connected to PostgreSQL database
   Tables created successfully
   ```

If you see errors, check Step 2-3 are correct.

### Step 6: Migrate Existing Data (Optional)

If you have existing credentials in `owner-accounts.json`:

**On your local machine:**
```bash
# Set the database URL
export DATABASE_URL="postgresql://your-url-from-step-2"

# Run migration
pnpm migrate-to-db
```

**Expected output:**
```
✓ Migrated account: 1212 (madhesh)
✓ Migrated account: 6565 (madhesh)
✓ Migrated account: 180586 (madhesh)

✅ Migration completed successfully!
```

### Step 7: Test Login

1. Go to https://mayura-console-shop-bridge.netlify.app
2. Try logging in with:
   - **Username**: `mayura`
   - **Password**: `12345678`
   - **Business ID**: `1212`
   - **Role**: `Owner`

3. If it works ✅ - Database is connected!
4. If it fails ❌ - Check the error, then troubleshoot below

### Step 8: Update Your Credentials

1. Click **Settings** (gear icon)
2. Change username/password to your custom values
3. Click **Update owner account**
4. See success message ✅

### Step 9: Test Persistence (The Real Test!)

1. **Push code changes to GitHub:**
   ```bash
   git add .
   git commit -m "Test database persistence"
   git push origin main
   ```

2. **Wait for Render to redeploy** (3-5 minutes)

3. **Try logging in** with your custom credentials
   - If it works ✅ - Success! Credentials persist!
   - If it fails ❌ - See troubleshooting below

---

## Troubleshooting

### Error: "DATABASE_URL not set"
**Cause**: Database URL not added to Render API environment

**Fix**:
1. Go to Render API Settings
2. Check Environment variables section
3. Make sure `DATABASE_URL` is there
4. If not, add it following Step 3

### Error: "Connection refused" or "Cannot connect to database"
**Cause**: PostgreSQL service not running or connection string wrong

**Fix**:
1. Check PostgreSQL service on Render dashboard
2. Status should show **Available**
3. Copy the connection string again (don't copy wrong part)
4. Make sure you're using **Internal Database URL** (not External)

### Error: "Incorrect owner credentials"
**Cause 1**: Database just created, no accounts yet

**Fix**: Use default credentials
- Username: `mayura`
- Password: `12345678`

**Cause 2**: Credentials not migrated

**Fix**: Run migration script (Step 6)

### Login works locally but not after push
**Cause**: API using old in-memory data, not PostgreSQL

**Fix**:
1. Restart Render API service manually
2. Check DATABASE_URL is still set
3. Check API logs for SQL errors

### "Table does not exist" error
**Cause**: Tables weren't auto-created

**Fix**:
1. Manually trigger deployment on Render
2. Or restart the API service
3. Check logs to see if table creation was successful

---

## Verification Checklist

- [ ] PostgreSQL database created on Render
- [ ] DATABASE_URL set on API service
- [ ] API service restarted after setting DATABASE_URL
- [ ] Can log in with `mayura / 12345678`
- [ ] Can update credentials in Settings
- [ ] Credentials persist after code push
- [ ] Can connect to database with pgAdmin (optional)

---

## Next Steps After Setup

1. ✅ Test login with default credentials
2. ✅ Update to your custom credentials
3. ✅ Push code and verify persistence
4. ✅ Optional: Connect pgAdmin to manage database visually
5. ✅ You're done! Enjoy persistent credentials!

---

## Additional Resources

- [Render PostgreSQL Docs](https://render.com/docs/databases)
- [pgAdmin Web Interface](https://www.pgadmin.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Your new system is much better than JSON files!** 🎉

Key improvements:
✅ No more data loss on deployments
✅ Credentials safe from Git exposure
✅ Real-time updates without commits
✅ Professional database solution
✅ Scales to thousands of users
