import { Outlet, Link, useLocation, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { ShoppingCart, Menu, X, ChefHat, Package, Clock } from "lucide-react";
import { useCartStore, useBranchStore } from "@/store";
import CartDrawer from "@/components/cart/CartDrawer";
import AIChat from "@/components/ai/AIChat";

// ─── Active Order Banner ──────────────────────────────────
function ActiveOrderBanner() {
  const { currentBranch } = useBranchStore();
  const [activeOrder, setActiveOrder] = useState<{
    orderNumber: string;
    status: string;
    slug?: string;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("active_order");
    if (saved) {
      try {
        const order = JSON.parse(saved);
        const doneStatuses = ["delivered", "cancelled"];
        if (!doneStatuses.includes(order.status)) {
          setActiveOrder(order);
        } else {
          localStorage.removeItem("active_order");
        }
      } catch {
        localStorage.removeItem("active_order");
      }
    }
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "active_order") {
        if (e.newValue) {
          try {
            const order = JSON.parse(e.newValue);
            const doneStatuses = ["delivered", "cancelled"];
            if (!doneStatuses.includes(order.status)) setActiveOrder(order);
            else setActiveOrder(null);
          } catch {
            /* ignore */
          }
        } else setActiveOrder(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  if (!activeOrder) return null;

  const statusConfig: Record<
    string,
    { label: string; icon: React.ReactNode; color: string }
  > = {
    pending: {
      label: "Waiting confirmation",
      icon: <Clock size={14} />,
      color: "#f59e0b",
    },
    accepted: {
      label: "Order accepted",
      icon: <Clock size={14} />,
      color: "#60a5fa",
    },
    preparing: {
      label: "Being prepared",
      icon: <ChefHat size={14} />,
      color: "#a78bfa",
    },
    ready: {
      label: "Ready for pickup!",
      icon: <Package size={14} />,
      color: "#4ade80",
    },
  };

  const cfg = statusConfig[activeOrder.status] ?? statusConfig["pending"];

  return (
    <div
      className="sticky top-0 z-50 w-full px-4 py-2.5 flex items-center justify-between gap-3"
      style={{
        background: `${cfg.color}15`,
        borderBottom: `1px solid ${cfg.color}30`,
      }}
    >
      <div className="flex items-center gap-2 text-sm">
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span style={{ color: cfg.color }} className="font-medium">
          {cfg.label}
        </span>
        <span
          className="font-mono text-xs opacity-70"
          style={{ color: cfg.color }}
        >
          #{activeOrder.orderNumber}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setActiveOrder(null);
            localStorage.removeItem("active_order");
          }}
          className="text-xs opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: cfg.color }}
          aria-label="Dismiss active order banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────
function CustomerNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { items, openCart } = useCartStore();
  const { currentBranch } = useBranchStore();
  const [activeOrder, setActiveOrder] = useState<{
    orderNumber: string;
    status: string;
    slug?: string;
  } | null>(null);
  const params = useParams();
  const slug = params.slug || currentBranch?.slug || "";

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  // helper to read active_order from storage and update local state
  useEffect(() => {
    const readActive = () => {
      const saved = localStorage.getItem("active_order");
      if (saved) {
        try {
          const order = JSON.parse(saved);
          const doneStatuses = ["delivered", "cancelled"];
          if (!doneStatuses.includes(order.status)) setActiveOrder(order);
          else setActiveOrder(null);
        } catch {
          setActiveOrder(null);
        }
      } else setActiveOrder(null);
    };

    // update on mount
    readActive();

    // update on storage events (other tabs) and custom events (same-tab)
    const handleStorage = (e?: StorageEvent | Event) => {
      // if StorageEvent, optionally check key
      if ((e as StorageEvent)?.type === "storage") {
        const se = e as StorageEvent;
        if (se.key && se.key !== "active_order") return;
      }
      readActive();
    };

    window.addEventListener("storage", handleStorage as any);
    window.addEventListener("active_order_changed", handleStorage as any);
    return () => {
      window.removeEventListener("storage", handleStorage as any);
      window.removeEventListener("active_order_changed", handleStorage as any);
    };
  }, []);

  const navLinks = [
    { to: slug ? `/${slug}` : "/", label: "Menu" },
    { to: slug ? `/${slug}/about` : "/about", label: "About" },
    { to: slug ? `/${slug}/contact` : "/contact", label: "Contact" },
  ];

  return (
    <>
      <nav
        className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: "var(--surface)", backdropFilter: "blur(12px)" }}
      >
        <div className="container-app flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link
            to={slug ? `/${slug}` : "/"}
            className="flex items-center gap-2"
          >
            {currentBranch?.restaurant?.logo ? (
              <img
                src={currentBranch.restaurant.logo}
                alt={currentBranch.name}
                className="h-9 w-auto"
              />
            ) : (
              <span
                className="font-display font-bold text-lg"
                style={{ color: "var(--text-primary)" }}
              >
                {currentBranch?.name || "Menu"}
              </span>
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium transition-colors hover:text-[var(--brand-400)]"
                style={{ color: "var(--text-secondary)" }}
              >
                {link.label}
              </Link>
            ))}
            {activeOrder &&
              (() => {
                const trackSlug = activeOrder.slug ?? currentBranch?.slug;
                const to = trackSlug
                  ? `/${trackSlug}/track/${activeOrder.orderNumber}`
                  : `/track/${activeOrder.orderNumber}`;
                return (
                  <Link
                    to={to}
                    className="text-sm font-medium transition-colors hover:text-[var(--brand-400)]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Track Order
                  </Link>
                );
              })()}
          </div>

          {/* Cart Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => openCart()}
              className="relative btn btn-secondary btn-sm gap-2"
            >
              <ShoppingCart size={16} />
              <span className="hidden sm:inline">Cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full brand-gradient text-white text-xs flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              className="sm:hidden btn btn-ghost btn-icon"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div
            className="sm:hidden border-t border-[var(--border)] py-3 px-4 space-y-2"
            style={{ background: "var(--surface-2)" }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm font-medium transition-colors hover:text-[var(--brand-400)]"
                style={{ color: "var(--text-secondary)" }}
              >
                {link.label}
              </Link>
            ))}
            {activeOrder &&
              (() => {
                const trackSlug = activeOrder.slug ?? currentBranch?.slug;
                const to = trackSlug
                  ? `/${trackSlug}/track/${activeOrder.orderNumber}`
                  : `/track/${activeOrder.orderNumber}`;
                return (
                  <Link
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 text-sm font-medium transition-colors hover:text-[var(--brand-400)]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Track Order
                  </Link>
                );
              })()}
          </div>
        )}
      </nav>

      <CartDrawer />
    </>
  );
}

// ─── Main CustomerLayout ──────────────────────────────────
export default function CustomerLayout() {
  const { currentBranch } = useBranchStore();

  return (
    <div className="min-h-screen" style={{ background: "var(--surface)" }}>
      {/* Navbar */}
      <CustomerNav />

      {/* Page Content */}
      <Outlet />

      {/* AI Chat FAB */}
      {currentBranch && <AIChat />}
    </div>
  );
}
