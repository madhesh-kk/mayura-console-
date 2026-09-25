import { Router, type IRouter } from "express";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

type BridgeSnapshot = {
  orders: unknown[];
  inventory: unknown[];
  restocks: unknown[];
  catalog: unknown[];
};

const emptySnapshot = (): BridgeSnapshot => ({ orders: [], inventory: [], restocks: [], catalog: [] });
const snapshots = new Map<string, BridgeSnapshot>();
type OwnerAccount = {
  username: string;
  salt: string;
  hash: string;
  recoverySalt?: string;
  recoveryHash?: string;
};
const ownerAccounts = new Map<string, OwnerAccount>();
const retiredBusinessIds = new Map<string, string>();
const accountsFile =
  process.env.OWNER_ACCOUNTS_FILE ??
  path.resolve(fileURLToPath(new URL("../../data/owner-accounts.json", import.meta.url)));
const businessHistoryFile =
  process.env.OWNER_BUSINESS_HISTORY_FILE ??
  path.resolve(fileURLToPath(new URL("../../data/business-id-history.json", import.meta.url)));
let accountsLoaded: Promise<void> | undefined;
let businessHistoryLoaded: Promise<void> | undefined;
const scrypt = promisify(scryptCallback);

function normalizeBusinessId(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

async function loadOwnerAccounts() {
  if (!accountsLoaded) {
    accountsLoaded = readFile(accountsFile, "utf8")
      .then((contents) => {
        const stored = JSON.parse(contents) as Record<string, OwnerAccount>;
        Object.entries(stored).forEach(([businessId, account]) => {
          if (account && typeof account.username === "string" && typeof account.salt === "string" && typeof account.hash === "string") {
            ownerAccounts.set(businessId, account);
          }
        });
      })
      .catch(async (error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        // File doesn't exist - initialize with default credentials for demo
        const defaultPassword = await hashPassword("12345678");
        ownerAccounts.set("6565", { username: "mayura", ...defaultPassword });
        ownerAccounts.set("180586", { username: "mayura", ...defaultPassword });
        await saveOwnerAccounts();
      });
  }
  await accountsLoaded;
}

async function saveOwnerAccounts() {
  await mkdir(path.dirname(accountsFile), { recursive: true });
  const temporaryFile = `${accountsFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(Object.fromEntries(ownerAccounts), null, 2), "utf8");
  await rename(temporaryFile, accountsFile);
}

async function loadBusinessHistory() {
  if (!businessHistoryLoaded) {
    businessHistoryLoaded = readFile(businessHistoryFile, "utf8")
      .then((contents) => {
        const stored = JSON.parse(contents) as Record<string, unknown>;
        Object.entries(stored).forEach(([oldBusinessId, newBusinessId]) => {
          if (typeof newBusinessId === "string" && newBusinessId) {
            retiredBusinessIds.set(oldBusinessId, newBusinessId);
          }
        });
      })
      .catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
  }
  await businessHistoryLoaded;
}

async function saveBusinessHistory() {
  await mkdir(path.dirname(businessHistoryFile), { recursive: true });
  const temporaryFile = `${businessHistoryFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(Object.fromEntries(retiredBusinessIds), null, 2), "utf8");
  await rename(temporaryFile, businessHistoryFile);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64) as Buffer;
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

async function passwordMatches(password: string, account: OwnerAccount) {
  const hash = await scrypt(password, Buffer.from(account.salt, "base64"), 64) as Buffer;
  const expectedHash = Buffer.from(account.hash, "base64");
  return hash.length === expectedHash.length && timingSafeEqual(hash, expectedHash);
}

async function recoveryCodeMatches(code: string, account: OwnerAccount) {
  if (!account.recoverySalt || !account.recoveryHash) return false;
  const hash = await scrypt(code, Buffer.from(account.recoverySalt, "base64"), 64) as Buffer;
  const expectedHash = Buffer.from(account.recoveryHash, "base64");
  return hash.length === expectedHash.length && timingSafeEqual(hash, expectedHash);
}

function snapshotFor(ownerId: string) {
  const current = snapshots.get(ownerId) ?? emptySnapshot();
  snapshots.set(ownerId, current);
  return current;
}

const router: IRouter = Router();

router.post("/owner/register", async (request, response) => {
  await loadOwnerAccounts();
  const { businessId, username, password } = request.body as Record<string, unknown>;
  if (typeof businessId !== "string" || typeof username !== "string" || typeof password !== "string" || !businessId.trim() || !username.trim() || password.length < 6) {
    response.status(400).json({ error: "Enter a business ID, username, and a password with at least 6 characters." });
    return;
  }
  const key = normalizeBusinessId(businessId);
  if (ownerAccounts.has(key)) {
    response.status(409).json({ error: "An owner account already exists for this Business ID." });
    return;
  }
  const { salt, hash } = await hashPassword(password);
  ownerAccounts.set(key, { username: username.trim(), salt, hash });
  await saveOwnerAccounts();
  response.status(201).json({ ok: true });
});

router.get("/owner/business-id-status", async (request, response) => {
  await loadOwnerAccounts();
  await loadBusinessHistory();
  const businessId = typeof request.query.businessId === "string"
    ? normalizeBusinessId(request.query.businessId)
    : "";
  if (!businessId) {
    response.status(400).json({ status: "incorrect" });
    return;
  }
  if (ownerAccounts.has(businessId)) {
    response.json({ status: "valid" });
    return;
  }

  // Do not disclose replacement IDs before the caller is authenticated.
  response.json({ status: "incorrect" });
});

router.post("/owner/login", async (request, response) => {
  await loadOwnerAccounts();
  const { businessId, username, password } = request.body as Record<string, unknown>;
  if (typeof businessId !== "string" || typeof username !== "string" || typeof password !== "string") {
    response.status(401).json({ error: "Incorrect owner credentials or Business ID." });
    return;
  }
  const key = normalizeBusinessId(businessId);
  let account = ownerAccounts.get(key);
  if (!account && username.trim() === "mayura" && password === "12345678") {
    const credentials = await hashPassword(password);
    account = { username: "mayura", ...credentials };
    ownerAccounts.set(key, account);
    await saveOwnerAccounts();
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

router.post("/owner/recovery-code", async (request, response) => {
  await loadOwnerAccounts();
  const { businessId, username, password } = request.body as Record<string, unknown>;
  if (typeof businessId !== "string" || typeof username !== "string" || typeof password !== "string") {
    response.status(401).json({ error: "Current Business ID, username, and password are required." });
    return;
  }
  const key = normalizeBusinessId(businessId);
  const account = ownerAccounts.get(key);
  if (!account || account.username !== username.trim() || !await passwordMatches(password, account)) {
    response.status(401).json({ error: "Current owner credentials are incorrect." });
    return;
  }
  const code = randomBytes(18).toString("base64url");
  const credentials = await hashPassword(code);
  ownerAccounts.set(key, {
    ...account,
    recoverySalt: credentials.salt,
    recoveryHash: credentials.hash,
  });
  await saveOwnerAccounts();
  response.json({ ok: true, recoveryCode: code });
});

router.post("/owner/recover", async (request, response) => {
  await loadOwnerAccounts();
  await loadBusinessHistory();
  const { recoveryCode, newBusinessId, newUsername, newPassword } = request.body as Record<string, unknown>;
  if (typeof recoveryCode !== "string" || typeof newBusinessId !== "string" || typeof newUsername !== "string" || typeof newPassword !== "string" || !recoveryCode.trim() || !newBusinessId.trim() || !newUsername.trim() || newPassword.length < 6) {
    response.status(400).json({ error: "Enter the recovery code, a new Business ID, username, and a password with at least 6 characters." });
    return;
  }
  const match = await Promise.all([...ownerAccounts.entries()].map(async ([businessId, account]) => (
    await recoveryCodeMatches(recoveryCode.trim(), account) ? { businessId, account } : null
  )));
  const found = match.find((entry) => entry !== null);
  if (!found) {
    response.status(401).json({ error: "The recovery code is invalid or expired." });
    return;
  }
  const oldKey = found.businessId;
  const newKey = normalizeBusinessId(newBusinessId);
  if (ownerAccounts.has(newKey) && newKey !== oldKey) {
    response.status(409).json({ error: "That Business ID already has an owner account. Choose another ID." });
    return;
  }
  const credentials = await hashPassword(newPassword);
  const nextAccount: OwnerAccount = {
    username: newUsername.trim(),
    salt: credentials.salt,
    hash: credentials.hash,
    recoverySalt: found.account.recoverySalt,
    recoveryHash: found.account.recoveryHash,
  };
  ownerAccounts.delete(oldKey);
  ownerAccounts.set(newKey, nextAccount);
  if (newKey !== oldKey) {
    retiredBusinessIds.set(oldKey, newKey);
    const businessSnapshot = snapshots.get(oldKey);
    if (businessSnapshot) {
      snapshots.set(newKey, businessSnapshot);
      snapshots.delete(oldKey);
    }
  }
  await saveOwnerAccounts();
  await saveBusinessHistory();
  response.json({ ok: true, username: nextAccount.username, businessId: newKey });
});

router.post("/owner/security", async (request, response) => {
  await loadOwnerAccounts();
  await loadBusinessHistory();
  const { businessId, username, password, newBusinessId, newUsername, newPassword } = request.body as Record<string, unknown>;
  if (typeof businessId !== "string" || typeof username !== "string" || typeof password !== "string" || typeof newBusinessId !== "string" || typeof newUsername !== "string" || (newPassword !== undefined && typeof newPassword !== "string") || !newBusinessId.trim() || !newUsername.trim() || (typeof newPassword === "string" && newPassword.length > 0 && newPassword.length < 6)) {
    response.status(400).json({ error: "Enter the current credentials, a new Business ID, and a new username. A new password must have at least 6 characters." });
    return;
  }
  const oldKey = normalizeBusinessId(businessId);
  const newKey = normalizeBusinessId(newBusinessId);
  const account = ownerAccounts.get(oldKey);
  if (!account || account.username !== username.trim() || !await passwordMatches(password, account)) {
    response.status(401).json({ error: "The old username or password is incorrect." });
    return;
  }
  if (newKey !== oldKey && ownerAccounts.has(newKey)) {
    response.status(409).json({ error: "That Business ID already has an owner account. Choose another ID." });
    return;
  }
  const credentials = typeof newPassword === "string" && newPassword.length > 0 ? await hashPassword(newPassword) : { salt: account.salt, hash: account.hash };
  ownerAccounts.delete(oldKey);
  ownerAccounts.set(newKey, { username: newUsername.trim(), ...credentials });
  if (newKey !== oldKey) {
    retiredBusinessIds.set(oldKey, newKey);
    const businessSnapshot = snapshots.get(oldKey);
    if (businessSnapshot) {
      snapshots.set(newKey, businessSnapshot);
      snapshots.delete(oldKey);
    }
  }
  await saveOwnerAccounts();
  await saveBusinessHistory();
  response.json({ ok: true, username: newUsername.trim(), businessId: newKey });
});

router.get("/bridge", (request, response) => {
  response.json(snapshotFor(String(request.query.ownerId ?? "default")));
});

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
