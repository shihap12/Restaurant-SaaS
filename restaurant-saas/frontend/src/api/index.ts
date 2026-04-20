import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from "axios";
import type { ApiResponse } from "@/types";

// ─── Base URL → XAMPP backend ────────────────
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost/backend-ree";

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: false,
});

// ─── Attach JWT token on every request ───────
api.interceptors.request.use(
  (config) => {
    // التعديل الجوهري: القراءة من sessionStorage لضمان فصل التبويبات
    const token = sessionStorage.getItem("auth_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const guestId = localStorage.getItem("guest_id");
    if (guestId) config.headers["X-Guest-ID"] = guestId;

    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Handle 401 globally ─────────────────────
api.interceptors.response.use(
  (r: AxiosResponse) => r,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      // حذف التوكن من sessionStorage عند انتهاء الصلاحية
      sessionStorage.removeItem("auth_token");
      const path = window.location.pathname;
      const parts = path.split("/").filter(Boolean);
      const roleSegments = ["admin", "owner", "manager", "cashier", "chef"];

      // If the current path includes a role segment, redirect to slug-specific login when possible
      const hasRole = parts.some((p) => roleSegments.includes(p));
      if (hasRole) {
        const slug = parts[0];
        window.location.href = slug ? `/${slug}/login` : "/login";
      } else if (roleSegments.some((p) => path.startsWith(`/${p}`))) {
        // fallback for root-mounted admin paths
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth ────────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<{ token: string; user: unknown }>>(
      "/auth/login",
      data,
    ),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<ApiResponse<unknown>>("/auth/me"),
};

// ─── Branches ────────────────────────────────
export const branchApi = {
  getAll: () => api.get<ApiResponse<unknown[]>>("/branches"),
  getBySlug: (slug: string) =>
    api.get<ApiResponse<unknown>>(`/branches/${slug}`),
  create: (data: unknown) => api.post<ApiResponse<unknown>>("/branches", data),
  update: (id: number, data: unknown) =>
    api.put<ApiResponse<unknown>>(`/branches/${id}`, data),
  delete: (id: number) => api.delete(`/branches/${id}`),
  toggle: (id: number) => api.patch(`/branches/${id}/toggle`),
};

// ─── Categories ──────────────────────────────
export const categoryApi = {
  getAll: (branchId: number) =>
    api.get<ApiResponse<unknown[]>>("/categories", {
      params: { branch_id: branchId },
    }),
  create: (data: unknown) =>
    api.post<ApiResponse<unknown>>("/categories", data),
  update: (id: number, data: unknown) =>
    api.put<ApiResponse<unknown>>(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
  reorder: (ids: number[]) => api.post("/categories/reorder", { ids }),
};

// ─── Products ────────────────────────────────
export const productApi = {
  getAll: (branchId: number, params?: Record<string, unknown>) =>
    api.get<ApiResponse<unknown[]>>("/products", {
      params: { branch_id: branchId, ...params },
    }),
  getById: (id: number) => api.get<ApiResponse<unknown>>(`/products/${id}`),
  create: (data: FormData) =>
    api.post<ApiResponse<unknown>>("/products", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: number, data: FormData) =>
    api.post<ApiResponse<unknown>>(`/products/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: number) => api.delete(`/products/${id}`),
  toggleStatus: (id: number) => api.patch(`/products/${id}/toggle`),
  updateStock: (id: number, qty: number) =>
    api.patch(`/products/${id}/stock`, { quantity: qty }),
};

// ─── Orders ──────────────────────────────────
export const orderApi = {
  getAll: (branchId: number, params?: Record<string, unknown>) =>
    api.get<ApiResponse<unknown[]>>("/orders", {
      params: { branch_id: branchId, ...params },
    }),
  getById: (id: number) => api.get<ApiResponse<unknown>>(`/orders/${id}`),
  create: (data: unknown) => api.post<ApiResponse<unknown>>("/orders", data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/orders/${id}/status`, { status }).then((res) => {
      try {
        // Broadcast via BroadcastChannel when available (more reliable)
        if (typeof BroadcastChannel !== "undefined") {
          try {
            const bc = new BroadcastChannel("restory:orders");
            bc.postMessage({ id, status, ts: Date.now() });
            bc.close();
          } catch (e) {
            // ignore
          }
        }

        // Fallback: write to localStorage so other tabs receive a storage event
        localStorage.setItem(
          "restory:order:update",
          JSON.stringify({ id, status, ts: Date.now() }),
        );
      } catch (e) {
        // ignore storage/broadcast errors
      }
      return res;
    }),
  getGuestOrders: (guestId: string) =>
    api.get<ApiResponse<unknown[]>>("/orders/guest", {
      params: { guest_id: guestId },
    }),
  getOrderByNumber: (num: string) =>
    api.get<ApiResponse<unknown>>(`/orders/track/${num}`),
  checkout: (id: number, data: { payment_method: "cash" | "card" }) =>
    api.patch<ApiResponse<unknown>>(`/orders/${id}/checkout`, data),
};

// ─── Coupons ─────────────────────────────────
export const couponApi = {
  getAll: (branchId: number) =>
    api.get<ApiResponse<unknown[]>>("/coupons", {
      params: { branch_id: branchId },
    }),
  validate: (code: string, branchId: number, orderAmount: number) =>
    api.post<ApiResponse<unknown>>("/coupons/validate", {
      code,
      branch_id: branchId,
      order_amount: orderAmount,
    }),
  create: (data: unknown) => api.post<ApiResponse<unknown>>("/coupons", data),
  update: (id: number, data: unknown) =>
    api.put<ApiResponse<unknown>>(`/coupons/${id}`, data),
  delete: (id: number) => api.delete(`/coupons/${id}`),
};

// ─── Analytics ───────────────────────────────
export const analyticsApi = {
  getOverview: (branchId: number, period: string) =>
    api.get<ApiResponse<unknown>>("/analytics/overview", {
      params: { branch_id: branchId, period },
    }),
  getRevenue: (branchId: number, period: string) =>
    api.get<ApiResponse<unknown[]>>("/analytics/revenue", {
      params: { branch_id: branchId, period },
    }),
  getProductPerformance: (branchId: number) =>
    api.get<ApiResponse<unknown[]>>("/analytics/products", {
      params: { branch_id: branchId },
    }),
  getHeatmap: (branchId: number) =>
    api.get<ApiResponse<unknown[]>>("/analytics/heatmap", {
      params: { branch_id: branchId },
    }),
  getDiscountAnalytics: (branchId: number) =>
    api.get<ApiResponse<unknown[]>>("/analytics/discounts", {
      params: { branch_id: branchId },
    }),
};

// ─── Users ───────────────────────────────────
export const userApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<unknown[]>>("/users", { params }),
  create: (data: unknown) => api.post<ApiResponse<unknown>>("/users", data),
  update: (id: number, data: unknown) =>
    api.put<ApiResponse<unknown>>(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  toggleStatus: (id: number) => api.patch(`/users/${id}/toggle`),
};

// ─── Branding ────────────────────────────────
export const brandingApi = {
  get: (rid: number) =>
    api.get<ApiResponse<unknown>>(`/restaurants/${rid}/branding`),
  update: (rid: number, data: unknown) =>
    api.put<ApiResponse<unknown>>(`/restaurants/${rid}/branding`, data),
  getForBranch: (restaurantId: number, branchId: number) =>
    api.get<ApiResponse<unknown>>(`/restaurants/${restaurantId}/branding`, {
      params: { branch_id: branchId },
    }),
  updateForBranch: (
    restaurantId: number,
    branchId: number,
    data: Record<string, unknown>,
  ) =>
    api.put<ApiResponse<unknown>>(`/restaurants/${restaurantId}/branding`, {
      ...data,
      branch_id: branchId,
    }),
  uploadLogoForBranch: (restaurantId: number, branchId: number, file: File) => {
    const form = new FormData();
    form.append("logo", file);
    form.append("branch_id", String(branchId));
    return api.post<ApiResponse<{ logo_url: string }>>(
      `/restaurants/${restaurantId}/logo`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  },
  uploadLogo: (rid: number, file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return api.post<ApiResponse<{ logo_url: string }>>(
      `/restaurants/${rid}/logo`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
  },
};

// ─── AI ──────────────────────────────────────
export const aiApi = {
  chat: (
    branchId: number,
    message: string,
    history: { role: string; content: string }[],
  ) =>
    api.post<
      ApiResponse<{
        reply: string;
        products?: unknown[];
        quick_replies?: string[];
      }>
    >("/ai/chat", { branch_id: branchId, message, history }),
};

// ─── Guest ───────────────────────────────────
export const guestApi = {
  init: (branchId: number) =>
    api.post<ApiResponse<{ guest_id: string }>>("/guest/init", {
      branch_id: branchId,
    }),
};

export const notificationApi = {
  getAll: () => api.get("/notifications"),
  readAll: () => api.patch("/notifications/read-all"),
  read: (id: number) => api.patch(`/notifications/${id}/read`),
};

export const subscriptionApi = {
  getAll: (params?: any) => api.get("/subscriptions", { params }),
  getExpiring: (days = 30) =>
    api.get("/subscriptions/expiring", { params: { days } }),
  create: (data: any) => api.post("/subscriptions", data),
  cancel: (id: number) => api.patch(`/subscriptions/${id}/cancel`),
  suspend: (id: number) => api.patch(`/subscriptions/${id}/suspend`),
  reactivate: (id: number) => api.patch(`/subscriptions/${id}/reactivate`),
};

export default api;
