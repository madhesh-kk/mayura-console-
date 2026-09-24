import { db, ownerAccountsTable } from "@workspace/db";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface LegacyAccount {
  username: string;
  salt: string;
  hash: string;
  recoverySalt?: string;
  recoveryHash?: string;
}

async function migrateData() {
  try {
    console.log("Starting migration from JSON to PostgreSQL...");

    // Read existing JSON file
    const jsonPath = path.join(__dirname, "../artifacts/data/owner-accounts.json");
    const jsonContent = await readFile(jsonPath, "utf8");
    const accounts: Record<string, LegacyAccount> = JSON.parse(jsonContent);

    console.log(`Found ${Object.keys(accounts).length} accounts to migrate`);

    // Migrate each account
    for (const [businessId, account] of Object.entries(accounts)) {
      const normalizedId = businessId.trim().toLowerCase().replace(/\s+/g, "-");
      
      await db
        .insert(ownerAccountsTable)
        .values({
          businessId: normalizedId,
          username: account.username,
          salt: account.salt,
          hash: account.hash,
          recoverySalt: account.recoverySalt,
          recoveryHash: account.recoveryHash,
        })
        .onConflictDoUpdate({
          target: ownerAccountsTable.businessId,
          set: {
            username: account.username,
            salt: account.salt,
            hash: account.hash,
            recoverySalt: account.recoverySalt,
            recoveryHash: account.recoveryHash,
          },
        });

      console.log(`✓ Migrated account: ${businessId} (${account.username})`);
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("All owner accounts have been moved to PostgreSQL.");
    console.log("\nYou can now safely delete the JSON files:");
    console.log("  - artifacts/data/owner-accounts.json");
    console.log("  - artifacts/data/business-id-history.json");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateData();
