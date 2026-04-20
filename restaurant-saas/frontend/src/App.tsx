import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import {
  useAuthStore,
  useBranchStore,
  useUIStore,
  useCartStore,
} from "@/store";
import { branchApi } from "@/api";
import type { UserRole, Branch } from "@/types";

// ─── Layouts ─────────────────────────────────
import CustomerLayout from "@/components/layout/CustomerLayout";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ─── Customer ────────────────────────────────
import MenuPage from "@/pages/customer/MenuPage";
import CheckoutPage from "@/pages/customer/CheckoutPage";
import OrderTrackingPage from "@/pages/customer/OrderTrackingPage";
import AboutPage from "@/pages/customer/AboutPage";
import ContactPage from "@/pages/customer/ContactPage";

// ─── Auth ─────────────────────────────────────
import LoginPage from "@/pages/LoginPage";

// ─── Admin ────────────────────────────────────
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminBranches from "@/pages/admin/AdminBranches";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminRestaurants from "@/pages/admin/AdminRestaurants";
import AdminSubscriptions from "@/pages/admin/AdminSubscriptions";

// ─── Owner ────────────────────────────────────
import OwnerDashboard from "@/pages/owner/OwnerDashboard";
import OwnerAnalytics from "@/pages/owner/OwnerAnalytics";
import OwnerBranding from "@/pages/owner/OwnerBranding";
import OwnerBranches from "@/pages/owner/OwnerBranches";

// ─── Manager ──────────────────────────────────
import ManagerDashboard from "@/pages/manager/ManagerDashboard";
import ManagerMenu from "@/pages/manager/ManagerMenu";
import ManagerOrders from "@/pages/manager/ManagerOrders";
import ManagerInventory from "@/pages/manager/ManagerInventory";
import ManagerStaff from "@/pages/manager/ManagerStaff";
import ManagerCoupons from "@/pages/manager/ManagerCoupons";
import ManagerAnalytics from "@/pages/manager/ManagerAnalytics";

// ─── Cashier / Chef ───────────────────────────
import CashierDashboard from "@/pages/cashier/CashierDashboard";
import ChefDashboard from "@/pages/chef/ChefDashboard";

// ─── 404 ──────────────────────────────────────
import NotFoundPage from "@/pages/NotFoundPage";

// ─── Query Client ─────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// ─── Branch Auto-loader ───────────────────────
function BranchInitializer() {
  const { setCurrentBranch, setBranches, currentBranch } = useBranchStore();
  const { setBranchId } = useCartStore(); // tie cart to branch
  const location = useLocation();

  useEffect(() => {
    // Determine slug from URL (ignore protected/admin routes)
    const segments = location.pathname.split("/").filter(Boolean);
    const protectedPaths = [
      "admin",
      "owner",
      "manager",
      "cashier",
      "chef",
      "login",
    ];
    const first = segments[0];
    const urlSlug =
      first && !protectedPaths.includes(first) ? first : undefined;

    const slug =
      urlSlug ||
      import.meta.env.VITE_DEFAULT_BRANCH_SLUG ||
      "bab-al-hara-riyadh";

    if (currentBranch && currentBranch.slug === slug) return;

    branchApi
      .getBySlug(slug)
      .then((res) => {
        const branch = res?.data?.data as Branch | undefined | null;
        if (branch) {
          setCurrentBranch(branch);
          setBranchId(branch.id);
        } else throw new Error("No branch returned");
      })
      .catch(() =>
        branchApi
          .getAll()
          .then((res) => {
            const list = res?.data?.data as Branch[] | undefined;
            if (Array.isArray(list) && list.length > 0) {
              setCurrentBranch(list[0]);
              setBranches(list);
              setBranchId(list[0].id);
            }
          })
          .catch(console.error),
      );
  }, [location.pathname, currentBranch]);

  return null;
}

// ─── Route Guards ─────────────────────────────
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}) {
  const { user, isAuthenticated } = useAuthStore();
  const params = useParams();
  const slug = params?.slug as string | undefined;

  // If not authenticated, send to slug-specific login when possible
  if (!isAuthenticated || !user)
    return <Navigate to={slug ? `/${slug}/login` : "/login"} replace />;

  if (!allowedRoles.includes(user.role as UserRole))
    return <Navigate to={getRoleHome(user.role as UserRole, slug)} replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const location = useLocation();
  const force = new URLSearchParams(location.search).get("force");

  if (isAuthenticated && user && !force) {
    const staffRoles = ["super_admin", "owner", "manager", "cashier", "chef"];
    if (staffRoles.includes(user.role as UserRole)) {
      return <Navigate to={getRoleHome(user.role as UserRole, slug)} replace />;
    }
    // customers/other roles: if visiting via slug, send to branch menu
    if (slug) return <Navigate to={`/${slug}`} replace />;
    return <Navigate to={getRoleHome(user.role as UserRole, slug)} replace />;
  }
  return <>{children}</>;
}

function getRoleHome(role: UserRole, slug?: string): string {
  const map: Record<string, string> = {
    super_admin: "/admin",
    owner: "/owner",
    manager: "/manager",
    cashier: "/cashier",
    chef: "/chef",
  };
  const base = map[role] || "/";
  // For staff roles, prefer slug-prefixed path when slug is available
  if (slug && role !== "super_admin") return `/${slug}${base}`;
  return base;
}

// ─── App ──────────────────────────────────────
export default function App() {
  const { applyTheme } = useUIStore();
  useEffect(() => {
    applyTheme();
  }, []);

  // Listen for order updates broadcast via localStorage from other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!e.key) return;
      if (e.key !== "restory:order:update") return;
      try {
        // invalidate queries so UIs refresh
        queryClient.invalidateQueries();
        // parse payload and broadcast a CustomEvent for components that hold local state
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (payload && payload.id) {
          window.dispatchEvent(
            new CustomEvent("restory:order:update", { detail: payload }),
          );
        }
      } catch (err) {
        // ignore malformed payloads
      }
    }
    window.addEventListener("storage", onStorage);

    // BroadcastChannel listener (more reliable cross-tab messaging)
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("restory:orders");
        bc.addEventListener("message", (ev) => {
          try {
            const payload = ev.data;
            queryClient.invalidateQueries();
            if (payload && payload.id) {
              window.dispatchEvent(
                new CustomEvent("restory:order:update", { detail: payload }),
              );
            }
          } catch (e) {
            // ignore
          }
        });
      }
    } catch (e) {
      bc = null;
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      try {
        if (bc) bc.close();
      } catch {}
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BranchInitializer />

        <Routes>
          {/* Customer (root) */}
          <Route element={<CustomerLayout />}>
            <Route index element={<MenuPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="track/:orderNumber" element={<OrderTrackingPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
          </Route>

          {/* Customer (slug) — allow visiting /:slug and /:slug/about etc. */}
          <Route path=":slug" element={<CustomerLayout />}>
            <Route index element={<MenuPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="track/:orderNumber" element={<OrderTrackingPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
          </Route>

          {/* Auth */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />

          {/* Slug-specific login, e.g. /my-branch/login */}
          <Route
            path=":slug/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />

          {/* Super Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <DashboardLayout role="super_admin" />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="branches" element={<AdminBranches />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="restaurants" element={<AdminRestaurants />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
          </Route>

          {/* Owner (now under :slug) */}
          <Route
            path=":slug/owner"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <DashboardLayout role="owner" />
              </ProtectedRoute>
            }
          >
            <Route index element={<OwnerDashboard />} />
            <Route path="analytics" element={<OwnerAnalytics />} />
            <Route path="branding" element={<OwnerBranding />} />
            <Route path="branches" element={<OwnerBranches />} />
          </Route>

          {/* Manager (now under :slug) */}
          <Route
            path=":slug/manager"
            element={
              <ProtectedRoute allowedRoles={["manager"]}>
                <DashboardLayout role="manager" />
              </ProtectedRoute>
            }
          >
            <Route index element={<ManagerDashboard />} />
            <Route path="orders" element={<ManagerOrders />} />
            <Route path="menu" element={<ManagerMenu />} />
            <Route path="inventory" element={<ManagerInventory />} />
            <Route path="coupons" element={<ManagerCoupons />} />
            <Route path="staff" element={<ManagerStaff />} />
            <Route path="analytics" element={<ManagerAnalytics />} />
          </Route>

          {/* Cashier (now under :slug) */}
          <Route
            path=":slug/cashier"
            element={
              <ProtectedRoute allowedRoles={["cashier"]}>
                <DashboardLayout role="cashier" />
              </ProtectedRoute>
            }
          >
            <Route index element={<CashierDashboard />} />
          </Route>

          {/* Chef (now under :slug) */}
          <Route
            path=":slug/chef"
            element={
              <ProtectedRoute allowedRoles={["chef"]}>
                <DashboardLayout role="chef" />
              </ProtectedRoute>
            }
          >
            <Route index element={<ChefDashboard />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "var(--surface-2)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-body)",
              fontSize: "0.9rem",
              boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            },
            success: {
              iconTheme: { primary: "#4ade80", secondary: "var(--surface-2)" },
            },
            error: {
              iconTheme: { primary: "#f87171", secondary: "var(--surface-2)" },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
