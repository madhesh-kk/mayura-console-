# MySQL Database Setup Guide

## Overview
This project now uses MySQL for persistent credential storage instead of JSON files.

## Database Schema

### Table: owner_accounts
Stores owner credentials for each business ID.

```sql
CREATE TABLE owner_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_id VARCHAR(100) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  hash VARCHAR(255) NOT NULL,
  recovery_salt VARCHAR(255),
  recovery_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_business_id (business_id)
);
```

### Table: orders
Stores all orders between shops.

```sql
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_id VARCHAR(100) NOT NULL,
  order_id VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  sender_username VARCHAR(100) NOT NULL,
  items JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_business_id (business_id),
  INDEX idx_status (status)
);
```

### Table: inventory
Stores inventory items for each business.

```sql
CREATE TABLE inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_id VARCHAR(100) NOT NULL,
  item_id VARCHAR(100),
  item_name VARCHAR(100) NOT NULL,
  current_stock INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_business_id (business_id),
  UNIQUE KEY unique_item (business_id, item_name)
);
```

### Table: catalog
Stores catalog items available for order.

```sql
CREATE TABLE catalog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_id VARCHAR(100) NOT NULL,
  item_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),
  stock INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_business_id (business_id),
  UNIQUE KEY unique_catalog_item (business_id, item_id)
);
```

## Connection Details

### Local Development
- Host: `localhost`
- Port: `3306`
- Username: `root`
- Password: (set during MySQL install)
- Database: `mayura_db`

### Production (Render)
- Use environment variable: `DATABASE_URL`
- Format: `mysql://user:password@host:port/database`

## Setup Instructions

### 1. Create Database Locally
```bash
mysql -u root -p
CREATE DATABASE mayura_db;
USE mayura_db;
# Run the CREATE TABLE statements above
```

### 2. Create Database on Render
- Add MySQL service on Render dashboard
- Render will provide `DATABASE_URL`
- Backend will auto-create tables on startup

### 3. Migrate Data
Run migration script to move data from JSON to MySQL:
```bash
npm run migrate-to-db
```

## Environment Variables

Add to `.env` or Render environment:
```
DATABASE_URL=mysql://user:password@localhost:3306/mayura_db
```

## API Changes

All authentication endpoints now use MySQL:
- `/api/owner/register` - Creates account in DB
- `/api/owner/login` - Validates credentials from DB
- `/api/owner/security` - Updates account in DB
- `/api/owner/recovery-code` - Generates recovery code in DB
- `/api/owner/recover` - Recovers account using recovery code from DB

## Backup & Recovery

### Backup MySQL Database
```bash
mysqldump -u root -p mayura_db > backup.sql
```

### Restore from Backup
```bash
mysql -u root -p mayura_db < backup.sql
```

## Testing

1. Create test account: `madhesh / 7894561230 / 1212`
2. Log in to verify credentials work
3. Change password in Settings and verify persistence
4. Push code changes and verify login still works

---

**Benefits of MySQL:**
✅ Credentials persist across deployments
✅ No need to commit sensitive data to Git
✅ Scalable for multiple users and shops
✅ Can manage with MySQL Workbench
✅ Real-time updates without Git commits
