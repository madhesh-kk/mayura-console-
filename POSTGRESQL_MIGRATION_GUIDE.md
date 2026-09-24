# PostgreSQL Migration Guide

## Overview
This guide explains how to migrate from JSON file storage to PostgreSQL database for persistent owner credentials.

## Benefits of PostgreSQL
✅ Data persists across deployments
✅ No need to commit sensitive data to Git
✅ Real-time credentials updates
✅ Better scalability and performance
✅ Can be managed with MySQL Workbench or pgAdmin
✅ Works seamlessly with Render

## Setup Steps

### Step 1: Create PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **PostgreSQL**
3. Fill in:
   - **Name**: `mayura-db` (or your choice)
   - **Region**: Choose your region
   - **PostgreSQL Version**: Latest (14+)
4. Click **Create Database**
5. Wait for database to be created (~2-3 minutes)
6. Copy the **Internal Database URL** (it will be displayed)

### Step 2: Set Environment Variable on Render API

1. Go to your **Render Dashboard**
2. Click on your **API service** (mayura-console)
3. Go to **Settings** → **Environment**
4. Add new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the PostgreSQL URL from Step 1
5. Click **Save**
6. Render will automatically restart your service

### Step 3: Run Database Migrations

The API will automatically create tables on first startup.

To manually verify tables were created:
```bash
# Connect to your PostgreSQL database (optional)
psql your-database-url
# List tables: \dt
# Exit: \q
```

### Step 4: Migrate Data from JSON to Database

Run this command to move existing credentials from JSON files to PostgreSQL:

```bash
# Set DATABASE_URL environment variable first
export DATABASE_URL="postgresql://..."

# Run migration
pnpm migrate-to-db
```

Expected output:
```
Starting migration from JSON to PostgreSQL...
Found 3 accounts to migrate
✓ Migrated account: 1212 (madhesh)
✓ Migrated account: 6565 (madhesh)
✓ Migrated account: 180586 (madhesh)

✅ Migration completed successfully!
All owner accounts have been moved to PostgreSQL.
```

### Step 5: Verify Data in Database

**Option A: Using pgAdmin (recommended)**
1. Go to [pgAdmin](https://pgadmin.io) - create free account
2. Add your Render PostgreSQL server
3. Navigate to: Databases → mayura_db → Schemas → public → Tables → owner_accounts
4. Right-click → View/Edit Data to see accounts

**Option B: Using MySQL Workbench**
1. MySQL Workbench can also connect to PostgreSQL (with ODBC driver)
2. Create new connection with PostgreSQL URL from Render

**Option C: Using Command Line**
```bash
psql "your-database-url"
SELECT * FROM owner_accounts;
```

### Step 6: Test Login with Custom Credentials

1. Update your credentials in the Settings page
2. Make changes (they should now save to PostgreSQL)
3. Push code to GitHub
4. Render redeploys
5. **Your credentials persist!** ✅

## Database Schema

### owner_accounts Table
```sql
CREATE TABLE owner_accounts (
  id SERIAL PRIMARY KEY,
  business_id VARCHAR(100) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  hash VARCHAR(255) NOT NULL,
  recovery_salt VARCHAR(255),
  recovery_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### Issue: "DATABASE_URL not found" error
**Solution**: Make sure you set the environment variable on Render:
1. Go to API Service Settings
2. Check Environment variables
3. Verify DATABASE_URL is set

### Issue: "Connection refused"
**Solution**: Make sure PostgreSQL database is created and running:
1. Check Render dashboard - PostgreSQL service should show "Available"
2. Try copying the Internal Database URL again

### Issue: "Table does not exist"
**Solution**: Tables auto-create on first API startup. If missing:
```bash
# Manually trigger table creation
npm run build
npm start
```

### Issue: Can't connect from MySQL Workbench
**Solution**: PostgreSQL requires different connection method than MySQL:
- Use pgAdmin instead (free web-based tool)
- Or install PostgreSQL client tools locally

## Rollback (if needed)

If you need to go back to JSON files:

1. **Keep your PostgreSQL data** (don't delete the database)
2. Update `artifacts/data/owner-accounts.json` with current credentials
3. Revert `bridge.ts` to use JSON files
4. Commit and push

Note: PostgreSQL approach is recommended. Rollback is only for emergencies.

## Security Notes

✅ **Passwords are hashed** with scrypt (not stored in plaintext)
✅ **Database connection** uses secure PostgreSQL protocol
✅ **No sensitive data in Git** (DATABASE_URL is only in Render environment)
✅ **Recovery codes** are also hashed and time-limited

## Next Steps

1. ✅ Create PostgreSQL on Render
2. ✅ Set DATABASE_URL environment variable
3. ✅ API auto-creates tables on restart
4. ✅ Run migration script (optional - API auto-creates default account on first login)
5. ✅ Test login and credential changes
6. ✅ Verify persistence after code push

---

**After this setup, your credentials will persist forever across all deployments!** 🎉
