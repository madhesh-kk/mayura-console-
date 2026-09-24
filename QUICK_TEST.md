# Quick Test - 5 Minute Verification

## Fast way to verify PostgreSQL is working

### 1️⃣ Login with Defaults (1 minute)
```
URL: https://mayura-console-shop-bridge.netlify.app
Username: mayura
Password: 12345678
Business ID: 1212
Role: Owner
```
✅ If login works → Database connected!

### 2️⃣ Update Credentials (2 minutes)
```
Settings → Security
Change username to: testuser123
Change password to: mypassword123
```
✅ If success message → Write to DB works!

### 3️⃣ Push Code (1 minute)
```bash
git add .
git commit -m "test"
git push origin main
```
Wait for Render to redeploy (status: Live)

### 4️⃣ Test After Redeploy (1 minute)
Log out, then:
```
Username: testuser123
Password: mypassword123
Business ID: 1212
```
✅ If login works → **PostgreSQL is working!** 🎉

---

## If any step fails:

| Error | Fix |
|-------|-----|
| "API connection error" | Restart Render API service |
| "Incorrect credentials" | Check DATABASE_URL is set on Render |
| "Table does not exist" | Wait 2 min, Render is initializing DB |
| Credentials lost after push | DATABASE_URL not connected properly |

---

**Total time: ~5 minutes**

That's it! 🚀
