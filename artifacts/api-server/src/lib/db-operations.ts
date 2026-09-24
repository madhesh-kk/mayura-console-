import { db, ownerAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64) as Buffer;
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

export async function passwordMatches(password: string, account: { salt: string; hash: string }) {
  const hash = await scrypt(password, Buffer.from(account.salt, "base64"), 64) as Buffer;
  const expectedHash = Buffer.from(account.hash, "base64");
  return hash.length === expectedHash.length && timingSafeEqual(hash, expectedHash);
}

export async function recoveryCodeMatches(code: string, account: { recoverySalt: string | null; recoveryHash: string | null }) {
  if (!account.recoverySalt || !account.recoveryHash) return false;
  const hash = await scrypt(code, Buffer.from(account.recoverySalt, "base64"), 64) as Buffer;
  const expectedHash = Buffer.from(account.recoveryHash, "base64");
  return hash.length === expectedHash.length && timingSafeEqual(hash, expectedHash);
}

export function normalizeBusinessId(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function findAccountByBusinessId(businessId: string) {
  const normalizedId = normalizeBusinessId(businessId);
  const result = await db
    .select()
    .from(ownerAccountsTable)
    .where(eq(ownerAccountsTable.businessId, normalizedId))
    .limit(1);
  return result[0] || null;
}

export async function createOrUpdateAccount(
  businessId: string,
  username: string,
  salt: string,
  hash: string,
  recoverySalt?: string,
  recoveryHash?: string
) {
  const normalizedId = normalizeBusinessId(businessId);
  
  const existing = await findAccountByBusinessId(normalizedId);
  
  if (existing) {
    return await db
      .update(ownerAccountsTable)
      .set({
        username,
        salt,
        hash,
        recoverySalt,
        recoveryHash,
      })
      .where(eq(ownerAccountsTable.businessId, normalizedId))
      .returning();
  } else {
    return await db
      .insert(ownerAccountsTable)
      .values({
        businessId: normalizedId,
        username,
        salt,
        hash,
        recoverySalt,
        recoveryHash,
      })
      .returning();
  }
}

export async function findAllAccounts() {
  return await db.select().from(ownerAccountsTable);
}

export async function deleteAccount(businessId: string) {
  const normalizedId = normalizeBusinessId(businessId);
  return await db
    .delete(ownerAccountsTable)
    .where(eq(ownerAccountsTable.businessId, normalizedId))
    .returning();
}
