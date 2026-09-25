# Auto-sync credentials to GitHub
# Run this script after updating your credentials in the Settings page

param(
    [string]$username = "madhesh",
    [string]$password,
    [string]$businessId = "1212",
    [string]$message = "Update credentials"
)

if (-not $password) {
    Write-Host "Usage: .\sync-credentials.ps1 -password 'your_password' -businessId 'your_id' -username 'your_username'"
    exit 1
}

# Hash the password using Node.js
$hashScript = @"
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return {
    salt: salt.toString("base64"),
    hash: hash.toString("base64")
  };
}

const creds = await hashPassword(`"$password`");
console.log(JSON.stringify(creds));
"@

Write-Host "Hashing password..."
$credJson = $hashScript | node -
$creds = $credJson | ConvertFrom-Json

# Update or create the credentials
$accountFile = "artifacts/data/owner-accounts.json"
$accounts = @{}

if (Test-Path $accountFile) {
    $accounts = Get-Content $accountFile | ConvertFrom-Json -AsHashtable
}

$accounts[$businessId] = @{
    username = $username
    salt = $creds.salt
    hash = $creds.hash
}

$accounts | ConvertTo-Json -Depth 10 | Set-Content $accountFile

Write-Host "✅ Credentials updated for Business ID: $businessId"
Write-Host "Username: $username"
Write-Host "Business ID: $businessId"

# Commit and push to GitHub
Write-Host "`nCommitting to GitHub..."
git add $accountFile
git commit -m "Update credentials for business ID $businessId - $message"
git push origin main

Write-Host "✅ Credentials synced to GitHub!"
Write-Host "Render will redeploy automatically in 2-3 minutes"
