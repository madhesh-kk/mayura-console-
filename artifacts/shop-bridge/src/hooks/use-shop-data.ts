import { useCallback, useEffect, useMemo, useState } from "react";
import {
  encodeKey,
  firebaseConfigured,
  deductInventory,
  patchOrder,
  type BridgeSnapshot,
  type InventoryItem,
  type Order,
  type RestockHistory,
  watchLiveBridge,
  writeInventory,
  writeOrder,
  writeRestock,
} from "@/lib/firebase";

const STORAGE_KEY = "shop-bridge-demo-data";

const seed: BridgeSnapshot = {
  orders: [
    {
      id: "ord-101",
      itemName: "Jasmine Green",
      quantity: 4,
      status: "pending",
      timeRequested: Date.now() - 1000 * 60 * 18,
      reminderNeeded: true,
    },
    {
      id: "ord-098",
      itemName: "Earl Grey",
      quantity: 3,
      status: "completed",
      timeRequested: Date.now() - 1000 * 60 * 60 * 4,
      timeConfirmed: Date.now() - 1000 * 60 * 60 * 3.8,
      timeAcknowledged: Date.now() - 1000 * 60 * 60 * 2.9,
      reminderNeeded: false,
    },
    {
      id: "ord-100",
      itemName: "Oolong",
      quantity: 2,
      status: "confirmed",
      timeRequested: Date.now() - 1000 * 60 * 45,
      timeConfirmed: Date.now() - 1000 * 60 * 39,
      reminderNeeded: false,
    },
  ],
  inventory: [
    { itemName: "Jasmine Green", currentStock: 5, lowStockThreshold: 8, lastRestockedTime: Date.now() - 1000 * 60 * 60 * 27 },
    { itemName: "Earl Grey", currentStock: 14, lowStockThreshold: 8, lastRestockedTime: Date.now() - 1000 * 60 * 60 * 12 },
    { itemName: "Oolong", currentStock: 7, lowStockThreshold: 6, lastRestockedTime: Date.now() - 1000 * 60 * 60 * 52 },
    { itemName: "Chamomile", currentStock: 18, lowStockThreshold: 10, lastRestockedTime: Date.now() - 1000 * 60 * 60 * 20 },
    { itemName: "Peppermint", currentStock: 3, lowStockThreshold: 6, lastRestockedTime: Date.now() - 1000 * 60 * 60 * 78 },
    { itemName: "Masala Chai", currentStock: 11, lowStockThreshold: 7, lastRestockedTime: Date.now() - 1000 * 60 * 60 * 8 },
  ],
  restocks: [
    { itemName: "Earl Grey", restockedQuantity: 12, timestamp: Date.now() - 1000 * 60 * 60 * 12 },
    { itemName: "Masala Chai", restockedQuantity: 8, timestamp: Date.now() - 1000 * 60 * 60 * 8 },
    { itemName: "Chamomile", restockedQuantity: 10, timestamp: Date.now() - 1000 * 60 * 60 * 20 },
  ],
};

function readDemo(): BridgeSnapshot {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : seed;
  } catch {
    return seed;
  }
}

function saveDemo(snapshot: BridgeSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent("shop-bridge-demo-update"));
}

export function useShopData() {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot>(() => (firebaseConfigured ? { orders: [], inventory: [], restocks: [] } : readDemo()));
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  useEffect(() => {
    if (firebaseConfigured) {
      return watchLiveBridge((next) => {
        setSnapshot(next);
        setLoading(false);
        setError(null);
        setLastUpdated(Date.now());
      }, () => {
        setLoading(false);
        setError("Firebase could not be reached. Check the database URL and security rules.");
      });
    }
    const refresh = () => {
      setSnapshot(readDemo());
      setLastUpdated(Date.now());
    };
    window.addEventListener("shop-bridge-demo-update", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("shop-bridge-demo-update", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const mutateDemo = useCallback((change: (current: BridgeSnapshot) => BridgeSnapshot) => {
    if (firebaseConfigured) return;
    const next = change(readDemo());
    saveDemo(next);
    setSnapshot(next);
    setLastUpdated(Date.now());
  }, []);

  const createOrder = useCallback(async (itemName: string, quantity: number) => {
    const order: Order = {
      id: `ord-${Date.now().toString(36)}`,
      itemName,
      quantity,
      status: "pending",
      timeRequested: Date.now(),
      reminderNeeded: false,
    };
    if (firebaseConfigured) await writeOrder(order);
    else mutateDemo((current) => ({ ...current, orders: [order, ...current.orders] }));
    return order;
  }, [mutateDemo]);

  const confirmOrder = useCallback(async (id: string) => {
    const order = snapshot.orders.find((candidate) => candidate.id === id);
    if (!order) return;
    const patch = { status: "confirmed" as const, timeConfirmed: Date.now(), reminderNeeded: false };
    if (firebaseConfigured) {
      const item = snapshot.inventory.find((candidate) => candidate.itemName === order.itemName);
      if (!item || item.currentStock < order.quantity) {
        throw new Error(`Not enough ${order.itemName} in stock.`);
      }
      const committed = await deductInventory(order.itemName, order.quantity);
      if (!committed) throw new Error(`Stock changed before ${order.itemName} could be confirmed.`);
      await patchOrder(id, patch);
    } else {
      mutateDemo((current) => ({
        ...current,
        orders: current.orders.map((entry) => entry.id === id ? { ...entry, ...patch } : entry),
        inventory: current.inventory.map((entry) => entry.itemName === order.itemName
          ? { ...entry, currentStock: Math.max(0, entry.currentStock - order.quantity) }
          : entry),
      }));
    }
  }, [mutateDemo, snapshot.inventory, snapshot.orders]);

  const acknowledgeOrder = useCallback(async (id: string) => {
    const patch = { status: "completed" as const, timeAcknowledged: Date.now() };
    if (firebaseConfigured) await patchOrder(id, patch);
    else mutateDemo((current) => ({ ...current, orders: current.orders.map((order) => order.id === id ? { ...order, ...patch } : order) }));
  }, [mutateDemo]);

  const markReminderNeeded = useCallback(async (id: string) => {
    const order = snapshot.orders.find((candidate) => candidate.id === id);
    if (!order || order.status !== "confirmed" || order.reminderNeeded) return;
    const patch = { reminderNeeded: true };
    if (firebaseConfigured) await patchOrder(id, patch);
    else mutateDemo((current) => ({ ...current, orders: current.orders.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) }));
  }, [mutateDemo, snapshot.orders]);

  const saveInventoryItem = useCallback(async (item: InventoryItem) => {
    if (firebaseConfigured) await writeInventory(item);
    else mutateDemo((current) => ({ ...current, inventory: current.inventory.some((entry) => entry.itemName === item.itemName) ? current.inventory.map((entry) => entry.itemName === item.itemName ? item : entry) : [item, ...current.inventory] }));
  }, [mutateDemo]);

  const restock = useCallback(async (itemName: string, quantity: number) => {
    const now = Date.now();
    const entry: RestockHistory = { itemName, restockedQuantity: quantity, timestamp: now };
    if (firebaseConfigured) {
      const item = snapshot.inventory.find((candidate) => candidate.itemName === itemName);
      if (item) await writeInventory({ ...item, currentStock: item.currentStock + quantity, lastRestockedTime: now });
      await writeRestock(entry);
    } else {
      mutateDemo((current) => ({
        ...current,
        inventory: current.inventory.map((item) => item.itemName === itemName ? { ...item, currentStock: item.currentStock + quantity, lastRestockedTime: now } : item),
        restocks: [entry, ...current.restocks],
      }));
    }
  }, [mutateDemo, snapshot.inventory]);

  const sortedOrders = useMemo(() => [...snapshot.orders].sort((a, b) => b.timeRequested - a.timeRequested), [snapshot.orders]);
  const lowStock = useMemo(() => snapshot.inventory.filter((item) => item.currentStock < item.lowStockThreshold), [snapshot.inventory]);

  return {
    ...snapshot,
    orders: sortedOrders,
    lowStock,
    loading,
    error,
    lastUpdated,
    isDemo: !firebaseConfigured,
    createOrder,
    confirmOrder,
    acknowledgeOrder,
    markReminderNeeded,
    saveInventoryItem,
    restock,
    resetDemo: () => {
      if (!firebaseConfigured) saveDemo(seed);
    },
    encodeKey,
  };
}