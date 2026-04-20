/* ============================================
   RESTORY — COMPLETE TYPE DEFINITIONS
   ============================================ */

// ─── ENUMS ──────────────────────────────────

export type UserRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "cashier"
  | "chef"
  | "customer"
  | "guest";

// ─── Order status ─────────────────────────────
//
//  Dine-in:          pending → accepted → preparing → served → completed
//  Delivery/Pickup:  pending → accepted → preparing → ready  → delivered
//
export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "served"           // dine-in only: chef marks food delivered to table
  | "ready"            // delivery/pickup only: order ready for collection
  | "delivered"        // delivery/pickup final state
  | "completed"        // dine-in final state (after payment via /checkout)
  | "cancelled";

export type OrderType = "dine_in" | "delivery" | "pickup";

export type PaymentMethod = "card" | "cash";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type ProductStatus = "active" | "inactive" | "out_of_stock";

export type DiscountType = "percentage" | "fixed";

export type Theme = "dark" | "light" | "warm" | "ocean" | "custom";

// ─── BRANCH ──────────────────────────────────

export interface Branch {
  id: number;
  restaurant_id: number;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
  timezone: string;
  currency: string;
  currency_symbol: string;
  is_active: boolean;
  is_accepting_orders: boolean;
  opening_hours: OpeningHours[];
  settings: BranchSettings;
  restaurant?: Partial<Restaurant>;
  created_at: string;
  updated_at: string;
}

export interface BranchSettings {
  min_order_amount: number;
  delivery_radius_km: number;
  delivery_fee: number;
  free_delivery_above: number;
  estimated_prep_time: number;
  estimated_delivery_time: number;
  allow_scheduling: boolean;
  max_orders_per_hour: number;
}

export interface OpeningHours {
  day: number; // 0=Sunday, 6=Saturday
  open: string;
  close: string;
  is_closed: boolean;
}

// ─── RESTAURANT ──────────────────────────────

export interface Restaurant {
  id: number;
  owner_id: number;
  name: string;
  slug: string;
  logo: string | null;
  cover_image: string | null;
  description: string;
  cuisine_type: string;
  branding: RestaurantBranding;
  branches: Branch[];
  created_at: string;
}

export interface RestaurantBranding {
  theme: Theme;
  primary_color: string;
  font_display: string;
  font_body: string;
  custom_css?: string;
  logo_url?: string;
  favicon_url?: string;
  tagline?: string;
  about_text?: string;
  contact_email?: string;
  contact_phone?: string;
  social_links?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
  };
}

// ─── USER ────────────────────────────────────

export interface User {
  id: number;
  branch_id: number | null;
  restaurant_id: number | null;
  role: UserRole;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface GuestSession {
  guest_id: string;
  branch_id: number;
  created_at: string;
  order_count: number;
}

// ─── CATEGORY ────────────────────────────────

export interface Category {
  id: number;
  branch_id: number;
  restaurant_id: number;
  name: string;
  name_ar: string | null;
  description: string | null;
  image: string | null;
  sort_order: number;
  is_active: boolean;
  products_count: number;
  created_at: string;
}

// ─── PRODUCT ─────────────────────────────────

export interface Product {
  id: number;
  branch_id: number;
  restaurant_id: number;
  category_id: number;
  category?: Category;
  name: string;
  name_ar: string | null;
  description: string;
  description_ar: string | null;
  price: number;
  image: string | null;
  images: string[];
  ingredients: Ingredient[];
  allergens: string[];
  status: ProductStatus;
  is_featured: boolean;
  is_new: boolean;
  calories: number | null;
  preparation_time: number | null;
  sort_order: number;
  ratings_avg: number;
  ratings_count: number;
  variants: ProductVariant[];
  addons: ProductAddon[];
  created_at: string;
}

export interface Ingredient {
  name: string;
  name_ar?: string;
  is_allergen: boolean;
}

export interface ProductVariant {
  id: number;
  name: string;
  price_modifier: number;
  is_default: boolean;
}

export interface ProductAddon {
  id: number;
  name: string;
  price: number;
  max_quantity: number;
}

// ─── CART ────────────────────────────────────

export interface CartItem {
  id: string; // local uuid
  product_id: number;
  product: Product;
  quantity: number;
  selected_variant?: ProductVariant;
  selected_addons: ProductAddon[];
  special_instructions?: string;
  unit_price: number;
  total_price: number;
}

export interface Cart {
  branch_id: number | null;
  items: CartItem[];
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  coupon_id?: number | null;
  applied_coupon?: Coupon;
  order_type: OrderType;
}

// ─── ORDER ────────────────────────────────────

export interface Order {
  id: number;
  branch_id: number;
  branch?: Branch;
  user_id: number | null;
  guest_id: string | null;
  order_number: string;
  type: OrderType;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  table_number: string | null;
  special_instructions: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  delivery_fee: number;
  tax: number;
  total: number;
  coupon_id: number | null;
  coupon?: Coupon;
  estimated_ready_at: string | null;
  accepted_at: string | null;
  served_at: string | null;    // dine-in: when chef marked served
  ready_at: string | null;     // delivery/pickup: when marked ready
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product?: Product;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_name: string | null;
  addons: string[];
  special_instructions: string | null;
}

// ─── DISCOUNT / COUPON ────────────────────────

export interface Coupon {
  id: number;
  branch_id: number;
  code: string;
  type: DiscountType;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  description: string | null;
  qr_code_url: string | null;
}

// ─── ANALYTICS ────────────────────────────────

export interface AnalyticsOverview {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  guest_orders: number;
  registered_orders: number;
  cancelled_orders: number;
  period: "day" | "week" | "month" | "year";
  comparison: {
    revenue_change: number;
    orders_change: number;
  };
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface ProductPerformance {
  product_id: number;
  product_name: string;
  product_image: string | null;
  total_orders: number;
  total_revenue: number;
  avg_rating: number;
}

export interface HeatmapData {
  hour: number;
  day: number;
  order_count: number;
}

export interface DiscountAnalytics {
  coupon_code: string;
  usage_count: number;
  total_discount: number;
  revenue_generated: number;
}

// ─── AI CHATBOT ──────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggested_products?: Product[];
  quick_replies?: string[];
}

export interface AIContext {
  branch_id: number;
  cart_items: CartItem[];
  recent_orders: Order[];
  active_offers: Coupon[];
}

// ─── REALTIME ────────────────────────────────

export interface RealtimeOrderEvent {
  order_id: number;
  order_number: string;
  status: OrderStatus;
  type: OrderType;
  customer_name: string;
  table_number: string | null;
  total: number;
  timestamp: string;
}

// ─── PAGINATION ──────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links: {
    prev: string | null;
    next: string | null;
  };
}

// ─── API RESPONSE ─────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

// ─── FORM TYPES ──────────────────────────────

export interface DineInFormData {
  customer_name: string;
  table_number: string;
  special_instructions?: string;
}

export interface DeliveryFormData {
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  special_instructions?: string;
}

export interface PickupFormData {
  customer_name: string;
  phone: string;
  special_instructions?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  remember: boolean;
}

// ─── STOCK ───────────────────────────────────

export interface StockItem {
  id: number;
  branch_id: number;
  product_id: number;
  product?: Product;
  quantity: number;
  min_threshold: number;
  unit: string;
  last_updated: string;
  is_low_stock: boolean;
}

// ─── STAFF ───────────────────────────────────

export interface StaffMember {
  id: number;
  branch_id: number;
  user: User;
  shift_start: string | null;
  shift_end: string | null;
  is_on_duty: boolean;
}

// ─── NOTIFICATION ────────────────────────────

export interface Notification {
  id: number;
  user_id: number;
  branch_id: number | null;
  type: "new_order" | "order_ready" | "low_stock" | "new_coupon" | "system";
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ─── THEME ENGINE ─────────────────────────────

export interface ThemeConfig {
  theme: Theme;
  primary_color: string;
  primary_color_dark?: string;
  font_display: string;
  font_body: string;
  custom_css?: string;
}