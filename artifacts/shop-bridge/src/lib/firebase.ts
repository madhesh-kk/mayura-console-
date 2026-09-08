import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth } from "firebase/auth";
import { getDatabase, onDisconnect, onValue, push, ref, runTransaction, set, update, type Database } from "firebase/database";

export type OrderStatus = "pending" | "confirmed" | "completed";
export type ShopRole = "shop1" | "shop2";

export type Order = {
  id: string;
  itemName: string;
  quantity: number;
  status: OrderStatus;
  timeRequested: number;
  timeConfirmed?: number;
  timeAcknowledged?: number;
  reminderNeeded: boolean;
};

export type InventoryItem = {
  itemName: string;
  currentStock: number;
  lowStockThreshold: number;
  lastRestockedTime: number;
};

export type RestockHistory = {
  itemName: string;
  restockedQuantity: number;
  timestamp: number;
};

export type BridgeSnapshot = {
  orders: Order[];
  inventory: InventoryItem[];
  restocks: RestockHistory[];
};

export type ShopPresence = {
  role: ShopRole;
  username: string;
  lastSeen: number;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let database: Database | undefined;

if (firebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  database = getDatabase(app);
}

let authReady: Promise<void> | undefined;
if (auth) {
  authReady = new Promise<void>((resolve, reject) => {
    const stopListening = onAuthStateChanged(auth, (user) => {
      if (user) {
        stopListening();
        resolve();
        return;
      }
      void signInAnonymously(auth).catch((error: unknown) => {
        stopListening();
        reject(error);
      });
    }, (error) => {
      stopListening();
      reject(error);
    });
  });
}

export const bridgeDatabase = database;
function businessPath(businessId: string) {
  return `shopBridge/businesses/${encodeKey(businessId)}`;
}

export function watchLiveBridge(businessId: string, onSnapshot: (snapshot: BridgeSnapshot) => void, onError?: (error: Error) => void) {
  if (!database) return () => undefined;
  let current: BridgeSnapshot = { orders: [], inventory: [], restocks: [] };
  const stop = onValue(ref(database, businessPath(businessId)), (value) => {
    const data = value.val() ?? {};
    current = {
      orders: Object.values(data.orders ?? {}) as Order[],
      inventory: Object.values(data.inventory ?? {}) as InventoryItem[],
      restocks: Object.values(data.restocks ?? {}) as RestockHistory[],
    };
    onSnapshot(current);
  }, (error) => onError?.(error));
  return stop;
}

export async function ensureLiveAccess() {
  await authReady;
}

export async function writeOrder(businessId: string, order: Order) {
  if (!database) return;
  await ensureLiveAccess();
  await set(ref(database, `${businessPath(businessId)}/orders/${order.id}`), order);
}

export async function patchOrder(businessId: string, id: string, patch: Partial<Order>) {
  if (!database) return;
  await ensureLiveAccess();
  await update(ref(database, `${businessPath(businessId)}/orders/${id}`), patch);
}

export async function deductInventory(businessId: string, itemName: string, quantity: number) {
  if (!database) return false;
  await ensureLiveAccess();
  const result = await runTransaction(ref(database, `${businessPath(businessId)}/inventory/${encodeKey(itemName)}`), (item) => {
    if (!item) return item;
    const available = Number(item.currentStock ?? 0);
    if (available < quantity) return;
    return { ...item, currentStock: available - quantity };
  });
  return result.committed;
}

export async function adjustInventory(businessId: string, itemName: string, delta: number) {
  if (!database) return false;
  await ensureLiveAccess();
  const result = await runTransaction(ref(database, `${businessPath(businessId)}/inventory/${encodeKey(itemName)}`), (item) => {
    if (!item) return item;
    return {
      ...item,
      currentStock: Math.max(0, Number(item.currentStock ?? 0) + delta),
      lastRestockedTime: delta > 0 ? Date.now() : item.lastRestockedTime,
    };
  });
  return result.committed;
}

export async function writeInventory(businessId: string, item: InventoryItem) {
  if (!database) return;
  await ensureLiveAccess();
  await set(ref(database, `${businessPath(businessId)}/inventory/${encodeKey(item.itemName)}`), item);
}

export async function writeRestock(businessId: string, restock: RestockHistory) {
  if (!database) return;
  await ensureLiveAccess();
  const restockRef = push(ref(database, `${businessPath(businessId)}/restocks`));
  await set(restockRef, restock);
}

export async function registerPresence(businessId: string, presence: ShopPresence) {
  if (!database) return;
  await ensureLiveAccess();
  const presenceRef = ref(database, `${businessPath(businessId)}/presence/${presence.role}`);
  await set(presenceRef, presence);
  await onDisconnect(presenceRef).remove();
}

export function watchPresence(businessId: string, onSnapshot: (presence: Record<string, ShopPresence>) => void) {
  if (!database) return () => undefined;
  return onValue(ref(database, `${businessPath(businessId)}/presence`), (value) => {
    onSnapshot((value.val() ?? {}) as Record<string, ShopPresence>);
  });
}

export function encodeKey(value: string) {
  return value.toLowerCase().replace(/[.#$[\]/]/g, "-").replace(/\s+/g, "-");
}