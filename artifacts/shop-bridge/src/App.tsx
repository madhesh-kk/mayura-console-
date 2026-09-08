import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  FileClock,
  Leaf,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  RefreshCw,
  Settings2,
  ShoppingBasket,
  Signal,
  UserRound,
  Truck,
  X,
} from "lucide-react";
import { useShopData } from "@/hooks/use-shop-data";
import { useTamilAlerts } from "@/hooks/use-tamil-alerts";
import databaseRules from "@/lib/firebase.database.rules.json";
import { ensureLiveAccess, firebaseConfigured, registerPresence, watchPresence, type InventoryItem, type Order, type OrderStatus, type ShopRole } from "@/lib/firebase";

type ShopSession = {
  username: string;
  businessId: string;
  role: ShopRole;
};

const SESSION_KEY = "shop-bridge-session";

function readSession(): ShopSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as ShopSession;
    return session.username && session.businessId && (session.role === "shop1" || session.role === "shop2") ? session : null;
  } catch {
    return null;
  }
}

function initials(username: string) {
  return username.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SH";
}

function useShopPresence(session: ShopSession) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  useEffect(() => {
    if (!firebaseConfigured) {
      setPartnerOnline(false);
      return;
    }
    let active = true;
    let stopWatching: (() => void) | undefined;
    void ensureLiveAccess().then(() => {
      if (!active) return;
      void registerPresence(session.businessId, { role: session.role, username: session.username, lastSeen: Date.now() }).catch(() => undefined);
      stopWatching = watchPresence(session.businessId, (presence) => {
        const partner = session.role === "shop1" ? "shop2" : "shop1";
        setPartnerOnline(Boolean(presence[partner]));
      });
    }).catch(() => setPartnerOnline(false));
    return () => {
      active = false;
      stopWatching?.();
    };
  }, [session.businessId, session.role, session.username]);
  return partnerOnline;
}

const navItems = [
  { href: "/shop1", label: "Shop 1 · Send", icon: ShoppingBasket },
  { href: "/shop2", label: "Shop 2 · Receive", icon: PackageCheck },
  { href: "/setup", label: "Connection setup", icon: Settings2 },
];

const timeFormatter = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function formatTime(timestamp?: number) {
  return timestamp ? timeFormatter.format(timestamp) : "—";
}

function formatDate(timestamp?: number) {
  return timestamp ? dateFormatter.format(timestamp) : "—";
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

function AppShell({ children, session, onLogout }: { children: ReactNode; session: ShopSession; onLogout: () => void }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDemo = !firebaseConfigured;
  const partnerOnline = useShopPresence(session);
  const partnerLabel = session.role === "shop1" ? "Shop 2" : "Shop 1";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Link href="/shop1" className="brand" data-testid="link-brand" onClick={() => setMobileOpen(false)}>
            <span className="brand-mark"><Leaf size={20} strokeWidth={2.5} /></span>
            <span><strong>Steep</strong><em>bridge</em></span>
          </Link>
          <button className="icon-button sidebar-close" aria-label="Close menu" data-testid="button-close-menu" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <div className="sidebar-context">
          <span className="context-dot" />
          <span>Two shops, one rhythm</span>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          <p className="eyebrow nav-heading">Workspace</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link
                href={item.href}
                key={item.href}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
                data-testid={`link-nav-${item.href.slice(1)}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.href === "/shop2" && <span className="nav-live-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon"><Signal size={16} /></div>
          <div>
            <strong>{isDemo ? "Demo workspace" : "Live workspace"}</strong>
            <span>{isDemo ? "Changes stay on this device." : "Changes sync in real time."}</span>
          </div>
        </div>
        <div className="sidebar-footer">
          <span className="mono">STEep / 02</span>
          <span>v1.0</span>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" data-testid="button-close-scrim" onClick={() => setMobileOpen(false)} />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-trigger" aria-label="Open menu" data-testid="button-open-menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
          <div className="topbar-location"><span className="live-pulse" /> Shared handoff desk <span className="slash">/</span> {location === "/shop2" ? "Shop 2" : location === "/setup" ? "Setup" : "Shop 1"}</div>
          <div className="topbar-right"><span className={`connection-pill ${partnerOnline ? "connection-online" : ""}`}><span className="context-dot" />{partnerOnline ? `${partnerLabel} connected` : `Waiting for ${partnerLabel}`}</span><span className="topbar-date">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span><div className="avatar">{initials(session.username)}</div><button className="logout-button" onClick={onLogout} aria-label="Log out" title="Log out"><LogOut size={16} /></button></div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function DemoBanner({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) {
    return <div className="sync-banner live-banner"><span className="sync-icon"><Signal size={15} /></span><span>Live sync is on. Updates appear for both shop teams.</span></div>;
  }
  return (
    <div className="sync-banner demo-banner">
      <span className="sync-icon"><Database size={15} /></span>
      <span><strong>Demo mode</strong> — changes are saved on this device until Firebase is connected.</span>
      <Link href="/setup" className="banner-link" data-testid="link-banner-setup">Connect Firebase <ArrowRight size={14} /></Link>
    </div>
  );
}

function DataState({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <div className="data-state loading-state"><span className="loading-bar" /><span className="loading-bar loading-bar-short" /> Loading the shared shelf…</div>;
  if (error) return <div className="data-state error-state"><AlertTriangle size={16} /><span>{error}</span><Link href="/setup" className="text-link" data-testid="link-data-error-setup">Review setup <ArrowRight size={13} /></Link></div>;
  return null;
}

function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="intro-action">{children}</div>}
    </div>
  );
}

function StatChip({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof Clock3; label: string; value: string; tone?: string }) {
  return <div className={`stat-chip stat-${tone}`}><Icon size={16} /><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const copy = { pending: "Needs confirmation", confirmed: "On the way", completed: "Received" };
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{copy[status]}</span>;
}

function OrderTimeline({ order }: { order: Order }) {
  return (
    <div className="timeline" data-testid={`status-timeline-${order.id}`}>
      <div className="timeline-step step-done"><span><Check size={12} /></span><small>Requested</small><b>{formatTime(order.timeRequested)}</b></div>
      <div className={`timeline-line ${order.status === "confirmed" || order.status === "completed" ? "line-done" : ""}`} />
      <div className={`timeline-step ${order.status === "confirmed" || order.status === "completed" ? "step-done" : ""}`}><span><Check size={12} /></span><small>Confirmed</small><b>{formatTime(order.timeConfirmed)}</b></div>
      <div className={`timeline-line ${order.status === "completed" ? "line-done" : ""}`} />
      <div className={`timeline-step ${order.status === "completed" ? "step-done" : ""}`}><span><Check size={12} /></span><small>Received</small><b>{formatTime(order.timeAcknowledged)}</b></div>
    </div>
  );
}

function OrderCard({ order, action, actionLabel, actionIcon, accent = false }: { order: Order; action?: () => void; actionLabel?: string; actionIcon?: ReactNode; accent?: boolean }) {
  return (
    <article className={`order-card ${accent ? "order-card-attention" : ""}`} data-testid={`card-order-${order.id}`}>
      <div className="order-card-top">
        <div className="order-title"><span className="tea-swatch"><Leaf size={15} /></span><div><h3>{order.itemName}</h3><p>{order.quantity} {order.quantity === 1 ? "case" : "cases"} · {relativeTime(order.timeRequested)}</p></div></div>
        <StatusBadge status={order.status} />
      </div>
      <OrderTimeline order={order} />
      {action && actionLabel && <button className={`button ${accent ? "button-primary" : "button-secondary"} wide-action`} onClick={action} data-testid={`button-${actionLabel.toLowerCase().replaceAll(" ", "-")}-${order.id}`}>{actionIcon}{actionLabel}</button>}
    </article>
  );
}

function SectionHeading({ eyebrow, title, count, children }: { eyebrow?: string; title: string; count?: number; children?: ReactNode }) {
  return <div className="section-heading">{<div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title} {count !== undefined && <span className="count">{count}</span>}</h2></div>}{children}</div>;
}

function InventoryMini({ items, readOnly = false, editable = false, onAdjust }: { items: InventoryItem[]; readOnly?: boolean; editable?: boolean; onAdjust?: (itemName: string, delta: number) => void }) {
  return (
    <div className="inventory-list">
      {items.map((item) => {
         const low = item.currentStock < item.lowStockThreshold;
        return <div className="inventory-row" key={item.itemName} data-testid={`row-inventory-${item.itemName}`}>
          <div className="inventory-name"><span className={`inventory-mark ${low ? "inventory-mark-low" : ""}`} /><div><strong>{item.itemName}</strong><small>{low ? "Below threshold" : `Restocked ${relativeTime(item.lastRestockedTime)}`}</small></div></div>
          <div className="inventory-amount"><strong className={low ? "low-number" : ""}>{item.currentStock}</strong><span>cases</span></div>
           {editable && onAdjust && <div className="stock-adjusters"><button onClick={() => onAdjust(item.itemName, -1)} aria-label={`Decrease ${item.itemName} by one`} title="Use one case">−1</button><button onClick={() => onAdjust(item.itemName, 1)} aria-label={`Increase ${item.itemName} by one`} title="Add one case">+1</button></div>}
           {readOnly && <span className={`stock-state ${low ? "stock-low" : "stock-ok"}`}>{low ? "Low" : "Good"}</span>}
        </div>;
      })}
    </div>
  );
}

function HistoryList({ orders, restocks }: { orders: Order[]; restocks: { itemName: string; restockedQuantity: number; timestamp: number }[] }) {
  const rows = useMemo(() => [
      ...orders.map((order) => ({ type: "Order", name: order.itemName, detail: `${order.quantity} cases · ${order.status === "completed" ? "received" : order.status}`, time: order.timeAcknowledged ?? order.timeConfirmed ?? order.timeRequested })),
    ...restocks.map((entry) => ({ type: "Restock", name: entry.itemName, detail: `+${entry.restockedQuantity} cases added`, time: entry.timestamp })),
  ].sort((a, b) => b.time - a.time).slice(0, 8), [orders, restocks]);
  return <div className="history-list">{rows.map((row, index) => <div className="history-row" key={`${row.type}-${row.name}-${row.time}-${index}`} data-testid={`history-row-${index}`}><span className={`history-icon ${row.type === "Order" ? "history-order" : "history-restock"}`}>{row.type === "Order" ? <Truck size={15} /> : <Plus size={15} />}</span><div><strong>{row.name}</strong><small>{row.type} · {row.detail}</small></div><time>{formatDate(row.time)}</time></div>)}{rows.length === 0 && <div className="empty-state compact-empty"><FileClock size={25} /><p>No handoff history yet.</p></div>}</div>;
}

function ShopOne({ session, onLogout }: { session: ShopSession; onLogout: () => void }) {
  const data = useShopData(session.businessId);
  const [itemName, setItemName] = useState("Jasmine Green");
  const [quantity, setQuantity] = useState("2");
  const [sent, setSent] = useState(false);
  const pending = data.orders.filter((order) => order.status !== "completed");
  const awaitingReceipt = data.orders.filter((order) => order.status === "confirmed");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (awaitingReceipt.length === 0) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [awaitingReceipt.length]);

  useEffect(() => {
    const timers = awaitingReceipt.map((order) => {
      const deadline = (order.timeConfirmed ?? Date.now()) + 5 * 60 * 1000;
      return window.setTimeout(() => void data.markReminderNeeded(order.id), Math.max(0, deadline - Date.now()));
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [awaitingReceipt.map((order) => `${order.id}:${order.reminderNeeded}`).join(","), data.markReminderNeeded]);

  const countdown = awaitingReceipt[0]?.timeConfirmed
    ? Math.max(0, awaitingReceipt[0].timeConfirmed + 5 * 60 * 1000 - now)
    : 0;
  const countdownMinutes = Math.floor(countdown / 60000).toString().padStart(2, "0");
  const countdownSeconds = Math.floor((countdown % 60000) / 1000).toString().padStart(2, "0");

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    await data.createOrder(itemName, Number(quantity));
    setSent(true);
    window.setTimeout(() => setSent(false), 3500);
  }

  return <AppShell session={session} onLogout={onLogout}><DemoBanner isDemo={data.isDemo} /><DataState loading={data.loading} error={data.error} />
    <PageIntro eyebrow="Shop 1 · Sending desk" title="Keep the shelf moving." description="Send a clear request to the neighboring team. You will see every handoff, from tap to arrival." />
    <div className="stats-strip">
      <StatChip icon={Bell} label="Open requests" value={`${pending.length}`} tone={pending.length ? "warm" : "neutral"} />
      <StatChip icon={Truck} label="On the way" value={`${awaitingReceipt.length}`} tone="green" />
      <StatChip icon={RefreshCw} label="Last sync" value={relativeTime(data.lastUpdated)} />
    </div>
    <div className="dashboard-grid sender-grid">
      <section className="panel request-panel">
        <div className="panel-accent" />
        <p className="eyebrow">New handoff</p>
        <h2>What do you need across the lane?</h2>
        <p className="panel-copy">One request, one shared view. Shop 2 will see it immediately.</p>
        <form onSubmit={submitOrder} className="request-form">
          <label>Tea to send<select value={itemName} onChange={(event) => setItemName(event.target.value)} data-testid="select-order-item">{data.inventory.map((item) => <option key={item.itemName} value={item.itemName}>{item.itemName}</option>)}</select></label>
          <label>Quantity <span className="label-hint">cases</span><div className="quantity-input"><button type="button" onClick={() => setQuantity(String(Math.max(1, Number(quantity) - 1)))} aria-label="Decrease quantity" data-testid="button-decrease-quantity">−</button><input type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(event.target.value)} data-testid="input-order-quantity" /><button type="button" onClick={() => setQuantity(String(Math.min(99, Number(quantity) + 1)))} aria-label="Increase quantity" data-testid="button-increase-quantity">+</button></div></label>
          <button className="button button-primary send-button" type="submit" data-testid="button-send-order"><span>{sent ? <CheckCircle2 size={19} /> : <ArrowRight size={19} />}</span>{sent ? "Request sent" : "Send request"}<span className="button-shortcut">↵</span></button>
        </form>
      </section>
       <section className="panel signal-panel">
        <div className="signal-header"><div><p className="eyebrow">Right now</p><h2>Handoff signal</h2></div><span className="signal-live"><span className="live-pulse" /> live</span></div>
         {pending.length === 0 ? <div className="empty-state"><CheckCircle2 size={28} /><strong>Nothing waiting on you</strong><p>New requests will show up here.</p></div> : <div className="signal-list">{pending.slice(0, 3).map((order) => <div className="signal-row" key={order.id}><span className={`signal-index ${order.status === "confirmed" ? "signal-index-confirmed" : ""}`}>{order.status === "confirmed" ? <Check size={14} /> : "!"}</span><div><strong>{order.itemName}</strong><span>{order.quantity} cases · {order.status === "confirmed" ? "ready to receive" : "waiting for confirmation"}</span></div><StatusBadge status={order.status} /></div>)}</div>}
      </section>
    </div>
     {awaitingReceipt.length > 0 && <div className="countdown-card"><div><p className="eyebrow">Arrival window</p><strong>{awaitingReceipt[0].itemName} is on the way</strong><span>Acknowledge within five minutes so Shop 2 knows it arrived.</span></div><time>{countdownMinutes}:{countdownSeconds}</time></div>}
     <div className="content-grid">
      <section className="panel"><SectionHeading eyebrow="The lane" title="Active handoffs" count={pending.length} /><div className="order-stack">{pending.length === 0 ? <div className="empty-state"><PackageCheck size={30} /><strong>All clear</strong><p>No open handoffs right now.</p></div> : pending.map((order) => <OrderCard key={order.id} order={order} accent={order.status === "confirmed"} action={order.status === "confirmed" ? () => data.acknowledgeOrder(order.id) : undefined} actionLabel={order.status === "confirmed" ? "Acknowledge delivery" : undefined} actionIcon={<Check size={17} />} />)}</div></section>
      <div className="side-stack">
         <section className="panel"><SectionHeading eyebrow="Shared shelf" title="Stock controls" /><InventoryMini items={data.inventory} editable onAdjust={(itemName, delta) => void data.changeInventory(itemName, delta)} /><p className="panel-footnote"><span className="tiny-dot" /> Use −1 when one case leaves Shop 1</p></section>
        <section className="panel"><SectionHeading eyebrow="Recent movement" title="History" /><HistoryList orders={data.orders} restocks={data.restocks} /><Link href="/shop2" className="text-link" data-testid="link-open-history">Open receiving desk <ArrowRight size={14} /></Link></section>
      </div>
    </div>
  </AppShell>;
}

function RestockModal({ item, onClose, onRestock }: { item: InventoryItem; onClose: () => void; onRestock: (quantity: number) => Promise<void> }) {
  const [amount, setAmount] = useState("6");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await onRestock(Number(amount));
    setSaving(false);
    onClose();
  }
  return <div className="modal-scrim" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="restock-title"><button className="modal-close icon-button" onClick={onClose} aria-label="Close restock dialog" data-testid="button-close-restock"><X size={19} /></button><p className="eyebrow">Inventory movement</p><h2 id="restock-title">Restock {item.itemName}</h2><p className="modal-copy">Add cases to the shared shelf count.</p><form onSubmit={submit}><label>Cases added<input type="number" min="1" max="99" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus data-testid="input-restock-quantity" /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose} data-testid="button-cancel-restock">Cancel</button><button type="submit" className="button button-primary" disabled={saving} data-testid="button-save-restock">{saving ? "Saving…" : "Log restock"}</button></div></form></div></div>;
}

function ShopTwo({ session, onLogout }: { session: ShopSession; onLogout: () => void }) {
  const data = useShopData(session.businessId);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [threshold, setThreshold] = useState("");
  const pending = data.orders.filter((order) => order.status === "pending");
  const confirmed = data.orders.filter((order) => order.status === "confirmed");
  const reminderOrders = data.orders.filter((order) => order.status === "confirmed" && order.reminderNeeded);
  const alerts = useTamilAlerts({ pendingOrders: pending, reminderOrders, lowStock: data.lowStock });

  function startEdit(item: InventoryItem) {
    setEditing(item.itemName);
    setThreshold(String(item.lowStockThreshold));
  }
  async function saveThreshold(item: InventoryItem) {
    await data.saveInventoryItem({ ...item, lowStockThreshold: Math.max(0, Number(threshold)) });
    setEditing(null);
  }

  return <AppShell session={session} onLogout={onLogout}><DemoBanner isDemo={data.isDemo} /><DataState loading={data.loading} error={data.error} />
     <PageIntro eyebrow="Shop 2 · Receiving desk" title="Keep the promise visible." description="Confirm what you can send, keep shelf counts honest, and leave the next shift a clean signal."><button className={`button ${alerts.enabled ? "button-secondary" : "button-primary"}`} onClick={alerts.enable} data-testid="button-enable-sound">{alerts.enabled ? "Sound alerts on" : "Enable sound alerts"}</button></PageIntro>
    <div className="stats-strip">
      <StatChip icon={Bell} label="Needs your eye" value={`${pending.length}`} tone={pending.length ? "warm" : "neutral"} />
      <StatChip icon={AlertTriangle} label="Low-stock alerts" value={`${data.lowStock.length}`} tone={data.lowStock.length ? "alert" : "green"} />
      <StatChip icon={PackageCheck} label="Confirmed today" value={`${confirmed.length}`} tone="green" />
    </div>
    <div className="content-grid receiver-grid">
      <section className="panel pending-panel"><SectionHeading eyebrow="Action queue" title="Requests to confirm" count={pending.length} /><div className="order-stack">{pending.length === 0 ? <div className="empty-state roomy-empty"><CheckCircle2 size={32} /><strong>Queue is clear</strong><p>New requests from Shop 1 will land here live.</p></div> : pending.map((order) => <OrderCard key={order.id} order={order} accent action={() => data.confirmOrder(order.id)} actionLabel="Confirm request" actionIcon={<Check size={17} />} />)}</div></section>
      <div className="side-stack">
        <section className="panel alert-panel"><SectionHeading eyebrow="Pay attention" title="Low-stock alerts" count={data.lowStock.length} />{data.lowStock.length === 0 ? <div className="empty-state compact-empty"><CheckCircle2 size={24} /><p>Everything is above threshold.</p></div> : <div className="alert-list">{data.lowStock.map((item) => <div className="alert-row" key={item.itemName}><AlertTriangle size={17} /><div><strong>{item.itemName}</strong><span>{item.currentStock} cases left · alert at {item.lowStockThreshold}</span></div><button className="small-action" onClick={() => setRestockItem(item)} data-testid={`button-alert-restock-${item.itemName}`}>Restock</button></div>)}</div>}</section>
        <section className="panel"><SectionHeading eyebrow="Recently moved" title="Restock log" /><div className="restock-list">{data.restocks.slice(0, 4).map((entry, index) => <div className="restock-row" key={`${entry.itemName}-${entry.timestamp}-${index}`}><span className="restock-check"><Check size={13} /></span><div><strong>{entry.itemName}</strong><span>+{entry.restockedQuantity} cases</span></div><time>{relativeTime(entry.timestamp)}</time></div>)}</div><Link href="/shop1" className="text-link" data-testid="link-open-sender">View sending desk <ArrowRight size={14} /></Link></section>
      </div>
    </div>
      <section className="panel inventory-panel"><SectionHeading eyebrow="Shared shelf" title="Inventory control" count={data.inventory.length}><span className="section-caption"><span className="tiny-dot" /> Both shops can adjust by one</span></SectionHeading><div className="inventory-table"><div className="inventory-table-head"><span>Tea</span><span>On shelf</span><span>Low at</span><span>Last restocked</span><span /></div>{data.inventory.map((item) => { const low = item.currentStock < item.lowStockThreshold; return <div className={`inventory-table-row ${low ? "row-low" : ""}`} key={item.itemName} data-testid={`manage-inventory-${item.itemName}`}><div className="inventory-name"><span className={`inventory-mark ${low ? "inventory-mark-low" : ""}`} /><strong>{item.itemName}</strong></div><div className="stock-control"><button onClick={() => void data.changeInventory(item.itemName, -1)} aria-label={`Decrease ${item.itemName} by one`}>−</button><div className={`table-number ${low ? "low-number" : ""}`}>{item.currentStock} <small>cases</small></div><button onClick={() => void data.changeInventory(item.itemName, 1)} aria-label={`Increase ${item.itemName} by one`}>+</button></div>{editing === item.itemName ? <div className="threshold-edit"><input value={threshold} type="number" min="0" onChange={(event) => setThreshold(event.target.value)} data-testid={`input-threshold-${item.itemName}`} /><button onClick={() => saveThreshold(item)} className="confirm-edit" aria-label={`Save threshold for ${item.itemName}`} data-testid={`button-save-threshold-${item.itemName}`}><Check size={15} /></button></div> : <button className="threshold-button" onClick={() => startEdit(item)} data-testid={`button-edit-threshold-${item.itemName}`}>{item.lowStockThreshold} <small>cases</small><ChevronDown size={13} /></button>}<span className="last-restocked">{relativeTime(item.lastRestockedTime)}</span><button className="small-action restock-button" onClick={() => setRestockItem(item)} data-testid={`button-restock-${item.itemName}`}><Plus size={14} /> Restock</button></div>; })}</div></section>
    <section className="panel history-panel"><SectionHeading eyebrow="Shared record" title="Order & restock history" /><HistoryList orders={data.orders} restocks={data.restocks} /></section>
    {restockItem && <RestockModal item={restockItem} onClose={() => setRestockItem(null)} onRestock={(amount) => data.restock(restockItem.itemName, amount)} />}
  </AppShell>;
}

function Setup({ session, onLogout }: { session: ShopSession; onLogout: () => void }) {
  const [copied, setCopied] = useState(false);
  const [rulesCopied, setRulesCopied] = useState(false);
  const envText = `VITE_FIREBASE_API_KEY=\\nVITE_FIREBASE_AUTH_DOMAIN=\\nVITE_FIREBASE_DATABASE_URL=\\nVITE_FIREBASE_PROJECT_ID=\\nVITE_FIREBASE_STORAGE_BUCKET=\\nVITE_FIREBASE_MESSAGING_SENDER_ID=\\nVITE_FIREBASE_APP_ID=`;
  const rulesText = JSON.stringify(databaseRules, null, 2);
  async function copy() {
    await navigator.clipboard?.writeText(envText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  async function copyRules() {
    await navigator.clipboard?.writeText(rulesText);
    setRulesCopied(true);
    window.setTimeout(() => setRulesCopied(false), 1800);
  }
  return <AppShell session={session} onLogout={onLogout}><div className="setup-page">
    <div className="setup-hero"><div className="setup-mark"><Database size={26} /></div><p className="eyebrow">Connection setup</p><h1>One shared source of truth.</h1><p>Steepbridge uses Firebase Realtime Database so both shops see the same request the moment it is made. No refresh, no radioing across the lane.</p></div>
    <div className="setup-grid">
      <section className="panel setup-card"><div className="step-number">01</div><h2>Create a Firebase project</h2><p>In the Firebase console, create a project and add a Web app. Then open Authentication → Sign-in method and enable <strong>Anonymous</strong>. The app signs each browser into a temporary Firebase account before it reads or writes the shared lane. Your business ID still selects which workspace the two shops use.</p><a className="text-link" href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" data-testid="link-firebase-console">Open Firebase Console <ArrowRight size={14} /></a></section>
      <section className="panel setup-card"><div className="step-number">02</div><h2>Turn on Realtime Database</h2><p>Create a Realtime Database in the region closest to your shops. The private rules below require a signed-in Firebase session, allow both shops to read their business lane, and validate only order, inventory, restock, and presence data.</p><div className="code-chip">businesses / your-business-id / orders · inventory · restocks</div></section>
      <section className="panel setup-card setup-wide"><div className="step-number">03</div><h2>Apply the private database rules</h2><p>In Realtime Database → Rules, replace the default rules with this policy and publish. It blocks unauthenticated reads and writes, prevents deleting records, keeps order details immutable, and only permits pending → confirmed → completed handoffs. Anonymous authentication protects the database from public traffic, but the business ID is not a second security boundary—only share the URL with the two shop teams.</p><div className="env-block rules-block"><pre>{rulesText}</pre><button className="copy-button" onClick={copyRules} data-testid="button-copy-rules">{rulesCopied ? <><Check size={14} /> Copied</> : "Copy rules"}</button></div></section>
      <section className="panel setup-card setup-wide"><div className="step-number">04</div><h2>Paste the web config into <span className="mono">.env</span></h2><p>Copy these keys into <span className="mono">artifacts/shop-bridge/.env</span>, then restart the dev server. The app detects the config on startup and signs the browser in anonymously before opening the business-scoped listener.</p><div className="env-block"><pre>{envText}</pre><button className="copy-button" onClick={copy} data-testid="button-copy-env">{copied ? <><Check size={14} /> Copied</> : "Copy keys"}</button></div></section>
      <section className="panel setup-card setup-wide"><div className="step-number">05</div><h2>Verify the live lane on two devices</h2><p>Open the same URL in two separate browsers or devices. Sign in with the same business ID, choose Shop 1 on one and Shop 2 on the other, then run this handoff: send a request → confirm it → acknowledge delivery. Each status should appear on the other device without a refresh. If either device shows an access error, check that Anonymous sign-in is enabled and the rules are published.</p><div className="verification-list"><span><Check size={14} /> Shop 1 request appears in Shop 2</span><span><Check size={14} /> Confirmation appears in Shop 1</span><span><Check size={14} /> Delivery acknowledgement completes both views</span></div></section>
    </div>
    <div className={`demo-callout ${firebaseConfigured ? "live-callout" : ""}`}><div className="demo-callout-icon"><Signal size={19} /></div><div>{firebaseConfigured ? <><strong>Live configuration detected</strong><p>Anonymous sign-in will run automatically after the business ID is entered. Use the two-device checklist above before sharing the URL.</p></> : <><strong>Working in demo mode right now</strong><p>Requests and inventory changes are stored locally for the selected business ID. Connect Firebase, enable Anonymous sign-in, and publish the rules when both shop teams are ready to share a live lane.</p></>}</div><Link href="/shop1" className="button button-secondary" data-testid="link-return-demo">{firebaseConfigured ? "Open live workspace" : "Return to workspace"}</Link></div>
  </div></AppShell>;
}

function LoginPage({ onLogin }: { onLogin: (session: ShopSession) => void }) {
  const [role, setRole] = useState<ShopRole>("shop1");
  const [username, setUsername] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanUsername = username.trim();
    const cleanBusinessId = businessId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!cleanUsername || !cleanBusinessId) {
      setError("Enter your name and the business ID shared by both shops.");
      return;
    }
    const session = { username: cleanUsername, businessId: cleanBusinessId, role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    onLogin(session);
  }

  return <div className="login-screen">
    <div className="login-card">
      <div className="login-brand"><span className="brand-mark"><Leaf size={22} strokeWidth={2.5} /></span><span><strong>Steep</strong><em>bridge</em></span></div>
      <p className="eyebrow">Two-shop sign in</p>
      <h1>Open your shared shelf.</h1>
      <p className="login-copy">Use the same business ID on both devices. Shop 1 and Shop 2 will only see each other when that ID matches.</p>
      <form onSubmit={submit} className="login-form">
        <label>Your name<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. Arun" autoComplete="name" data-testid="input-login-username" /></label>
        <label>Business ID<input value={businessId} onChange={(event) => setBusinessId(event.target.value)} placeholder="e.g. sunrise-tea-01" autoCapitalize="none" data-testid="input-login-business-id" /><small>Give the exact same ID to both shops.</small></label>
        <fieldset>
          <legend>Which shop are you using?</legend>
          <div className="role-grid">
            <label className={`role-option ${role === "shop1" ? "role-option-active" : ""}`}><input type="radio" name="shop-role" value="shop1" checked={role === "shop1"} onChange={() => setRole("shop1")} /><span><strong>Shop 1</strong><small>Send requests and manage one-unit changes</small></span></label>
            <label className={`role-option ${role === "shop2" ? "role-option-active" : ""}`}><input type="radio" name="shop-role" value="shop2" checked={role === "shop2"} onChange={() => setRole("shop2")} /><span><strong>Shop 2</strong><small>Confirm requests and manage stock</small></span></label>
          </div>
        </fieldset>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="button button-primary login-submit" type="submit" data-testid="button-login"><UserRound size={18} /> Enter shared workspace <ArrowRight size={16} /></button>
      </form>
      <p className="login-footnote"><span className="tiny-dot" /> Only two roles are available for each business ID.</p>
    </div>
  </div>;
}

function App() {
  const [session, setSession] = useState<ShopSession | null>(() => readSession());
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }
  if (!session) {
    return <Switch><Route path="/login"><LoginPage onLogin={setSession} /></Route><Route><Redirect to="/login" /></Route></Switch>;
  }
  return <Switch>
    <Route path="/shop1"><ShopOne session={session} onLogout={logout} /></Route>
    <Route path="/shop2"><ShopTwo session={session} onLogout={logout} /></Route>
    <Route path="/setup"><Setup session={session} onLogout={logout} /></Route>
    <Route path="/login"><Redirect to="/shop1" /></Route>
    <Route path="/"><Redirect to={session.role === "shop2" ? "/shop2" : "/shop1"} /></Route>
    <Route><Redirect to={session.role === "shop2" ? "/shop2" : "/shop1"} /></Route>
  </Switch>;
}

export default App;