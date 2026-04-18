import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  User,
  Branch,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  ProductAddon,
  OrderType,
  Coupon,
  Notification,
  ThemeConfig,
} from "@/types";
import { v4 as uuid } from "./uuid";

// ═══════════════════════════════════════════════
// AUTH STORE
// ═══════════════════════════════════════════════
interface AuthState {
  user: User | null;
  token: string | null;
  guestId: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;

  setUser: (user: User, token: string) => void;
  setGuestId: (id: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      guestId: null,
      isAuthenticated: false,
      isGuest: false,

      setUser: (user, token) => {
        // التعديل: الحفظ في sessionStorage لضمان استقلالية التبويب
        sessionStorage.setItem("auth_token", token);
        set({ user, token, isAuthenticated: true, isGuest: false });
      },

      setGuestId: (id) => {
        // الـ guestId ممكن يضل localStorage عشان الزبون ما يضيع حسابه لو سكر التبويب
        localStorage.setItem("guest_id", id);
        set({ guestId: id, isGuest: true });
      },

      logout: () => {
        sessionStorage.removeItem("auth_token"); // تنظيف التوكن من السشن
        localStorage.removeItem("guest_id");
        sessionStorage.removeItem("branch_id"); // تنظيف البرانش من السشن
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isGuest: false,
          guestId: null,
        });
      },
    }),
    {
      name: "restory-auth",
      // التعديل: تغيير المخزن الكلي للـ Store ليكون sessionStorage
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        guestId: s.guestId,
        isAuthenticated: s.isAuthenticated,
        isGuest: s.isGuest,
      }),
    },
  ),
);
// ═══════════════════════════════════════════════
// BRANCH STORE
// ═══════════════════════════════════════════════
interface BranchState {
  currentBranch: Branch | null;
  branches: Branch[];
  setCurrentBranch: (b: Branch) => void;
  setBranches: (bs: Branch[]) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      currentBranch: null,
      branches: [],
      setCurrentBranch: (branch) => {
        // التعديل: حفظ الـ branch_id في sessionStorage
        sessionStorage.setItem("branch_id", String(branch.id));
        set({ currentBranch: branch });
      },
      setBranches: (branches) => set({ branches }),
    }),
    {
      name: "restory-branch",
      // التعديل: استبدال localStorage بـ sessionStorage
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

// ═══════════════════════════════════════════════
// CART STORE
// ═══════════════════════════════════════════════
function calcItemPrice(
  product: Product,
  variant?: ProductVariant,
  addons: ProductAddon[] = [],
): number {
  let price = product.price;
  if (variant) price += variant.price_modifier;
  addons.forEach((a) => (price += a.price));
  return Math.max(0, price);
}

function recalc(items: CartItem[], deliveryFee: number, coupon?: Coupon) {
  const subtotal = items.reduce((s, i) => s + i.total_price, 0);
  let discount = 0;
  if (coupon && subtotal >= coupon.min_order_amount) {
    discount =
      coupon.type === "percentage"
        ? subtotal * (coupon.value / 100)
        : coupon.value;
    if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
    discount = Math.round(discount * 100) / 100;
  }
  const total = Math.max(0, subtotal - discount + deliveryFee);
  return { subtotal, discount, total };
}

interface CartState extends Cart {
  isOpen: boolean;
  addItem: (
    product: Product,
    qty: number,
    variant?: ProductVariant,
    addons?: ProductAddon[],
    instructions?: string,
  ) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  applyCoupon: (coupon: Coupon) => void;
  removeCoupon: () => void;
  setOrderType: (type: OrderType) => void;
  setDeliveryFee: (fee: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Each cart is tied to a branch. When branch changes, cart clears.
      branch_id: null,

      items: [],
      order_type: "dine_in",
      subtotal: 0,
      discount: 0,
      delivery_fee: 0,
      total: 0,
      coupon_id: undefined,
      isOpen: false,

      setBranchId: (branchId: number) => {
        const state = get();
        if (state.branch_id !== null && state.branch_id !== branchId) {
          // branch switched -> clear cart
          set({
            branch_id: branchId,
            items: [],
            subtotal: 0,
            discount: 0,
            delivery_fee: 0,
            total: 0,
            coupon_id: undefined,
          });
        } else {
          set({ branch_id: branchId });
        }
      },

      addItem: (product, quantity, variant, addons = [], instructions) => {
        const state = get();
        // If current cart is tied to another branch, reset first
        if (state.branch_id !== null && product.branch_id !== state.branch_id) {
          set({
            items: [],
            subtotal: 0,
            discount: 0,
            delivery_fee: 0,
            total: 0,
            coupon_id: undefined,
          });
        }

        const unitPrice = calcItemPrice(product, variant, addons);

        const existingKey = `${product.id}-${variant?.id || 0}-${addons
          ?.map((a) => a.id)
          .sort()
          .join(",")}`;
        const existing = state.items.find(
          (i) =>
            `${i.product_id}-${i.selected_variant?.id || 0}-${i.selected_addons
              .map((a) => a.id)
              .sort()
              .join(",")}` === existingKey,
        );

        if (existing) {
          const newQty = existing.quantity + quantity;
          const updated = state.items.map((i) =>
            i.id === existing.id
              ? { ...i, quantity: newQty, total_price: unitPrice * newQty }
              : i,
          );
          set({ items: updated });
        } else {
          const newItem: CartItem = {
            id: uuid(),
            product_id: product.id,
            product,
            quantity,
            unit_price: unitPrice,
            total_price: unitPrice * quantity,
            selected_variant: variant,
            selected_addons: addons || [],
            special_instructions: instructions,
          };
          set({ items: [...state.items, newItem] });
        }

        get().recalculate();
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
        get().recalculate();
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.id === id
              ? { ...i, quantity, total_price: i.unit_price * quantity }
              : i,
          ),
        });
        get().recalculate();
      },

      setOrderType: (type) => {
        set({ order_type: type });
        get().recalculate();
      },

      setDeliveryFee: (fee) => {
        set({ delivery_fee: fee });
        get().recalculate();
      },

      applyCoupon: (couponId, discount) => {
        set({ coupon_id: couponId, discount });
        get().recalculate();
      },

      removeCoupon: () => {
        set({ coupon_id: undefined, discount: 0 });
        get().recalculate();
      },

      clearCart: () =>
        set({
          items: [],
          subtotal: 0,
          discount: 0,
          delivery_fee: 0,
          total: 0,
          coupon_id: undefined,
        }),

      recalculate: () => {
        const { items, discount, delivery_fee } = get();
        const subtotal = items.reduce((sum, i) => sum + i.total_price, 0);
        const total = Math.max(0, subtotal - discount + delivery_fee);
        set({ subtotal, total });
      },

      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    {
      name: "restory-cart",
      // persist branch_id and items so a page reload keeps the cart for that branch
      partialize: (state) => ({
        branch_id: state.branch_id,
        items: state.items,
        order_type: state.order_type,
        subtotal: state.subtotal,
        discount: state.discount,
        delivery_fee: state.delivery_fee,
        total: state.total,
        coupon_id: state.coupon_id,
        isOpen: state.isOpen,
      }),
    },
  ),
);

// ═══════════════════════════════════════════════
// UI STORE
// ═══════════════════════════════════════════════
interface UIState {
  notifications: Notification[];
  unreadCount: number;
  sidebarOpen: boolean;
  theme: ThemeConfig;
  language: "en" | "ar";

  // Notifications — بيتحدثوا من الـ API
  setNotifications: (
    notifications: Notification[],
    unreadCount: number,
  ) => void;
  addNotification: (n: Notification) => void;
  markAllRead: () => void;
  markRead: (id: string | number) => void;

  toggleSidebar: () => void;
  closeSidebar: () => void;
  setTheme: (t: Partial<ThemeConfig>) => void;
  setLanguage: (lang: "en" | "ar") => void;
  applyTheme: () => void;
}

const DEFAULT_THEME: ThemeConfig = {
  theme: "dark",
  primary_color: "#f97316",
  font_display: "Playfair Display",
  font_body: "DM Sans",
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      sidebarOpen: false,
      theme: DEFAULT_THEME,
      language: "en",

      // تحديث من الـ API
      setNotifications: (notifications, unreadCount) =>
        set({ notifications, unreadCount }),

      addNotification: (n) =>
        set((s) => ({
          notifications: [n, ...s.notifications].slice(0, 50),
          unreadCount: s.unreadCount + 1,
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
          unreadCount: 0,
        })),

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            String(n.id) === String(id) ? { ...n, is_read: true } : n,
          ),
          unreadCount: Math.max(0, s.unreadCount - 1),
        })),

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),

      setTheme: (partial) => {
        set((s) => ({ theme: { ...s.theme, ...partial } }));
        get().applyTheme();
      },

      setLanguage: (lang) => {
        set({ language: lang });
        document.documentElement.setAttribute("lang", lang);
        document.documentElement.setAttribute(
          "dir",
          lang === "ar" ? "rtl" : "ltr",
        );
      },

      applyTheme: () => {
        const { theme } = get();
        const root = document.documentElement;
        root.setAttribute("data-theme", theme.theme);

        if (theme.primary_color) {
          const hex = theme.primary_color.replace("#", "");
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          root.style.setProperty("--brand-500", theme.primary_color);
          root.style.setProperty("--brand-rgb", `${r}, ${g}, ${b}`);
          root.style.setProperty("--brand-400", shiftColor(hex, 20));
          root.style.setProperty("--brand-600", shiftColor(hex, -20));
        }
        if (theme.font_display)
          root.style.setProperty("--font-display", `'${theme.font_display}'`);
        if (theme.font_body)
          root.style.setProperty("--font-body", `'${theme.font_body}'`);

        if (theme.custom_css) {
          let el = document.getElementById("custom-theme-css");
          if (!el) {
            el = document.createElement("style");
            el.id = "custom-theme-css";
            document.head.appendChild(el);
          }
          el.textContent = theme.custom_css;
        }
      },
    }),
    {
      name: "restory-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, language: s.language }),
    },
  ),
);

// ─── Color helper ─────────────────────────────
function shiftColor(hex: string, amount: number): string {
  const num = parseInt(hex, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
