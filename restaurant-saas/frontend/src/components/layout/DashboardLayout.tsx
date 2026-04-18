import { useEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  Menu,
  X,
  Store,
  Tag,
  Package,
  ChefHat,
  CreditCard,
  Globe,
  Palette,
  UtensilsCrossed,
  UserCheck,
} from "lucide-react";
import type { UserRole } from "@/types";
import { useAuthStore, useUIStore, useBranchStore } from "@/store";
import { authApi } from "@/api";
import NotificationPanel from "@/components/ui/NotificationPanel";
import { useNotifications } from "@/hooks/useNotifications";
const NAV_CONFIG: Record<
  UserRole,
  { label: string; icon: React.ReactNode; to: string }[]
> = {
  super_admin: [
    { label: "Dashboard", icon: <LayoutDashboard size={18} />, to: "/admin" },
    {
      label: "Restaurants",
      icon: <Store size={18} />,
      to: "/admin/restaurants",
    },
    { label: "Branches", icon: <Globe size={18} />, to: "/admin/branches" },
    { label: "Users", icon: <Users size={18} />, to: "/admin/users" },
    {
      label: "Subscriptions",
      icon: <CreditCard size={18} />,
      to: "/admin/subscriptions",
    },
  ],
  owner: [
    { label: "Dashboard", icon: <LayoutDashboard size={18} />, to: "/owner" },
    {
      label: "Analytics",
      icon: <BarChart3 size={18} />,
      to: "/owner/analytics",
    },
    { label: "Branches", icon: <Globe size={18} />, to: "/owner/branches" },
    { label: "Branding", icon: <Palette size={18} />, to: "/owner/branding" },
  ],
  manager: [
    { label: "Dashboard", icon: <LayoutDashboard size={18} />, to: "/manager" },
    { label: "Orders", icon: <ShoppingBag size={18} />, to: "/manager/orders" },
    { label: "Menu", icon: <UtensilsCrossed size={18} />, to: "/manager/menu" },
    {
      label: "Inventory",
      icon: <Package size={18} />,
      to: "/manager/inventory",
    },
    { label: "Coupons", icon: <Tag size={18} />, to: "/manager/coupons" },
    { label: "Staff", icon: <UserCheck size={18} />, to: "/manager/staff" },
    {
      label: "Analytics",
      icon: <BarChart3 size={18} />,
      to: "/manager/analytics",
    },
  ],
  cashier: [
    { label: "Orders", icon: <CreditCard size={18} />, to: "/cashier" },
  ],
  chef: [{ label: "Kitchen", icon: <ChefHat size={18} />, to: "/chef" }],
  customer: [],
  guest: [],
};

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  owner: "Restaurant Owner",
  manager: "Branch Manager",
  cashier: "Cashier",
  chef: "Chef / Staff",
  customer: "Customer",
  guest: "Guest",
};

interface DashboardLayoutProps {
  role: UserRole;
}

export default function DashboardLayout({ role }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const { unreadCount, sidebarOpen, toggleSidebar, closeSidebar } =
    useUIStore();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = NAV_CONFIG[role] || [];

  const logoUrl =
    (currentBranch as any)?.restaurant?.branding?.logo_url ||
    (currentBranch as any)?.restaurant?.logo ||
    (currentBranch as any)?.restaurant_logo ||
    null;

  // ── Fetch notifications من الـ API ────────
  useNotifications();

  // ── Entrance animation ───────────────────
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        sidebarRef.current,
        { x: -280, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" },
      );
      gsap.fromTo(
        mainRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.15, ease: "power3.out" },
      );
      gsap.fromTo(
        "[data-nav-item]",
        { x: -20, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          stagger: 0.05,
          delay: 0.2,
          duration: 0.35,
          ease: "power2.out",
        },
      );
    });
    return () => ctx.revert();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    const slug = currentBranch?.slug || null; // <-- جيبها قبل logout يمسحها
    try {
      await authApi.logout();
    } finally {
      logout();
      navigate(slug ? `/${slug}/login` : "/login");
    }
  };

  const isActive = (to: string) => {
    // Determine primary segment for the nav item (e.g. '/owner/analytics' -> 'owner')
    const primary = to.replace(/^\/+/, "").split("/")[0];
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.includes(primary);
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        ref={sidebarRef}
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-64 flex flex-col border-r border-[var(--border)]
          transition-transform duration-300 ease-out lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ background: "var(--surface-2)" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg brand-gradient flex items-center justify-center">
                  <UtensilsCrossed size={16} className="text-white" />
                </div>
              )}
            </div>
            <div>
              <p
                className="text-sm font-bold font-display"
                style={{ color: "var(--text-primary)" }}
              >
                Restory
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {ROLE_LABELS[role]}
              </p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden btn btn-ghost btn-icon"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.to);
            const staffPrefixes = ["/owner", "/manager", "/cashier", "/chef"];
            const shouldPrefix = staffPrefixes.some((p) =>
              item.to.startsWith(p),
            );
            const to =
              shouldPrefix && currentBranch?.slug
                ? `/${currentBranch.slug}${item.to}`
                : item.to;

            return (
              <Link
                key={item.to}
                to={to}
                data-nav-item
                onClick={closeSidebar}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 group relative overflow-hidden
                  ${
                    active
                      ? "text-[var(--brand-400)] bg-[rgba(var(--brand-rgb),0.1)] border border-[rgba(var(--brand-rgb),0.15)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
                  }
                `}
              >
                {active && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: "var(--brand-500)" }}
                  />
                )}
                <span
                  className={`transition-transform duration-200 ${active ? "" : "group-hover:scale-110"}`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="p-3 border-t border-[var(--border)]">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--surface-3)] transition-all"
          >
            <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {user?.name || "User"}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {user?.email}
              </p>
            </div>
            <ChevronDown
              size={14}
              style={{ color: "var(--text-muted)" }}
              className={`transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {userMenuOpen && (
            <div
              className="mt-1 rounded-xl border border-[var(--border)] overflow-hidden animate-slide-down"
              style={{ background: "var(--surface-3)" }}
            >
              <Link
                to={
                  currentBranch?.slug
                    ? `/${currentBranch.slug}/${role}/settings`
                    : `/${role}/settings`
                }
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[var(--surface-4)] transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <Settings size={15} /> Settings
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[rgba(239,68,68,0.1)] text-red-400 transition-colors"
              >
                <LogOut size={15} />
                {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between h-16 px-6 border-b border-[var(--border)] flex-shrink-0"
          style={{ background: "var(--surface-2)" }}
        >
          <button
            onClick={toggleSidebar}
            className="lg:hidden btn btn-ghost btn-icon"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 lg:flex-none">
            <h1
              className="text-lg font-display font-semibold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="logo"
                  className="w-6 h-6 rounded-md object-cover"
                />
              )}
              {navItems.find((n) => isActive(n.to))?.label || "Dashboard"}
            </h1>
          </div>

          {/* Bell */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="btn btn-ghost btn-icon relative"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full brand-gradient text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <NotificationPanel onClose={() => setNotifOpen(false)} />
            )}
          </div>
        </header>

        {/* Page */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
