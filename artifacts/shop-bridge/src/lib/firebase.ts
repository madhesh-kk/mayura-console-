import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, onValue, push, ref, runTransaction, set, update, type Database } from "firebase/database";

export type OrderStatus = "pending" | "confirmed" | "completed";

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
let database: Database | undefined;

if (firebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  database = getDatabase(app);
}

export const bridgeDatabase = database;
export const bridgeRoot = database ? ref(database, "shopBridge") : null;

export function watchLiveBridge(onSnapshot: (snapshot: BridgeSnapshot) => void, onError?: (error: Error) => void) {
  if (!bridgeRoot) return () => undefined;
  let current: BridgeSnapshot = { orders: [], inventory: [], restocks: [] };
  const stop = onValue(bridgeRoot, (value) => {
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

export async function writeOrder(order: Order) {
  if (!database) return;
  await set(ref(database, `shopBridge/orders/${order.id}`), order);
}

export async function patchOrder(id: string, patch: Partial<Order>) {
  if (!database) return;
  await update(ref(database, `shopBridge/orders/${id}`), patch);
}

export async function deductInventory(itemName: string, quantity: number) {
  if (!database) return false;
  const result = await runTransaction(ref(database, `shopBridge/inventory/${encodeKey(itemName)}`), (item) => {
    if (!item) return item;
    const available = Number(item.currentStock ?? 0);
    if (available < quantity) return;
    return { ...item, currentStock: available - quantity };
  });
  return result.committed;
}

export async function writeInventory(item: InventoryItem) {
  if (!database) return;
  await set(ref(database, `shopBridge/inventory/${encodeKey(item.itemName)}`), item);
}

export async function writeRestock(restock: RestockHistory) {
  if (!database) return;
  const restockRef = push(ref(database, "shopBridge/restocks"));
  await set(restockRef, restock);
}

export function encodeKey(value: string) {
  return value.toLowerCase().replace(/[.#$[\]/]/g, "-").replace(/\s+/g, "-");
}