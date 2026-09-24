import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  FileClock,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Leaf,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingBasket,
  Signal,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useShopData } from "@/hooks/use-shop-data";
import { useTamilAlerts } from "@/hooks/use-tamil-alerts";
import { apiUrl } from "@/lib/api";
import databaseRules from "@/lib/firebase.database.rules.json";
import {
  ensureLiveAccess,
  firebaseConfigured,
  registerPresence,
  watchPresence,
  type CatalogItem,
  type InventoryItem,
  type Order,
  type OrderLineItem,
  type OrderStatus,
  type ShopRole,
} from "@/lib/firebase";

type ShopSession = {
  username: string;
  businessId: string;
  role: ShopRole;
};

const SESSION_KEY = "shop-bridge-session";
const roleLabels = {
  shop1: "Mayura(new)",
  shop2: "Mayura2(old)",
  owner: "Owner",
} as const;

function readSession(): ShopSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as ShopSession;
    return session.username &&
      session.businessId &&
      (session.role === "shop1" ||
        session.role === "shop2" ||
        session.role === "owner")
      ? session
      : null;
  } catch {
    return null;
  }
}

function initials(username: string) {
  return (
    username
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SH"
  );
}

function useShopPresence(session: ShopSession) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  useEffect(() => {
    if (!firebaseConfigured || session.role === "owner") {
      setPartnerOnline(false);
      return;
    }
    let active = true;
    let stopWatching: (() => void) | undefined;
    void ensureLiveAccess()
      .then(() => {
        if (!active) return;
        void registerPresence(session.businessId, {
          role: session.role,
          username: session.username,
          lastSeen: Date.now(),
        }).catch(() => undefined);
        stopWatching = watchPresence(session.businessId, (presence) => {
          const partner = session.role === "shop1" ? "shop2" : "shop1";
          setPartnerOnline(Boolean(presence[partner]));
        });
      })
      .catch(() => setPartnerOnline(false));
    return () => {
      active = false;
      stopWatching?.();
    };
  }, [session.businessId, session.role, session.username]);
  return partnerOnline;
}

const navItems = [
  { href: "/shop1", label: `${roleLabels.shop1} · Send`, icon: ShoppingBasket },
  { href: "/shop1/history", label: "History", icon: History },
  {
    href: "/shop2",
    label: `${roleLabels.shop2} · Receive`,
    icon: PackageCheck,
  },
  { href: "/shop2/history", label: "History", icon: History },
];

const timeFormatter = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const historyDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatTime(timestamp?: number) {
  return timestamp ? timeFormatter.format(timestamp) : "—";
}

function formatDate(timestamp?: number) {
  return timestamp ? dateFormatter.format(timestamp) : "—";
}

function formatHistoryDate(timestamp?: number) {
  return timestamp ? historyDateFormatter.format(timestamp) : "—";
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

function isTeaItem(item: CatalogItem) {
  return item.category?.trim().toLowerCase() === "tea";
}

function AppShell({
  children,
  session,
  onLogout,
  lowStockAlerts = [],
}: {
  children: ReactNode;
  session: ShopSession;
  onLogout: () => void;
  lowStockAlerts?: CatalogItem[];
}) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const partnerOnline = useShopPresence(session);
  const partnerLabel =
    session.role === "shop1" ? roleLabels.shop2 : roleLabels.shop1;
  const visibleNavItems =
    session.role === "owner"
      ? [
          { href: "/owner", label: "Owner dashboard", icon: Signal },
          { href: "/security", label: "Security", icon: KeyRound },
        ]
      : navItems.filter((item) => item.href.startsWith(`/${session.role}`));
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Link
            href={`/${session.role}`}
            className="brand"
            data-testid="link-brand"
            onClick={() => setMobileOpen(false)}
          >
            <span className="brand-mark">
              <Leaf size={20} strokeWidth={2.5} />
            </span>
            <span>
              <strong>Mayura</strong>
            </span>
          </Link>
          <button
            className="icon-button sidebar-close"
            aria-label="Close menu"
            data-testid="button-close-menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-context">
          <span className="context-dot" />
          <span>Two shops, one rhythm</span>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          <p className="eyebrow nav-heading">Workspace</p>
          {visibleNavItems.map((item) => {
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
        <div className="sidebar-footer">
          <button
            className="nav-item sidebar-logout"
            onClick={onLogout}
            aria-label="Log out"
            data-testid="button-sidebar-logout"
          >
            <LogOut size={19} />
            <span>Log out</span>
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          data-testid="button-close-scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button menu-trigger"
            aria-label="Open menu"
            data-testid="button-open-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="topbar-location">
            <span className="live-pulse" /> Shared handoff desk{" "}
            <span className="slash">/</span>{" "}
            {location === "/shop2"
              ? roleLabels.shop2
              : location === "/owner"
                ? roleLabels.owner
                : roleLabels.shop1}
          </div>
          <div className="topbar-right">
            <span
              className={`connection-pill ${partnerOnline ? "connection-online" : ""}`}
            >
              <span className="context-dot" />
              {partnerOnline
                ? `${partnerLabel} connected`
                : `Waiting for ${partnerLabel}`}
            </span>
            <span className="topbar-date">
              {new Intl.DateTimeFormat("en", {
                weekday: "short",
                month: "short",
                day: "numeric",
              }).format(new Date())}
            </span>
            {session.role === "shop2" && (
              <button
                className="header-notification"
                onClick={() => {
                  const firstAlert = lowStockAlerts[0];
                  if (firstAlert) {
                    setLocation(`/shop2/restock?item=${encodeURIComponent(firstAlert.name)}`);
                  }
                }}
                aria-label={lowStockAlerts.length > 0 ? `Open ${lowStockAlerts.length} low-stock notification${lowStockAlerts.length === 1 ? "" : "s"}` : "No low-stock notifications"}
                title={lowStockAlerts.length > 0 ? "Low-stock notifications" : "No low-stock notifications"}
              >
                <Bell size={18} />
                <b className="header-alert-count">{lowStockAlerts.length}</b>
              </button>
            )}
            <div className="avatar">{initials(session.username)}</div>
            <button
              className="logout-button"
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function DataState({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  if (loading)
    return (
      <div className="data-state loading-state">
        <span className="loading-bar" />
        <span className="loading-bar loading-bar-short" /> Loading the shared
        shelf…
      </div>
    );
  if (error)
    return (
      <div className="data-state error-state">
        <AlertTriangle size={16} />
        <span>{error}</span>
      </div>
    );
  return null;
}

function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
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

function StatChip({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={`stat-chip stat-${tone}`}>
      <Icon size={16} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const copy = {
    pending: "Needs confirmation",
    confirmed: "On the way",
    completed: "Received",
  };
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {copy[status]}
    </span>
  );
}

function OrderTimeline({ order }: { order: Order }) {
  return (
    <div className="timeline" data-testid={`status-timeline-${order.id}`}>
      <div className="timeline-step step-done">
        <span>
          <Check size={12} />
        </span>
        <small>Requested</small>
        <b>{formatTime(order.timeRequested)}</b>
      </div>
      <div
        className={`timeline-line ${order.status === "confirmed" || order.status === "completed" ? "line-done" : ""}`}
      />
      <div
        className={`timeline-step ${order.status === "confirmed" || order.status === "completed" ? "step-done" : ""}`}
      >
        <span>
          <Check size={12} />
        </span>
        <small>Confirmed</small>
        <b>{formatTime(order.timeConfirmed)}</b>
      </div>
      <div
        className={`timeline-line ${order.status === "completed" ? "line-done" : ""}`}
      />
      <div
        className={`timeline-step ${order.status === "completed" ? "step-done" : ""}`}
      >
        <span>
          <Check size={12} />
        </span>
        <small>Received</small>
        <b>{formatTime(order.timeAcknowledged)}</b>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  action,
  actionLabel,
  actionIcon,
  accent = false,
}: {
  order: Order;
  action?: () => void;
  actionLabel?: string;
  actionIcon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <article
      className={`order-card ${accent ? "order-card-attention" : ""}`}
      data-testid={`card-order-${order.id}`}
    >
      <div className="order-card-top">
        <div className="order-title">
          <span className="tea-swatch">
            <Leaf size={15} />
          </span>
          <div>
            <h3>
              {order.items?.length
                ? `${order.items.length} items`
                : order.itemName}
            </h3>
            <p>
              {order.quantity} units · {relativeTime(order.timeRequested)}
            </p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>
      {order.items?.length ? (
        <div className="order-lines">
          {order.items.map((item) => (
            <div key={item.itemId}>
              <span>
                {item.quantity}x {item.itemName}
              </span>
              <span>₹{item.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <strong>Total ₹{(order.total ?? 0).toFixed(2)}</strong>
        </div>
      ) : null}
      <OrderTimeline order={order} />
      {action && actionLabel && (
        <button
          className={`button ${accent ? "button-primary" : "button-secondary"} wide-action`}
          onClick={action}
          data-testid={`button-${actionLabel.toLowerCase().replaceAll(" ", "-")}-${order.id}`}
        >
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </article>
  );
}

function OwnerDashboard({
  session,
  onLogout,
}: {
  session: ShopSession;
  onLogout: () => void;
}) {
  const data = useShopData(session.businessId);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [collapsedRequestIds, setCollapsedRequestIds] = useState<Set<string>>(new Set());
  const today = new Date().toDateString();
  const todayOrders = data.orders.filter(
    (order) => new Date(order.timeRequested).toDateString() === today,
  );
  const total = todayOrders.reduce((sum, order) => sum + (order.total ?? 0), 0);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Order[]>();
    for (const order of [...data.orders].sort(
      (a, b) => b.timeRequested - a.timeRequested,
    )) {
      const key = new Date(order.timeRequested).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), order]);
    }

    return [...groups.entries()].map(([dateKey, orders]) => {
      const requesterCounts = orders.reduce<Record<string, number>>((counts, order) => {
        const requester = order.requesterName?.trim() || roleLabels.shop1;
        counts[requester] = (counts[requester] ?? 0) + 1;
        return counts;
      }, {});
      const topRequester = Object.entries(requesterCounts).sort(
        ([, countA], [, countB]) => countB - countA,
      )[0];
      return {
        dateKey,
        dateLabel: formatHistoryDate(orders[0].timeRequested),
        orders,
        total: orders.reduce((sum, order) => sum + (order.total ?? 0), 0),
        topRequester: topRequester
          ? { name: topRequester[0], count: topRequester[1] }
          : { name: roleLabels.shop1, count: 0 },
      };
    });
  }, [data.orders]);

  const selectedDay = groupedByDate.find((entry) => entry.dateKey === selectedDateKey);

  return (
    <AppShell session={session} onLogout={onLogout}>
      <DataState loading={data.loading} error={data.error} />
      <PageIntro
        eyebrow="Owner dashboard"
        title="Know what moved today."
        description={`Review requests, daily spend, and the catalog that ${roleLabels.shop1} uses.`}
      />
      <div className="stats-strip">
        <StatChip
          icon={Bell}
          label="Requests today"
          value={`${todayOrders.length}`}
          tone="neutral"
        />
        <StatChip
          icon={PackageCheck}
          label="Units today"
          value={`${todayOrders.reduce((sum, order) => sum + order.quantity, 0)}`}
          tone="green"
        />
        <StatChip
          icon={RefreshCw}
          label="Daily total"
          value={`₹${total.toFixed(2)}`}
          tone="warm"
        />
      </div>
      <section className="panel owner-daily-history">
          <SectionHeading
            eyebrow="Daily history"
            title="Requests by date"
            count={groupedByDate.length}
          />
          {groupedByDate.length === 0 ? (
            <div className="empty-state compact-empty">
              <FileClock size={25} />
              <p>No order history yet.</p>
            </div>
          ) : (
            <>
              <div className="owner-order-history">
                {groupedByDate.map((day) => {
                  const isSelected = selectedDay?.dateKey === day.dateKey;
                  return (
                    <div className={`owner-date-entry ${isSelected ? "expanded" : ""}`} key={day.dateKey}>
                      <button
                        type="button"
                        className={`owner-history-row owner-date-button ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedDateKey((current) => current === day.dateKey ? null : day.dateKey)}
                      >
                        <div>
                          <strong>{day.dateLabel}</strong>
                          <small>
                            {day.topRequester.name} · {day.topRequester.count} request{day.topRequester.count === 1 ? "" : "s"} · {day.orders.length} total
                          </small>
                        </div>
                        <strong>₹{day.total.toFixed(2)}</strong>
                        <ChevronDown
                          className={`owner-date-chevron ${isSelected ? "expanded" : ""}`}
                          size={17}
                          aria-hidden="true"
                        />
                      </button>
                      {isSelected && (
                        <div className="owner-selected-day">
                          <div className="owner-request-list">
                            {day.orders.map((order) => {
                      const items = order.items && order.items.length > 0
                        ? order.items
                        : [{
                            itemId: `${order.id}-single`,
                            itemName: order.itemName,
                            quantity: order.quantity,
                            unitPrice: order.total && order.quantity ? order.total / order.quantity : 0,
                            subtotal: order.total ?? 0,
                          }];
                              return (
                                <div className="owner-request-card" key={order.id}>
                          <button
                            type="button"
                            className="owner-request-heading"
                            onClick={() => setCollapsedRequestIds((current) => {
                              const next = new Set(current);
                              if (next.has(order.id)) next.delete(order.id);
                              else next.add(order.id);
                              return next;
                            })}
                            aria-expanded={!collapsedRequestIds.has(order.id)}
                          >
                            <div>
                              <strong className={order.requesterName ? "requester-name" : ""}>{order.requesterName ?? roleLabels.shop1}</strong>
                              <small>{formatDate(order.timeRequested)}</small>
                            </div>
                            <strong>₹{(order.total ?? 0).toFixed(2)}</strong>
                            <ChevronDown
                              className={`owner-request-chevron ${collapsedRequestIds.has(order.id) ? "collapsed" : ""}`}
                              size={16}
                              aria-hidden="true"
                            />
                          </button>
                          {!collapsedRequestIds.has(order.id) && (
                            <div className="history-list">
                              {items.map((item) => (
                                <div className="history-row" key={`${order.id}-${item.itemId}`}>
                                  <span className="history-icon history-order">
                                    <Leaf size={15} />
                                  </span>
                                  <div>
                                    <strong>{item.itemName}</strong>
                                    <small>
                                      {item.quantity} units · ₹{item.unitPrice.toFixed(2)} each
                                    </small>
                                  </div>
                                  <strong>₹{item.subtotal.toFixed(2)}</strong>
                                </div>
                              ))}
                            </div>
                          )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
      </section>
    </AppShell>
  );
}

function SectionHeading({
  eyebrow,
  title,
  count,
  children,
}: {
  eyebrow?: string;
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      {
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>
            {title}{" "}
            {count !== undefined && <span className="count">{count}</span>}
          </h2>
        </div>
      }
      {children}
    </div>
  );
}

function InventoryMini({
  items,
  readOnly = false,
  editable = false,
  onAdjust,
}: {
  items: InventoryItem[];
  readOnly?: boolean;
  editable?: boolean;
  onAdjust?: (itemName: string, delta: number) => void;
}) {
  return (
    <div className="inventory-list">
      {items.map((item) => {
        const low = item.currentStock < item.lowStockThreshold;
        return (
          <div
            className="inventory-row"
            key={item.itemName}
            data-testid={`row-inventory-${item.itemName}`}
          >
            <div className="inventory-name">
              <span
                className={`inventory-mark ${low ? "inventory-mark-low" : ""}`}
              />
              <div>
                <strong>{item.itemName}</strong>
                <small>
                  {low
                    ? "Below threshold"
                    : `Restocked ${relativeTime(item.lastRestockedTime)}`}
                </small>
              </div>
            </div>
            <div className="inventory-amount">
              <strong className={low ? "low-number" : ""}>
                {item.currentStock}
              </strong>
              <span>cases</span>
            </div>
            {editable && onAdjust && (
              <div className="stock-adjusters">
                <button
                  onClick={() => onAdjust(item.itemName, -1)}
                  aria-label={`Decrease ${item.itemName} by one`}
                  title="Use one case"
                >
                  −1
                </button>
                <button
                  onClick={() => onAdjust(item.itemName, 1)}
                  aria-label={`Increase ${item.itemName} by one`}
                  title="Add one case"
                >
                  +1
                </button>
              </div>
            )}
            {readOnly && (
              <span className={`stock-state ${low ? "stock-low" : "stock-ok"}`}>
                {low ? "Low" : "Good"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryList({
  orders,
  restocks,
}: {
  orders: Order[];
  restocks: {
    itemName: string;
    restockedQuantity: number;
    timestamp: number;
  }[];
}) {
  const rows = useMemo(
    () =>
      [
        ...orders.map((order) => ({
          type: "Order",
          name: order.itemName,
          detail: `${order.quantity} cases · ${order.status === "completed" ? "received" : order.status}`,
          time:
            order.timeAcknowledged ??
            order.timeConfirmed ??
            order.timeRequested,
        })),
        ...restocks.map((entry) => ({
          type: "Restock",
          name: entry.itemName,
          detail: `+${entry.restockedQuantity} cases added`,
          time: entry.timestamp,
        })),
      ]
        .sort((a, b) => b.time - a.time)
        .slice(0, 8),
    [orders, restocks],
  );
  return (
    <div className="history-list">
      {rows.map((row, index) => (
        <div
          className="history-row"
          key={`${row.type}-${row.name}-${row.time}-${index}`}
          data-testid={`history-row-${index}`}
        >
          <span
            className={`history-icon ${row.type === "Order" ? "history-order" : "history-restock"}`}
          >
            {row.type === "Order" ? <Truck size={15} /> : <Plus size={15} />}
          </span>
          <div>
            <strong>{row.name}</strong>
            <small>
              {row.type} · {row.detail}
            </small>
          </div>
          <time>{formatDate(row.time)}</time>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="empty-state compact-empty">
          <FileClock size={25} />
          <p>No handoff history yet.</p>
        </div>
      )}
    </div>
  );
}

function ShopHistoryPage({
  session,
  onLogout,
}: {
  session: ShopSession;
  onLogout: () => void;
}) {
  const data = useShopData(session.businessId);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const recentOrders = useMemo(
    () => [...data.orders].sort((a, b) => b.timeRequested - a.timeRequested).slice(0, 8),
    [data.orders],
  );
  const recentRestocks = useMemo(
    () => [...data.restocks].sort((a, b) => b.timestamp - a.timestamp),
    [data.restocks],
  );
  return (
    <AppShell
      session={session}
      onLogout={onLogout}
      lowStockAlerts={session.role === "shop2" ? data.catalogLowStock : []}
    >
      <DataState loading={data.loading} error={data.error} />
      <PageIntro
        eyebrow={`${session.role === "shop1" ? roleLabels.shop1 : roleLabels.shop2} · History`}
        title="Shared history."
        description="Review every request, confirmation, delivery, and restock recorded for this business ID."
      />
      <section className="panel history-panel">
        <SectionHeading eyebrow="Recent activity" title="Recent requests" count={recentOrders.length} />
        {recentOrders.length === 0 ? (
          <div className="empty-state compact-empty">
            <FileClock size={25} />
            <p>No requests yet.</p>
          </div>
        ) : (
          <div className="shop-history-list">
            {recentOrders.map((order) => {
              const items = order.items && order.items.length > 0
                ? order.items
                : [{
                    itemId: `${order.id}-single`,
                    itemName: order.itemName,
                    quantity: order.quantity,
                    unitPrice: order.total && order.quantity ? order.total / order.quantity : 0,
                    subtotal: order.total ?? 0,
                  }];
              const expanded = expandedOrders.has(order.id);
              return (
                <div className={`shop-history-card ${expanded ? "expanded" : ""}`} key={order.id}>
                  <button
                    type="button"
                    className="shop-history-heading"
                    onClick={() => setExpandedOrders((current) => {
                      const next = new Set(current);
                      if (next.has(order.id)) next.delete(order.id);
                      else next.add(order.id);
                      return next;
                    })}
                    aria-expanded={expanded}
                  >
                    <span className="history-icon history-order"><Truck size={15} /></span>
                    <span className="shop-history-summary">
                      <strong>{order.requesterName ?? roleLabels.shop1}</strong>
                      <small>{formatDate(order.timeRequested)}</small>
                    </span>
                    <strong className="shop-history-quantity">
                      {items.reduce((sum, item) => sum + item.quantity, 0)} units
                    </strong>
                    <strong className="shop-history-total">₹{(order.total ?? 0).toFixed(2)}</strong>
                    <ChevronDown className={`shop-history-chevron ${expanded ? "expanded" : ""}`} size={16} />
                  </button>
                  {expanded && (
                    <div className="shop-history-items">
                      {items.map((item) => (
                        <div className="history-row" key={`${order.id}-${item.itemId}`}>
                          <div>
                            <strong>{item.itemName}</strong>
                            <small>{item.quantity} units · ₹{item.unitPrice.toFixed(2)} each</small>
                          </div>
                          <strong>₹{item.subtotal.toFixed(2)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section className="panel history-panel restock-history-panel">
        <SectionHeading eyebrow="Inventory activity" title="Restock history" count={recentRestocks.length} />
        {recentRestocks.length === 0 ? (
          <div className="empty-state compact-empty">
            <FileClock size={25} />
            <p>No restock history yet.</p>
          </div>
        ) : (
          <div className="history-list">
            {recentRestocks.map((restock) => (
              <div className="history-row restock-history-row" key={restock.id}>
                <span className="history-icon restock-history-confirmed"><Check size={15} /></span>
                <div>
                  <strong>{restock.itemName}</strong>
                  <small>
                    +{restock.restockedQuantity} units · {formatDate(restock.timestamp)}
                    {restock.acknowledgedAt ? ` · acknowledged by ${restock.acknowledgedBy ?? roleLabels.shop1}` : " · awaiting delivery acknowledgment"}
                  </small>
                </div>
                {!restock.acknowledgedAt && session.role === "shop1" ? (
                  <button
                    type="button"
                    className="small-action"
                    onClick={() => void data.confirmRestock(restock.id, session.username)}
                  >
                    Acknowledge
                  </button>
                ) : !restock.acknowledgedAt ? (
                  <span className="restock-history-status">Pending</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function CatalogManager({
  items,
  onSave,
  onRemove,
}: {
  items: CatalogItem[];
  onSave: (item: CatalogItem) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CatalogItem>({
    id: "",
    name: "",
    price: 0,
    category: "Tea",
    stock: 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const teaCategory = draft.category?.trim().toLowerCase() === "tea";
  const groupedItems = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const category = item.category?.trim() || "Uncategorized";
      groups.set(category, [...(groups.get(category) ?? []), item]);
    }
    return [...groups.entries()];
  }, [items]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || draft.price < 0) return;
    await onSave({
      ...draft,
      id:
        editingId ??
        `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: draft.name.trim(),
      category: draft.category?.trim() || undefined,
    });
    setDraft({ id: "", name: "", price: 0, category: "Tea", stock: 0 });
    setEditingId(null);
  }
  return (
    <>
      <section className="panel catalog-panel catalog-add-panel">
        <p className="eyebrow">Owner controls</p>
        <SectionHeading title="Add item" />
        <form className="catalog-form" onSubmit={submit}>
        <label>
          Name
          <input
            placeholder="Item name"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            aria-label="Item name"
          />
        </label>
        <label>
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={draft.price}
            onChange={(event) =>
              setDraft({ ...draft, price: Number(event.target.value) })
            }
            aria-label="Item price"
          />
        </label>
        {!teaCategory && (
          <label>
            Stock count
            <input
              type="number"
              min="0"
              placeholder="0"
              value={draft.stock}
              onChange={(event) =>
                setDraft({ ...draft, stock: Number(event.target.value) })
              }
              aria-label="Item stock"
            />
          </label>
        )}
        <label>
          Category
          <input
            placeholder="e.g. Tea"
            value={draft.category ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value })
            }
            aria-label="Item category"
          />
        </label>
        <button className="button button-primary" type="submit">
          {editingId ? "Save item" : "Add item"}
        </button>
        </form>
      </section>
      <section className="panel catalog-panel catalog-pricing-panel">
        <div className="catalog-list">
        <SectionHeading
          eyebrow=""
          title="Items & pricing"
          count={items.length}
        />
        <div className="catalog-category-list">
          {groupedItems.map(([category, categoryItems]) => {
            const expanded = expandedCategories.has(category);
            return (
              <div className={`catalog-category ${expanded ? "expanded" : ""}`} key={category}>
                <button
                  type="button"
                  className="catalog-category-button"
                  onClick={() => setExpandedCategories((current) => {
                    const next = new Set(current);
                    if (next.has(category)) next.delete(category);
                    else next.add(category);
                    return next;
                  })}
                  aria-expanded={expanded}
                >
                  <strong>{category}</strong>
                  <small>{categoryItems.length} item{categoryItems.length === 1 ? "" : "s"}</small>
                  <ChevronDown className={expanded ? "expanded" : ""} size={16} />
                </button>
                {expanded && categoryItems.map((item) => (
                  <div
                    className={`catalog-row ${!isTeaItem(item) && item.stock === 0 ? "catalog-row-out" : ""}`}
                    key={item.id}
                  >
                    <div className="catalog-item-info">
                      <strong>{item.name}</strong>
                      {!isTeaItem(item) && (
                        <div className="catalog-stock-control">
                          <button className="stock-stepper" onClick={() => void onSave({ ...item, stock: Math.max(0, item.stock - 1) })} aria-label={`Decrease ${item.name} stock`}>−</button>
                          <strong>{item.stock}</strong>
                          <button className="stock-stepper" onClick={() => void onSave({ ...item, stock: item.stock + 1 })} aria-label={`Increase ${item.name} stock`}>+</button>
                        </div>
                      )}
                    </div>
                    {!isTeaItem(item) && (
                      <span className={`catalog-status ${item.stock === 0 ? "catalog-status-out" : "catalog-status-available"}`}>
                        {item.stock === 0 ? "Out of stock" : "In stock"}
                      </span>
                    )}
                    <span>₹{item.price.toFixed(2)}</span>
                    <button className="small-action" onClick={() => { setEditingId(item.id); setDraft(item); }}>Edit</button>
                    <button className="small-action" onClick={() => void onRemove(item.id)} aria-label={`Remove ${item.name}`}>Remove</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        </div>
      </section>
    </>
  );
}

function ShopOne({
  session,
  onLogout,
}: {
  session: ShopSession;
  onLogout: () => void;
}) {
  const data = useShopData(session.businessId);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [cart, setCart] = useState<OrderLineItem[]>([]);
  const [sent, setSent] = useState(false);
  const pending = data.orders.filter((order) => order.status !== "completed");
  const awaitingReceipt = data.orders.filter(
    (order) => order.status === "confirmed",
  );
  const pendingRestocks = useMemo(
    () => [...data.restocks]
      .filter((restock) => !restock.acknowledgedAt)
      .sort((a, b) => b.timestamp - a.timestamp),
    [data.restocks],
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (awaitingReceipt.length === 0) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [awaitingReceipt.length]);

  useEffect(() => {
    const timers = awaitingReceipt.map((order) => {
      const deadline = (order.timeConfirmed ?? Date.now()) + 5 * 60 * 1000;
      return window.setTimeout(
        () => void data.markReminderNeeded(order.id),
        Math.max(0, deadline - Date.now()),
      );
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [
    awaitingReceipt
      .map((order) => `${order.id}:${order.reminderNeeded}`)
      .join(","),
    data.markReminderNeeded,
  ]);

  const countdown = awaitingReceipt[0]?.timeConfirmed
    ? Math.max(0, awaitingReceipt[0].timeConfirmed + 5 * 60 * 1000 - now)
    : 0;
  const countdownMinutes = Math.floor(countdown / 60000)
    .toString()
    .padStart(2, "0");
  const countdownSeconds = Math.floor((countdown % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    if (!cart.length) return;
    await data.createOrder(cart, session.username);
    setCart([]);
    setSent(true);
    window.setTimeout(() => setSent(false), 3500);
  }

  const selectedItem =
    data.catalog.find((item) => item.id === itemId && item.stock <= 3) ?? 
    data.catalog.find((item) => item.stock <= 3);
  const catalogGroups = useMemo(
    () =>
      data.catalog
        .filter((item) => item.stock <= 3)
        .reduce<Record<string, CatalogItem[]>>((groups, item) => {
          const category = item.category?.trim() || "Uncategorized";
          const key =
            Object.keys(groups).find(
              (existing) => existing.toLowerCase() === category.toLowerCase(),
            ) ?? category;
          (groups[key] ??= []).push(item);
          return groups;
        }, {}),
    [data.catalog],
  );
  function addToCart() {
    if (!selectedItem) return;
    const count = Math.max(1, Number(quantity));
    setCart((current) =>
      current.some((item) => item.itemId === selectedItem.id)
        ? current.map((item) =>
            item.itemId === selectedItem.id
              ? {
                  ...item,
                  quantity: item.quantity + count,
                  subtotal: (item.quantity + count) * item.unitPrice,
                }
              : item,
          )
        : [
            ...current,
            {
              itemId: selectedItem.id,
              itemName: selectedItem.name,
              quantity: count,
              unitPrice: selectedItem.price,
              subtotal: count * selectedItem.price,
              category: selectedItem.category,
            },
          ],
    );
  }

  return (
    <AppShell session={session} onLogout={onLogout}>
      <DataState loading={data.loading} error={data.error} />
      <PageIntro
        eyebrow={`${roleLabels.shop1} · Sending desk`}
        title="Keep the shelf moving."
        description={`Send a clear request to ${roleLabels.shop2}. You will see every handoff, from tap to arrival.`}
      />
      <div className="stats-strip">
        <StatChip
          icon={Bell}
          label="Open requests"
          value={`${pending.length}`}
          tone={pending.length ? "warm" : "neutral"}
        />
        <StatChip
          icon={Truck}
          label="On the way"
          value={`${awaitingReceipt.length}`}
          tone="green"
        />
        <StatChip
          icon={RefreshCw}
          label="Last sync"
          value={relativeTime(data.lastUpdated)}
        />
      </div>
      <div className="dashboard-grid sender-grid">
        <section className="panel request-panel">
          <div className="panel-accent" />
          <p className="eyebrow">New handoff</p>
          <h2>What do you need across the lane?</h2>
          <p className="panel-copy">
            One request, one shared view. {roleLabels.shop2} will see it
            immediately.
          </p>
          <form onSubmit={submitOrder} className="request-form">
            <label>
              Item
              <select
                value={itemId || data.catalog[0]?.id || ""}
                onChange={(event) => setItemId(event.target.value)}
                data-testid="select-order-item"
              >
                {Object.entries(catalogGroups).map(([category, items]) => (
                  <optgroup label={category} key={category}>
                    {items.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={!isTeaItem(item) && item.stock === 0}
                      >
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              Quantity <span className="label-hint">units</span>
              <div className="quantity-input">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(String(Math.max(1, Number(quantity) - 1)))
                  }
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(String(Math.min(99, Number(quantity) + 1)))
                  }
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </label>
            <button
              className="button button-secondary send-button"
              type="button"
              onClick={addToCart}
            >
              Add to request
            </button>
            {cart.length > 0 && (
              <div className="cart-list">
                {cart.map((item) => (
                  <div className="cart-row" key={item.itemId}>
                    <span>
                      {item.quantity}x {item.itemName}
                    </span>
                    <small>
                      ₹{item.unitPrice.toFixed(2)} · ₹{item.subtotal.toFixed(2)}
                    </small>
                    <button
                      type="button"
                      onClick={() =>
                        setCart((current) =>
                          current.filter(
                            (entry) => entry.itemId !== item.itemId,
                          ),
                        )
                      }
                      aria-label={`Remove ${item.itemName}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <strong className="cart-total">
                  Total ₹
                  {cart
                    .reduce((sum, item) => sum + item.subtotal, 0)
                    .toFixed(2)}
                </strong>
                <button
                  className="button button-primary send-button"
                  type="submit"
                  data-testid="button-send-order"
                >
                  <span>
                    {sent ? (
                      <CheckCircle2 size={19} />
                    ) : (
                      <ArrowRight size={19} />
                    )}
                  </span>
                  {sent ? "Request sent" : "Send request"}
                </button>
              </div>
            )}
          </form>
        </section>
        <section className="panel signal-panel">
          <div className="signal-header">
            <div>
              <p className="eyebrow">Right now</p>
              <h2>Delivery status</h2>
            </div>
            <span className="signal-live">
              <span className="live-pulse" /> live
            </span>
          </div>
          {pending.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={28} />
              <strong>Nothing waiting on you</strong>
              <p>New requests will show up here.</p>
            </div>
          ) : (
            <div className="signal-list">
              {pending.slice(0, 3).map((order) => (
                <div className="signal-row" key={order.id}>
                  <span
                    className={`signal-index ${order.status === "confirmed" ? "signal-index-confirmed" : ""}`}
                  >
                    {order.status === "confirmed" ? <Check size={14} /> : "!"}
                  </span>
                  <div>
                    <strong>{order.itemName}</strong>
                    <span>
                      {order.quantity} cases ·{" "}
                      {order.status === "confirmed"
                        ? "ready to receive"
                        : "waiting for confirmation"}
                    </span>
                  </div>
                  {order.status === "confirmed" ? (
                    <button
                      className="small-action signal-acknowledge"
                      onClick={() => void data.acknowledgeOrder(order.id)}
                    >
                      <Check size={14} /> Acknowledge
                    </button>
                  ) : (
                    <StatusBadge status={order.status} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="panel signal-panel restock-ack-panel">
        <div className="signal-header">
          <div>
            <p className="eyebrow">Right now</p>
            <h2>Restock delivery</h2>
          </div>
          <span className="signal-live">
            <span className="live-pulse" /> live
          </span>
        </div>
        {pendingRestocks.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={28} />
            <strong>All restocks acknowledged</strong>
            <p>New restocks will show up here.</p>
          </div>
        ) : (
          <div className="signal-list">
            {pendingRestocks.slice(0, 3).map((restock) => (
              <div className="signal-row" key={restock.id}>
                <span className="signal-index"><PackageCheck size={14} /></span>
                <div>
                  <strong>{restock.itemName} restocked</strong>
                  <span>+{restock.restockedQuantity} units · {relativeTime(restock.timestamp)}</span>
                </div>
                <button
                  type="button"
                  className="small-action signal-acknowledge"
                  onClick={() => void data.confirmRestock(restock.id, session.username)}
                >
                  <Check size={14} /> Acknowledge
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <CatalogManager
        items={data.catalog}
        onSave={data.saveCatalogItem}
        onRemove={data.removeCatalogItem}
      />
      {awaitingReceipt.length > 0 && (
        <div className="countdown-card">
          <div>
            <p className="eyebrow">Arrival window</p>
            <strong>{awaitingReceipt[0].itemName} is on the way</strong>
            <span>
              Acknowledge within five minutes so {roleLabels.shop2} knows it
              arrived.
            </span>
          </div>
          <time>
            {countdownMinutes}:{countdownSeconds}
          </time>
        </div>
      )}
    </AppShell>
  );
}

function RestockPage({
  session,
  onLogout,
}: {
  session: ShopSession;
  onLogout: () => void;
}) {
  const data = useShopData(session.businessId);
  const [, setLocation] = useLocation();
  const requestedItem = new URLSearchParams(window.location.search).get("item");
  const lowStockItems = data.catalogLowStock;
  const [itemName, setItemName] = useState(requestedItem ?? lowStockItems[0]?.name ?? "");
  const [amount, setAmount] = useState("6");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!itemName && lowStockItems[0]) setItemName(lowStockItems[0].name);
  }, [itemName, lowStockItems]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(amount);
    if (!itemName) {
      setError("Choose an item to restock.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      setError("Enter a whole number from 1 to 99.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await data.restock(itemName, quantity);
      setLocation("/shop2");
    } catch {
      setError("Could not save the restock. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      session={session}
      onLogout={onLogout}
      lowStockAlerts={data.catalogLowStock}
    >
      <DataState loading={data.loading} error={data.error} />
      <PageIntro
        eyebrow="Inventory movement"
        title="Restock the shelf."
        description="Choose the item that needs attention, enter the incoming amount, and keep the shared count current."
      />
      <section className="panel restock-page-panel">
        <div className="panel-accent" />
        <form className="restock-form" onSubmit={submit}>
          <label>
            Item to restock
            <select value={itemName} onChange={(event) => setItemName(event.target.value)}>
              {lowStockItems.length === 0 ? (
                <option value="">No low-stock items</option>
              ) : (
                lowStockItems.map((item) => (
                  <option value={item.name} key={item.id}>{item.name} ({item.stock} left)</option>
                ))
              )}
            </select>
          </label>
          <label>
            Amount to restock
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
              data-testid="input-restock-quantity"
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={() => setLocation("/shop2")}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={saving || !itemName} data-testid="button-save-restock">
              {saving ? "Saving..." : "Restock"}
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}

function RestockModal({
  item,
  onClose,
  onRestock,
}: {
  item: InventoryItem;
  onClose: () => void;
  onRestock: (quantity: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("6");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await onRestock(Number(amount));
    setSaving(false);
    onClose();
  }
  return (
    <div className="modal-scrim" role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restock-title"
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          aria-label="Close restock dialog"
          data-testid="button-close-restock"
        >
          <X size={19} />
        </button>
        <p className="eyebrow">Inventory movement</p>
        <h2 id="restock-title">Restock {item.itemName}</h2>
        <p className="modal-copy">Add cases to the shared shelf count.</p>
        <form onSubmit={submit}>
          <label>
            Cases added
            <input
              type="number"
              min="1"
              max="99"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
              data-testid="input-restock-quantity"
            />
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              data-testid="button-cancel-restock"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={saving}
              data-testid="button-save-restock"
            >
              {saving ? "Saving…" : "Log restock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShopTwo({
  session,
  onLogout,
}: {
  session: ShopSession;
  onLogout: () => void;
}) {
  const data = useShopData(session.businessId);
  const pending = data.orders.filter((order) => order.status === "pending");
  const confirmed = data.orders.filter((order) => order.status === "confirmed");
  const reminderOrders = data.orders.filter(
    (order) => order.status === "confirmed" && order.reminderNeeded,
  );
  const alerts = useTamilAlerts({
    pendingOrders: pending,
    reminderOrders,
    lowStock: data.lowStock,
  });

  return (
    <AppShell
      session={session}
      onLogout={onLogout}
      lowStockAlerts={data.catalogLowStock}
    >
      <DataState loading={data.loading} error={data.error} />
      <PageIntro
        eyebrow={`${roleLabels.shop2} · Receiving desk`}
        title="Keep the promise visible."
        description={`Confirm what ${roleLabels.shop1} can send, keep shelf counts honest, and leave the next shift a clean signal.`}
      >
        <button
          className={`button ${alerts.enabled ? "button-secondary" : "button-primary"}`}
          onClick={alerts.enable}
          data-testid="button-enable-sound"
        >
          {alerts.enabled ? "Sound alerts on" : "Enable sound alerts"}
        </button>
      </PageIntro>
      <div className="stats-strip">
        <StatChip
          icon={Bell}
          label="Needs your eye"
          value={`${pending.length}`}
          tone={pending.length ? "warm" : "neutral"}
        />
        <StatChip
          icon={PackageCheck}
          label="Confirmed today"
          value={`${confirmed.length}`}
          tone="green"
        />
      </div>
      <div className="content-grid receiver-grid">
        <section className="panel pending-panel">
          <SectionHeading
            eyebrow="Action queue"
            title="Requests to confirm"
            count={pending.length}
          />
          <div className="order-stack">
            {pending.length === 0 ? (
              <div className="empty-state roomy-empty">
                <CheckCircle2 size={32} />
                <strong>Queue is clear</strong>
                <p>New requests from {roleLabels.shop1} will land here live.</p>
              </div>
            ) : (
              pending.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  accent
                  action={() => data.confirmOrder(order.id)}
                  actionLabel="Confirm request"
                  actionIcon={<Check size={17} />}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Setup({
  session,
  onLogout,
}: {
  session: ShopSession;
  onLogout: () => void;
}) {
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
  return (
    <AppShell session={session} onLogout={onLogout}>
      <div className="setup-page">
        <div className="setup-hero">
          <div className="setup-mark">
            <Database size={26} />
          </div>
          <p className="eyebrow">Connection setup</p>
          <h1>One shared source of truth.</h1>
          <p>
            Mayura uses Firebase Realtime Database so both shops see the
            same request the moment it is made. No refresh, no radioing across
            the lane.
          </p>
        </div>
        <div className="setup-grid">
          <section className="panel setup-card">
            <div className="step-number">01</div>
            <h2>Create a Firebase project</h2>
            <p>
              In the Firebase console, create a project and add a Web app. Then
              open Authentication → Sign-in method and enable{" "}
              <strong>Anonymous</strong>. The app signs each browser into a
              temporary Firebase account before it reads or writes the shared
              lane. Your business ID still selects which workspace the two shops
              use.
            </p>
            <a
              className="text-link"
              href="https://console.firebase.google.com/"
              target="_blank"
              rel="noreferrer"
              data-testid="link-firebase-console"
            >
              Open Firebase Console <ArrowRight size={14} />
            </a>
          </section>
          <section className="panel setup-card">
            <div className="step-number">02</div>
            <h2>Turn on Realtime Database</h2>
            <p>
              Create a Realtime Database in the region closest to your shops.
              The private rules below require a signed-in Firebase session,
              allow both shops to read their business lane, and validate only
              order, inventory, restock, and presence data.
            </p>
            <div className="code-chip">
              businesses / your-business-id / orders · inventory · restocks
            </div>
          </section>
          <section className="panel setup-card setup-wide">
            <div className="step-number">03</div>
            <h2>Apply the private database rules</h2>
            <p>
              In Realtime Database → Rules, replace the default rules with this
              policy and publish. It blocks unauthenticated reads and writes,
              prevents deleting records, keeps order details immutable, and only
              permits pending → confirmed → completed handoffs. Anonymous
              authentication protects the database from public traffic, but the
              business ID is not a second security boundary—only share the URL
              with the two shop teams.
            </p>
            <div className="env-block rules-block">
              <pre>{rulesText}</pre>
              <button
                className="copy-button"
                onClick={copyRules}
                data-testid="button-copy-rules"
              >
                {rulesCopied ? (
                  <>
                    <Check size={14} /> Copied
                  </>
                ) : (
                  "Copy rules"
                )}
              </button>
            </div>
          </section>
          <section className="panel setup-card setup-wide">
            <div className="step-number">04</div>
            <h2>
              Paste the web config into <span className="mono">.env</span>
            </h2>
            <p>
              Copy these keys into{" "}
              <span className="mono">artifacts/shop-bridge/.env</span>, then
              restart the dev server. The app detects the config on startup and
              signs the browser in anonymously before opening the
              business-scoped listener.
            </p>
            <div className="env-block">
              <pre>{envText}</pre>
              <button
                className="copy-button"
                onClick={copy}
                data-testid="button-copy-env"
              >
                {copied ? (
                  <>
                    <Check size={14} /> Copied
                  </>
                ) : (
                  "Copy keys"
                )}
              </button>
            </div>
          </section>
          <section className="panel setup-card setup-wide">
            <div className="step-number">05</div>
            <h2>Verify the live lane on two devices</h2>
            <p>
              Open the same URL in two separate browsers or devices. Sign in
              with the same business ID, choose {roleLabels.shop1} on one and{" "}
              {roleLabels.shop2} on the other, then run this handoff: send a
              request → confirm it → acknowledge delivery. Each status should
              appear on the other device without a refresh.
            </p>
            <div className="verification-list">
              <span>
                <Check size={14} /> {roleLabels.shop1} request appears in{" "}
                {roleLabels.shop2}
              </span>
              <span>
                <Check size={14} /> Confirmation appears in {roleLabels.shop1}
              </span>
              <span>
                <Check size={14} /> Delivery acknowledgement completes both
                views
              </span>
            </div>
          </section>
        </div>
        <div
          className={`demo-callout ${firebaseConfigured ? "live-callout" : ""}`}
        >
          <div className="demo-callout-icon">
            <Signal size={19} />
          </div>
          <div>
            {firebaseConfigured ? (
              <>
                <strong>Live configuration detected</strong>
                <p>
                  Anonymous sign-in will run automatically after the business ID
                  is entered. Use the two-device checklist above before sharing
                  the URL.
                </p>
              </>
            ) : (
              <>
                <strong>Working in demo mode right now</strong>
                <p>
                  Requests and inventory changes are stored locally for the
                  selected business ID. Connect Firebase, enable Anonymous
                  sign-in, and publish the rules when both shop teams are ready
                  to share a live lane.
                </p>
              </>
            )}
          </div>
          <Link
            href="/shop1"
            className="button button-secondary"
            data-testid="link-return-demo"
          >
            {firebaseConfigured ? "Open live workspace" : "Return to workspace"}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function SecurityPage({
  session,
  onLogout,
  onAccountChange,
}: {
  session: ShopSession;
  onLogout: () => void;
  onAccountChange: (username: string, businessId: string) => void;
}) {
  const [currentBusinessId, setCurrentBusinessId] = useState(session.businessId);
  const [oldUsername, setOldUsername] = useState(session.username);
  const [oldPassword, setOldPassword] = useState("");
  const [newUsername, setNewUsername] = useState(session.username);
  const [newBusinessId, setNewBusinessId] = useState(session.businessId);
  const [newPassword, setNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!currentBusinessId.trim()) {
      setError("Enter the current Business ID to authenticate this change.");
      return;
    }
    try {
      const response = await fetch(apiUrl("/api/owner/security"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: currentBusinessId.trim(),
          username: oldUsername,
          password: oldPassword,
          newBusinessId,
          newUsername,
          newPassword,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        username?: string;
        businessId?: string;
      } | null;
      if (!response.ok) {
        setError(result?.error ?? "Could not update owner credentials.");
        return;
      }
      const updatedUsername = result?.username ?? newUsername.trim();
      const updatedBusinessId =
        result?.businessId ??
        newBusinessId.trim().toLowerCase().replace(/\s+/g, "-");
      onAccountChange(updatedUsername, updatedBusinessId);
      setOldUsername(updatedUsername);
      setCurrentBusinessId(updatedBusinessId);
      setNewUsername(updatedUsername);
      setNewBusinessId(updatedBusinessId);
      setOldPassword("");
      setNewPassword("");
      setMessage("Owner account updated successfully. Your new credentials are now active.");
    } catch {
      setError(
        "Security service is unavailable. Start the local API server and try again.",
      );
    }
  }
  async function generateRecoveryCode() {
    setRecoveryLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(apiUrl("/api/owner/recovery-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: currentBusinessId.trim(),
          username: oldUsername.trim(),
          password: oldPassword,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; recoveryCode?: string } | null;
      if (!response.ok || !result?.recoveryCode) {
        setError(result?.error ?? "Could not generate a recovery code.");
        return;
      }
      setRecoveryCode(result.recoveryCode);
      setMessage("Save this recovery code offline. It works once; generating a new code will replace it.");
    } catch {
      setError("Recovery service is unavailable. Start the local API server and try again.");
    } finally {
      setRecoveryLoading(false);
    }
  }
  async function copyRecoveryCode() {
    if (!recoveryCode) return;
    await navigator.clipboard?.writeText(recoveryCode);
    setRecoveryCopied(true);
    window.setTimeout(() => setRecoveryCopied(false), 1800);
  }
  return (
    <AppShell session={session} onLogout={onLogout}>
      <div className="security-page">
        <PageIntro
          eyebrow="Owner security"
          title="Protect the owner account."
          description="Verify the current credentials before changing the Business ID, username, or password."
        />
        <section className="panel security-card">
          <form className="security-form" onSubmit={submit}>
            <h2>Current credentials</h2>
            <label>
              Current Business ID
              <input
                value={currentBusinessId}
                onChange={(event) => setCurrentBusinessId(event.target.value)}
                autoCapitalize="none"
                autoComplete="off"
                placeholder="Enter your Business ID"
              />
            </label>
            <label>
              Current username
              <input
                value={oldUsername}
                onChange={(event) => setOldUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              Current password
              <div className="password-field">
                <input
                  type={showOldPassword ? "text" : "password"}
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowOldPassword((visible) => !visible)}
                  aria-label={
                    showOldPassword
                      ? "Hide current password"
                      : "Show current password"
                  }
                  title={showOldPassword ? "Hide password" : "Show password"}
                >
                  {showOldPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <button className="button button-secondary" type="button" onClick={() => void generateRecoveryCode()} disabled={recoveryLoading}>
              {recoveryLoading ? "Generating recovery code..." : "Generate recovery code"}
            </button>
            {recoveryCode && (
              <div className="recovery-code-wrap">
                <p className="recovery-code">{recoveryCode}</p>
                <button
                  type="button"
                  className="copy-button recovery-copy-button"
                  onClick={() => void copyRecoveryCode()}
                  aria-label="Copy recovery code"
                >
                  <Copy size={15} /> {recoveryCopied ? "Copied" : "Copy code"}
                </button>
              </div>
            )}
            <h2>New account details</h2>
            <label>
              New Business ID
              <input
                value={newBusinessId}
                onChange={(event) => setNewBusinessId(event.target.value)}
                autoCapitalize="none"
              />
            </label>
            <label>
              New username
              <input
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              New password
              <div className="password-field">
                <input
                  type={showNewPassword ? "text" : "password"}
                  minLength={6}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowNewPassword((visible) => !visible)}
                  aria-label={
                    showNewPassword ? "Hide new password" : "Show new password"
                  }
                  title={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && <p className="login-error">{error}</p>}
            {message && <p className="security-success">{message}</p>}
            <button className="button button-primary" type="submit">
              Update owner account
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function LoginPage({ onLogin }: { onLogin: (session: ShopSession) => void }) {
  const [role, setRole] = useState<ShopRole>("shop1");
  const [username, setUsername] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryBusinessId, setRecoveryBusinessId] = useState("");
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (role === "owner" && recoveryMode) {
      if (!recoveryCode.trim() || !recoveryBusinessId.trim() || !recoveryUsername.trim() || recoveryPassword.length < 6) {
        setError("Enter the recovery code, new Business ID, username, and a password with at least 6 characters.");
        return;
      }
      try {
        const response = await fetch(apiUrl("/api/owner/recover"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryCode: recoveryCode.trim(),
            newBusinessId: recoveryBusinessId.trim(),
            newUsername: recoveryUsername.trim(),
            newPassword: recoveryPassword,
          }),
        });
        const result = (await response.json().catch(() => null)) as { error?: string; username?: string; businessId?: string } | null;
        if (!response.ok) {
          setError(result?.error ?? "Owner recovery failed.");
          return;
        }
        const recoveredSession = {
          username: result?.username ?? recoveryUsername.trim(),
          businessId: result?.businessId ?? recoveryBusinessId.trim().toLowerCase().replace(/\s+/g, "-"),
          role: "owner" as const,
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(recoveredSession));
        onLogin(recoveredSession);
        return;
      } catch {
        setError("Recovery service is unavailable. Start the local API server and try again.");
        return;
      }
    }
    const cleanUsername =
      role === "owner" ? ownerUsername.trim() : username.trim();
    const cleanBusinessId = businessId
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (!cleanUsername || !cleanBusinessId) {
      setError("Enter your name and the business ID shared by both shops.");
      return;
    }
    if (role === "owner") {
      if (!ownerUsername.trim() || !ownerPassword) {
        setError("Owner login requires a username and password.");
        return;
      }
      try {
        const response = await fetch(apiUrl("/api/owner/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: cleanBusinessId,
            username: ownerUsername.trim(),
            password: ownerPassword,
          }),
        });
        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(result?.error ?? "Owner authentication failed.");
          return;
        }
      } catch {
        setError(
          "Owner authentication is unavailable. Start the local API server and try again.",
        );
        return;
      }
    } else {
      try {
        const response = await fetch(
          apiUrl(`/api/owner/business-id-status?businessId=${encodeURIComponent(cleanBusinessId)}`),
        );
        const result = (await response.json().catch(() => null)) as {
          status?: "valid" | "changed" | "incorrect";
          newBusinessId?: string;
        } | null;
        if (response.status === 404) {
          setError(
            "Business ID verification is unavailable. Restart the API server, then try again.",
          );
          return;
        }
        if (!response.ok || result?.status === "incorrect") {
          setError("Business ID is incorrect. Enter the exact ID given by the owner.");
          return;
        }
        if (result?.status === "changed") {
          setError(
            `The owner changed the Business ID. Use the new ID: ${result.newBusinessId}.`,
          );
          return;
        }
      } catch {
        setError(
          "Business ID verification is unavailable. Start the local API server and try again.",
        );
        return;
      }
    }
    const session = {
      username: cleanUsername,
      businessId: cleanBusinessId,
      role,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    onLogin(session);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <Leaf size={22} strokeWidth={2.5} />
          </span>
          <span>
            <strong>Mayura</strong>
          </span>
        </div>
        <h1>Login</h1>
        <form onSubmit={submit} className="login-form">
          {role !== "owner" && (
            <label>
              Your name
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. Arun"
                autoComplete="name"
                data-testid="input-login-username"
              />
            </label>
          )}
          {role === "owner" && (
            <>
              {recoveryMode ? (
                <>
                  <label>
                    Recovery code
                    <input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} autoComplete="off" />
                  </label>
                  <label>
                    New Business ID
                    <input value={recoveryBusinessId} onChange={(event) => setRecoveryBusinessId(event.target.value)} autoCapitalize="none" />
                  </label>
                  <label>
                    New username
                    <input value={recoveryUsername} onChange={(event) => setRecoveryUsername(event.target.value)} autoComplete="username" />
                  </label>
                  <label>
                    New password
                    <div className="password-field">
                      <input type={showRecoveryPassword ? "text" : "password"} minLength={6} value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} autoComplete="new-password" />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowRecoveryPassword((visible) => !visible)}
                        aria-label={showRecoveryPassword ? "Hide recovery password" : "Show recovery password"}
                        title={showRecoveryPassword ? "Hide password" : "Show password"}
                      >
                        {showRecoveryPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Owner username
                    <input
                      value={ownerUsername}
                      onChange={(event) => setOwnerUsername(event.target.value)}
                      placeholder="Owner name"
                      autoComplete="username"
                      data-testid="input-owner-username"
                    />
                  </label>
                  <label>
                    Owner password
                    <div className="password-field">
                  <input
                    type={showOwnerPassword ? "text" : "password"}
                    value={ownerPassword}
                    onChange={(event) => setOwnerPassword(event.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    data-testid="input-owner-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowOwnerPassword((visible) => !visible)}
                    aria-label={
                      showOwnerPassword
                        ? "Hide owner password"
                        : "Show owner password"
                    }
                    title={
                      showOwnerPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showOwnerPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
                  </label>
                </>
              )}
            </>
          )}
          {!recoveryMode && <label>
            Business ID
            <input
              value={businessId}
              onChange={(event) => setBusinessId(event.target.value)}
              placeholder="Enter your Business ID"
              autoCapitalize="none"
              data-testid="input-login-business-id"
            />
            {role !== "owner" && <small>Enter the Business ID given by the owner.</small>}
          </label>}
          <fieldset>
            <legend>Which shop are you using?</legend>
            <div className="role-grid">
              <label
                className={`role-option ${role === "shop1" ? "role-option-active" : ""}`}
              >
                <input
                  type="radio"
                  name="shop-role"
                  value="shop1"
                  checked={role === "shop1"}
                  onChange={() => {
                    setRole("shop1");
                    setError("");
                  }}
                />
                <span>
                  <strong>{roleLabels.shop1}</strong>
                </span>
              </label>
              <label
                className={`role-option ${role === "shop2" ? "role-option-active" : ""}`}
              >
                <input
                  type="radio"
                  name="shop-role"
                  value="shop2"
                  checked={role === "shop2"}
                  onChange={() => {
                    setRole("shop2");
                    setError("");
                  }}
                />
                <span>
                  <strong>{roleLabels.shop2}</strong>
                </span>
              </label>
              <label
                className={`role-option ${role === "owner" ? "role-option-active" : ""}`}
              >
                <input
                  type="radio"
                  name="shop-role"
                  value="owner"
                  checked={role === "owner"}
                  onChange={() => {
                    setRole("owner");
                    setError("");
                  }}
                />
                <span>
                  <strong>Owner</strong>
                </span>
              </label>
            </div>
          </fieldset>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-primary login-submit"
            type="submit"
            data-testid="button-login"
          >
            <UserRound size={18} /> {recoveryMode ? "Recover owner account" : "Login"}{" "}
            <ArrowRight size={16} />
          </button>
          {role === "owner" && !recoveryMode && (
            <button type="button" className="auth-mode-link" onClick={() => { setRecoveryMode(true); setError(""); }}>
              Forgot owner credentials?
            </button>
          )}
          {role === "owner" && recoveryMode && (
            <button type="button" className="auth-mode-link" onClick={() => { setRecoveryMode(false); setError(""); }}>
              Back to owner login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<ShopSession | null>(() =>
    readSession(),
  );
  function updateOwnerAccount(username: string, businessId: string) {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, username, businessId };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    });
  }
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }
  if (!session) {
    return (
      <Switch>
        <Route path="/login">
          <LoginPage onLogin={setSession} />
        </Route>
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }
  return (
    <Switch>
      <Route path="/shop1/history">
        {session.role === "shop1" ? (
          <ShopHistoryPage session={session} onLogout={logout} />
        ) : (
          <Redirect to={`/${session.role}`} />
        )}
      </Route>
      <Route path="/shop1">
        {session.role === "shop1" ? (
          <ShopOne session={session} onLogout={logout} />
        ) : (
          <Redirect to="/shop2" />
        )}
      </Route>
      <Route path="/shop2/history">
        {session.role === "shop2" ? (
          <ShopHistoryPage session={session} onLogout={logout} />
        ) : (
          <Redirect to={`/${session.role}`} />
        )}
      </Route>
      <Route path="/shop2/restock">
        {session.role === "shop2" ? (
          <RestockPage session={session} onLogout={logout} />
        ) : (
          <Redirect to={`/${session.role}`} />
        )}
      </Route>
      <Route path="/shop2">
        {session.role === "shop2" ? (
          <ShopTwo session={session} onLogout={logout} />
        ) : (
          <Redirect to="/shop1" />
        )}
      </Route>
      <Route path="/owner">
        {session.role === "owner" ? (
          <OwnerDashboard session={session} onLogout={logout} />
        ) : (
          <Redirect to={`/${session.role}`} />
        )}
      </Route>
      <Route path="/security">
        {session.role === "owner" ? (
          <SecurityPage
            session={session}
            onLogout={logout}
            onAccountChange={updateOwnerAccount}
          />
        ) : (
          <Redirect to="/owner" />
        )}
      </Route>
      <Route path="/login">
        <Redirect
          to={
            session.role === "shop2"
              ? "/shop2"
              : session.role === "owner"
                ? "/owner"
                : "/shop1"
          }
        />
      </Route>
      <Route path="/">
        <Redirect
          to={
            session.role === "shop2"
              ? "/shop2"
              : session.role === "owner"
                ? "/owner"
                : "/shop1"
          }
        />
      </Route>
      <Route>
        <Redirect
          to={
            session.role === "shop2"
              ? "/shop2"
              : session.role === "owner"
                ? "/owner"
                : "/shop1"
          }
        />
      </Route>
    </Switch>
  );
}

export default App;
