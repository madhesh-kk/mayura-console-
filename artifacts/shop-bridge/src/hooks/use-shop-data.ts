import { useCallback, useEffect, useMemo, useState } from "react";
import {
  encodeKey,
  ensureLiveAccess,
  firebaseConfigured,
  adjustInventory,
  acknowledgeRestock,
  deductInventory,
  patchOrder,
  type BridgeSnapshot,
  type CatalogItem,
  type OrderLineItem,
  type InventoryItem,
  type Order,
  type RestockHistory,
  watchLiveBridge,
  writeInventory,
  writeOrder,
  writeRestock,
} from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

const STORAGE_KEY = "shop-bridge-demo-data";
const getStorageKey = (businessId: string) => `${STORAGE_KEY}:${encodeKey(businessId)}`;
const bridgeApiUrl = (businessId: string) => apiUrl(`/api/bridge?ownerId=${encodeURIComponent(businessId)}`);

const starterCatalog: CatalogItem[] = [
  { id: "ginger-tea", name: "Ginger Tea", price: 20, category: "Tea", stock: 12 },
  { id: "normal-tea-sugar", name: "Normal Tea with Sugar", price: 15, category: "Tea", stock: 12 },
  { id: "normal-tea-no-sugar", name: "Normal Tea without Sugar", price: 15, category: "Tea", stock: 12 },
  { id: "lemon-tea", name: "Lemon Tea", price: 20, category: "Tea", stock: 12 },
  { id: "jasmine-green", name: "Jasmine Green", price: 22, category: "Tea", stock: 5 },
  { id: "earl-grey", name: "Earl Grey", price: 24, category: "Tea", stock: 14 },
  { id: "oolong", name: "Oolong", price: 26, category: "Tea", stock: 7 },
];

const seed: BridgeSnapshot = {
  orders: [],
  inventory: [],
  restocks: [],
  catalog: starterCatalog,
};

function readDemo(businessId: string): BridgeSnapshot {
  try {
    const stored = localStorage.getItem(getStorageKey(businessId));
    const snapshot = stored ? JSON.parse(stored) as BridgeSnapshot : seed;
    snapshot.catalog ??= starterCatalog;
    snapshot.catalog = snapshot.catalog.map((item) => ({ ...item, stock: item.stock ?? snapshot.inventory.find((entry) => entry.itemName === item.name)?.currentStock ?? 0 }));
    return snapshot;
  } catch {
    return seed;
  }
}

function saveDemo(businessId: string, snapshot: BridgeSnapshot) {
  localStorage.setItem(getStorageKey(businessId), JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent("shop-bridge-demo-update"));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("shop-bridge-demo");
    channel.postMessage({ businessId: encodeKey(businessId) });
    channel.close();
  }
}

function hasData(snapshot: BridgeSnapshot) {
  return snapshot.orders.length > 0 || snapshot.inventory.length > 0 || snapshot.restocks.length > 0 || snapshot.catalog?.length > 0;
}

async function syncDemo(businessId: string, snapshot: BridgeSnapshot) {
  try {
    await fetch(bridgeApiUrl(businessId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
  } catch {
    // Keep local demo mode available when the optional API is offline.
  }
}

async function readRemoteDemo(businessId: string) {
  try {
    const response = await fetch(bridgeApiUrl(businessId));
    if (!response.ok) return null;
    return await response.json() as BridgeSnapshot;
  } catch {
    return null;
  }
}

export function useShopData(businessId: string) {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot>(() => (firebaseConfigured ? { orders: [], inventory: [], restocks: [], catalog: [] } : readDemo(businessId)));
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  useEffect(() => {
    if (firebaseConfigured) {
      let active = true;
      let stopWatching: (() => void) | undefined;
      void ensureLiveAccess().then(() => {
        if (!active) return;
        stopWatching = watchLiveBridge(businessId, (next) => {
          setSnapshot(next);
          setLoading(false);
          setError(null);
          setLastUpdated(Date.now());
        }, () => {
          setLoading(false);
          setError("Firebase could not be reached. Check the database URL, Anonymous sign-in, and security rules.");
        });
      }).catch(() => {
        if (!active) return;
        setLoading(false);
        setError("Firebase access needs Anonymous sign-in enabled in Authentication before the shared lane can load.");
      });
      return () => {
        active = false;
        stopWatching?.();
      };
    }
    const refresh = () => {
      setSnapshot(readDemo(businessId));
      setLastUpdated(Date.now());
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("shop-bridge-demo") : undefined;
    const refreshFromChannel = () => refresh();
    let remoteSnapshot: BridgeSnapshot | null = null;
    const loadRemote = async () => {
      try {
        const response = await fetch(bridgeApiUrl(businessId));
        if (!response.ok) return;
        const next = await response.json() as BridgeSnapshot;
        next.catalog ??= starterCatalog;
        next.catalog = next.catalog.map((item) => ({ ...item, stock: item.stock ?? next.inventory.find((entry) => entry.itemName === item.name)?.currentStock ?? 0 }));
        if (hasData(next)) {
          remoteSnapshot = next;
          localStorage.setItem(getStorageKey(businessId), JSON.stringify(next));
          setSnapshot(next);
          setLastUpdated(Date.now());
        } else if (!remoteSnapshot) {
          await syncDemo(businessId, readDemo(businessId));
        }
      } catch {
        // Local storage remains the fallback when the optional API is offline.
      }
    };
    void loadRemote();
    const remoteTimer = window.setInterval(() => void loadRemote(), 1000);
    window.addEventListener("shop-bridge-demo-update", refresh);
    window.addEventListener("storage", refresh);
    channel?.addEventListener("message", refreshFromChannel);
    return () => {
      window.removeEventListener("shop-bridge-demo-update", refresh);
      window.removeEventListener("storage", refresh);
      channel?.removeEventListener("message", refreshFromChannel);
      channel?.close();
      window.clearInterval(remoteTimer);
    };
  }, [businessId]);

  const mutateDemo = useCallback(async (change: (current: BridgeSnapshot) => BridgeSnapshot) => {
    if (firebaseConfigured) return;
    const current = await readRemoteDemo(businessId) ?? readDemo(businessId);
    current.catalog ??= starterCatalog;
    current.catalog = current.catalog.map((item) => ({ ...item, stock: item.stock ?? current.inventory.find((entry) => entry.itemName === item.name)?.currentStock ?? 0 }));
    const next = change(current);
    saveDemo(businessId, next);
    void syncDemo(businessId, next);
    setSnapshot(next);
    setLastUpdated(Date.now());
  }, [businessId]);

  const createOrder = useCallback(async (items: OrderLineItem[], requesterName?: string) => {
    const firstItem = items[0];
    const order: Order = {
      id: `ord-${Date.now().toString(36)}`,
      itemName: firstItem.itemName,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      status: "pending",
      timeRequested: Date.now(),
      reminderNeeded: false,
      requesterName: requesterName?.trim() || undefined,
      items,
      total: items.reduce((sum, item) => sum + item.subtotal, 0),
      ownerId: businessId,
    };
    if (firebaseConfigured) await writeOrder(businessId, order);
    else mutateDemo((current) => ({ ...current, orders: [order, ...current.orders] }));
    return order;
  }, [businessId, mutateDemo]);

  const saveCatalogItem = useCallback(async (item: CatalogItem) => {
    if (!firebaseConfigured) await mutateDemo((current) => {
      const category = item.category?.trim() || "Uncategorized";
      const normalized = current.catalog.find((entry) => entry.category?.toLowerCase() === category.toLowerCase())?.category ?? category;
      const nextItem = { ...item, category: normalized, stock: Math.max(0, Number(item.stock) || 0) };
      return { ...current, catalog: current.catalog.some((entry) => entry.id === item.id) ? current.catalog.map((entry) => entry.id === item.id ? nextItem : entry) : [...current.catalog, nextItem] };
    });
  }, [mutateDemo]);

  const removeCatalogItem = useCallback(async (id: string) => {
    if (!firebaseConfigured) await mutateDemo((current) => ({ ...current, catalog: current.catalog.filter((item) => item.id !== id) }));
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
      const committed = await deductInventory(businessId, order.itemName, order.quantity);
      if (!committed) throw new Error(`Stock changed before ${order.itemName} could be confirmed.`);
      await patchOrder(businessId, id, patch);
    } else {
      mutateDemo((current) => ({
        ...current,
        orders: current.orders.map((entry) => entry.id === id ? { ...entry, ...patch } : entry),
        inventory: current.inventory.map((entry) => {
          const line = order.items?.find((item) => item.itemName === entry.itemName);
          return line ? { ...entry, currentStock: Math.max(0, entry.currentStock - line.quantity) } : entry;
        }),
        catalog: current.catalog.map((item) => {
          const line = order.items?.find((entry) => entry.itemId === item.id || entry.itemName === item.name);
          return line ? { ...item, stock: Math.max(0, item.stock - line.quantity) } : item;
        }),
      }));
    }
  }, [businessId, mutateDemo, snapshot.inventory, snapshot.orders]);

  const acknowledgeOrder = useCallback(async (id: string) => {
    const patch = { status: "completed" as const, timeAcknowledged: Date.now() };
    if (firebaseConfigured) await patchOrder(businessId, id, patch);
    else mutateDemo((current) => ({ ...current, orders: current.orders.map((order) => order.id === id ? { ...order, ...patch } : order) }));
  }, [businessId, mutateDemo]);

  const markReminderNeeded = useCallback(async (id: string) => {
    const order = snapshot.orders.find((candidate) => candidate.id === id);
    if (!order || order.status !== "confirmed" || order.reminderNeeded) return;
    const patch = { reminderNeeded: true };
    if (firebaseConfigured) await patchOrder(businessId, id, patch);
    else mutateDemo((current) => ({ ...current, orders: current.orders.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) }));
  }, [businessId, mutateDemo, snapshot.orders]);

  const saveInventoryItem = useCallback(async (item: InventoryItem) => {
    if (firebaseConfigured) await writeInventory(businessId, item);
    else mutateDemo((current) => ({ ...current, inventory: current.inventory.some((entry) => entry.itemName === item.itemName) ? current.inventory.map((entry) => entry.itemName === item.itemName ? item : entry) : [item, ...current.inventory] }));
  }, [businessId, mutateDemo]);

  const changeInventory = useCallback(async (itemName: string, delta: number) => {
    if (firebaseConfigured) {
      await adjustInventory(businessId, itemName, delta);
      return;
    }
    mutateDemo((current) => ({
      ...current,
      inventory: current.inventory.map((item) => item.itemName === itemName
        ? { ...item, currentStock: Math.max(0, item.currentStock + delta), lastRestockedTime: delta > 0 ? Date.now() : item.lastRestockedTime }
        : item),
      catalog: current.catalog.map((item) => item.name === itemName ? { ...item, stock: Math.max(0, item.stock + delta) } : item),
    }));
  }, [businessId, mutateDemo]);

  const restock = useCallback(async (itemName: string, quantity: number) => {
    const now = Date.now();
    const entry: RestockHistory = {
      id: `restock-${Date.now().toString(36)}`,
      itemName,
      restockedQuantity: quantity,
      timestamp: now,
    };
    if (firebaseConfigured) {
      const item = snapshot.inventory.find((candidate) => candidate.itemName === itemName);
      if (item) {
        await adjustInventory(businessId, itemName, quantity);
      } else {
        const catalogItem = snapshot.catalog.find((candidate) => candidate.name === itemName);
        await writeInventory(businessId, {
          itemName,
          currentStock: (catalogItem?.stock ?? 0) + quantity,
          lowStockThreshold: 3,
          lastRestockedTime: now,
        });
      }
      await writeRestock(businessId, entry);
    } else {
      await mutateDemo((current) => ({
        ...current,
        inventory: current.inventory.some((item) => item.itemName === itemName)
          ? current.inventory.map((item) => item.itemName === itemName ? { ...item, currentStock: item.currentStock + quantity, lastRestockedTime: now } : item)
          : [...current.inventory, { itemName, currentStock: quantity, lowStockThreshold: 3, lastRestockedTime: now }],
        catalog: current.catalog.map((item) => item.name === itemName ? { ...item, stock: item.stock + quantity } : item),
        restocks: [entry, ...current.restocks],
      }));
    }
  }, [businessId, mutateDemo, snapshot.inventory]);

  const confirmRestock = useCallback(async (id: string, acknowledgedBy: string) => {
    const acknowledgedAt = Date.now();
    if (firebaseConfigured) {
      await acknowledgeRestock(businessId, id, acknowledgedBy);
    } else {
      await mutateDemo((current) => ({
        ...current,
        restocks: current.restocks.map((entry) => entry.id === id
          ? { ...entry, acknowledgedAt, acknowledgedBy }
          : entry),
      }));
    }
  }, [businessId, mutateDemo]);

  const sortedOrders = useMemo(() => [...snapshot.orders].sort((a, b) => b.timeRequested - a.timeRequested), [snapshot.orders]);
  const lowStock = useMemo(
    () => snapshot.inventory.filter((item) => {
      const catalogItem = snapshot.catalog.find((candidate) => candidate.name === item.itemName);
      const isTea = catalogItem?.category?.trim().toLowerCase() === "tea";
      return !isTea && item.currentStock < item.lowStockThreshold;
    }),
    [snapshot.catalog, snapshot.inventory],
  );
  const catalogLowStock = useMemo(
    () => snapshot.catalog.filter((item) => item.category?.trim().toLowerCase() !== "tea" && item.stock < 3),
    [snapshot.catalog],
  );

  return {
    ...snapshot,
    orders: sortedOrders,
    lowStock,
    catalogLowStock,
    loading,
    error,
    lastUpdated,
    isDemo: !firebaseConfigured,
    createOrder,
    confirmOrder,
    acknowledgeOrder,
    markReminderNeeded,
    saveInventoryItem,
    changeInventory,
    restock,
    confirmRestock,
    saveCatalogItem,
    removeCatalogItem,
    resetDemo: () => {
      if (!firebaseConfigured) saveDemo(businessId, seed);
    },
    encodeKey,
  };
}