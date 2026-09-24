import { Router, type IRouter } from "express";
import {
  hashPassword,
  passwordMatches,
  recoveryCodeMatches,
  normalizeBusinessId,
  findAccountByBusinessId,
  createOrUpdateAccount,
} from "../lib/db-operations.js";
import { randomBytes } from "node:crypto";

type BridgeSnapshot = {
  orders: unknown[];
  inventory: unknown[];
  restocks: unknown[];
  catalog: unknown[];
};

const emptySnapshot = (): BridgeSnapshot => ({ orders: [], inventory: [], restocks: [], catalog: [] });
const snapshots = new Map<string, BridgeSnapshot>();

const router: IRouter = Router();

// Register new owner account
router.post("/owner/register", async (request, response) => {
  const { businessId, username, password } = request.body as Record<string, unknown>;
  if (typeof businessId !== "string" || typeof username !== "string" || typeof password !== "string" || !businessId.trim() || !username.trim() || password.length < 6) {
    response.status(400).json({ error: "Enter a business ID, username, and a password with at least 6 characters." });
    return;
  }
  
  const key = normalizeBusinessId(businessId);
  const existing = await findAccountByBusinessId(key);
  
  if (existing) {
    response.status(409).json({ error: "An owner account already exists for this Business ID." });
    return;
  }
  
  const { salt, hash } = await hashPassword(password);
  await createOrUpdateAccount(key, username.trim(), salt, hash);
  response.status(201).json({ ok: true });
});

// Check business ID status
router.get("/owner/business-id-status", async (request, response) => {
  const businessId = typeof request.query.businessId === "string"
    ? normalizeBusinessId(request.query.businessId)
    : "";
  
  if (!businessId) {
    response.status(400).json({ status: "incorrect" });
    return;
  }
  
  const account = await findAccountByBusinessId(businessId);
  if (account) {
    response.json({ status: "valid" });
    return;
  }

  response.json({ status: "incorrect" });
});

// Owner login
router.post("/owner/login", async (request, response) => {
  const { businessId, username, password } = request.body as Record<string, unknown>;
  if (typeof businessId !== "string" || typeof username !== "string" || typeof password !== "string") {
    response.status(401).json({ error: "Incorrect owner credentials or Business ID." });
    return;
  }
  
  const key = normalizeBusinessId(businessId);
  let account = await findAccountByBusinessId(key);
  
  // Auto-create default account on first login
  if (!account && username.trim() === "mayura" && password === "12345678") {
    const credentials = await hashPassword(password);
    await createOrUpdateAccount(key, "mayura", credentials.salt, credentials.hash);
    account = await findAccountByBusinessId(key);
  }
  
  if (!account || account.username !== username.trim()) {
    response.status(401).json({ error: "Incorrect owner credentials or Business ID." });
    return;
  }
  
  if (!await passwordMatches(password, account)) {
    response.status(401).json({ error: "Incorrect owner credentials or Business ID." });
    return;
  }
  
  response.json({ ok: true });
});

// Generate recovery code
router.post("/owner/recovery-code", async (request, response) => {
  const { businessId, username, password } = request.body as Record<string, unknown>;
  if (typeof businessId !== "string" || typeof username !== "string" || typeof password !== "string") {
    response.status(401).json({ error: "Current Business ID, username, and password are required." });
    return;
  }
  
  const key = normalizeBusinessId(businessId);
  const account = await findAccountByBusinessId(key);
  
  if (!account || account.username !== username.trim() || !await passwordMatches(password, account)) {
    response.status(401).json({ error: "Current owner credentials are incorrect." });
    return;
  }
  
  const code = randomBytes(18).toString("base64url");
  const credentials = await hashPassword(code);
  await createOrUpdateAccount(key, account.username, account.salt, account.hash, credentials.salt, credentials.hash);
  
  response.json({ ok: true, recoveryCode: code });
});

// Recover account using recovery code
router.post("/owner/recover", async (request, response) => {
  const { recoveryCode, newBusinessId, newUsername, newPassword } = request.body as Record<string, unknown>;
  if (typeof recoveryCode !== "string" || typeof newBusinessId !== "string" || typeof newUsername !== "string" || typeof newPassword !== "string" || !recoveryCode.trim() || !newBusinessId.trim() || !newUsername.trim() || newPassword.length < 6) {
    response.status(400).json({ error: "Enter the recovery code, a new Business ID, username, and a password with at least 6 characters." });
    return;
  }
  
  // Find account with matching recovery code
  // This is a simplified version - in production, you'd query the database
  // For now, we'll search through all accounts (you can optimize this)
  response.status(500).json({ error: "Recovery feature requires additional database query - please use Settings to change credentials." });
});

// Update owner security (change credentials)
router.post("/owner/security", async (request, response) => {
  const { businessId, username, password, newBusinessId, newUsername, newPassword } = request.body as Record<string, unknown>;
  
  if (typeof businessId !== "string" || typeof username !== "string" || typeof password !== "string" || typeof newBusinessId !== "string" || typeof newUsername !== "string" || (newPassword !== undefined && typeof newPassword !== "string") || !newBusinessId.trim() || !newUsername.trim() || (typeof newPassword === "string" && newPassword.length > 0 && newPassword.length < 6)) {
    response.status(400).json({ error: "Enter the current credentials, a new Business ID, and a new username. A new password must have at least 6 characters." });
    return;
  }
  
  const oldKey = normalizeBusinessId(businessId);
  const newKey = normalizeBusinessId(newBusinessId);
  
  const account = await findAccountByBusinessId(oldKey);
  if (!account || account.username !== username.trim() || !await passwordMatches(password, account)) {
    response.status(401).json({ error: "The old username or password is incorrect." });
    return;
  }
  
  // Check if new business ID already exists
  if (newKey !== oldKey) {
    const existingNewAccount = await findAccountByBusinessId(newKey);
    if (existingNewAccount) {
      response.status(409).json({ error: "That Business ID already has an owner account. Choose another ID." });
      return;
    }
  }
  
  // Hash new password if provided
  const credentials = typeof newPassword === "string" && newPassword.length > 0 ? await hashPassword(newPassword) : { salt: account.salt, hash: account.hash };
  
  // Delete old account if business ID changed
  if (newKey !== oldKey && oldKey) {
    // In a full implementation, you'd migrate data snapshots here
    // For now, just create new account with new ID
  }
  
  // Create/update account with new credentials
  await createOrUpdateAccount(newKey, newUsername.trim(), credentials.salt, credentials.hash, account.recoverySalt || undefined, account.recoveryHash || undefined);
  
  // Delete old account if ID changed
  if (newKey !== oldKey) {
    // TODO: Delete old account from database
  }
  
  response.json({ ok: true, username: newUsername.trim(), businessId: newKey });
});

// Get bridge snapshot
router.get("/bridge", (request, response) => {
  response.json(snapshots.get(String(request.query.ownerId ?? "default")) ?? emptySnapshot());
});

// Update bridge snapshot
router.put("/bridge", (request, response) => {
  const next = request.body as Partial<BridgeSnapshot>;
  if (!Array.isArray(next.orders) || !Array.isArray(next.inventory) || !Array.isArray(next.restocks)) {
    response.status(400).json({ error: "Invalid bridge snapshot." });
    return;
  }
  
  const snapshot = { orders: next.orders, inventory: next.inventory, restocks: next.restocks, catalog: next.catalog ?? [] };
  snapshots.set(String(request.query.ownerId ?? "default"), snapshot);
  response.json(snapshot);
});

export default router;
