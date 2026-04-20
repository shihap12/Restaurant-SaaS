import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Check, X, Search, RefreshCw } from "lucide-react";
import { orderApi } from "@/api";
import { useAuthStore, useBranchStore } from "@/store";
import type { Order, OrderStatus } from "@/types";
import { useBranchOrders } from "@/hooks/useWebSocket";
import { usePageTransition } from "@/hooks/useGSAP";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

// ─── Backend status flows ──────────────────────────────────────────────────
//
//  Dine-in:          pending → accepted → preparing → served → (checkout) → completed
//  Delivery/Pickup:  pending → accepted → preparing → ready  → delivered
//
//  Chef handles:     accepted → preparing  (all types)
//                    preparing → served    (dine-in only)
//  Cashier handles:  everything else
//
// ──────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: { label: "Pending", color: "#facc15", bg: "rgba(234,179,8,0.1)" },
  accepted: { label: "Accepted", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  preparing: {
    label: "Preparing",
    color: "#fb923c",
    bg: "rgba(249,115,22,0.1)",
  },
  ready: { label: "Ready", color: "#4ade80", bg: "rgba(34,197,94,0.1)" },
  served: { label: "Served", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  delivered: {
    label: "Delivered",
    color: "#a3a3a3",
    bg: "rgba(163,163,163,0.1)",
  },
  completed: {
    label: "Completed",
    color: "#a3a3a3",
    bg: "rgba(163,163,163,0.1)",
  },
  cancelled: {
    label: "Cancelled",
    color: "#f87171",
    bg: "rgba(239,68,68,0.1)",
  },
};

export default function CashierDashboard() {
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const queryClient = useQueryClient();
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const sym = currentBranch?.currency_symbol || "$";

  // ─── FIX: ref يعكس آخر قيمة لـ selectedOrder دائمًا ───────────────────
  // هذا يحل مشكلة الـ stale closure داخل event listeners
  const selectedOrderRef = useRef<Order | null>(null);
  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  const {
    data: orders = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["cashier-orders", branchId, filterStatus, search],
    queryFn: () =>
      orderApi.getAll(branchId, {
        status: filterStatus,
        search: search || undefined,
        today: true,
        per_page: 100,
      }),
    select: (res) => res.data.data as Order[],
    refetchInterval: 20000,
  });

  useBranchOrders({
    branchId,
    onNewOrder: () => {
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] });
      toast("New order received! 🔔");
    },
    onOrderUpdate: () =>
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] }),
  });

  // ─── FIX: استخدام selectedOrderRef بدلاً من selectedOrder داخل الـ listener
  // الـ dependency array فارغ لأننا نعتمد على الـ ref وليس الـ state مباشرة
  useEffect(() => {
    function handleOrderUpdate(e: any) {
      const payload = e?.detail;
      if (!payload || !payload.id) return;
      const id = payload.id as number;

      // دائمًا أعد تحميل قائمة الطلبات عند أي تحديث
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] });

      // إذا كان الطلب المحدَّث هو المفتوح حاليًا، اجلب بياناته الجديدة
      if (selectedOrderRef.current?.id === id) {
        orderApi
          .getById(id)
          .then((res) => {
            const fresh = res?.data?.data as Order | undefined;
            if (fresh) setSelectedOrder(fresh);
          })
          .catch(() => {
            // تجاهل أخطاء الشبكة بصمت
          });
      }
    }

    window.addEventListener(
      "restory:order:update",
      handleOrderUpdate as EventListener,
    );
    return () =>
      window.removeEventListener(
        "restory:order:update",
        handleOrderUpdate as EventListener,
      );
  }, []); // ← فارغ عن قصد — نعتمد على selectedOrderRef

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      orderApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] });
      setSelectedOrder((prev) =>
        prev?.id === vars.id
          ? { ...prev, status: vars.status as OrderStatus }
          : prev,
      );
      toast.success("Order updated!");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Failed to update order.";
      toast.error(msg);
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: ({
      id,
      payment_method,
    }: {
      id: number;
      payment_method: "cash" | "card";
    }) => orderApi.checkout(id, { payment_method }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] });
      setSelectedOrder((prev) =>
        prev?.id === vars.id
          ? {
              ...prev,
              payment_status: "paid",
              status: "completed" as OrderStatus,
            }
          : prev,
      );
      toast.success("Payment recorded. Order closed.");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Checkout failed.";
      toast.error(msg);
    },
  });

  // ─── Next action for cashier ───────────────────────────────────────────
  function getNextAction(
    order: Order,
  ): { label: string; color?: string; onClick: () => void } | null {
    const isDineIn = order.type === "dine_in";

    if (isDineIn) {
      switch (order.status) {
        case "pending":
          return {
            label: "Accept Order ✅",
            onClick: () =>
              updateStatus.mutate({ id: order.id, status: "accepted" }),
          };
        case "accepted":
          return {
            label: "Start Preparing 👨‍🍳",
            onClick: () =>
              updateStatus.mutate({ id: order.id, status: "preparing" }),
          };
        // preparing → served: CHEF's job — cashier waits
        // served → payment: shown via showPaymentButtons below
        default:
          return null;
      }
    } else {
      switch (order.status) {
        case "pending":
          return {
            label: "Accept Order ✅",
            onClick: () =>
              updateStatus.mutate({ id: order.id, status: "accepted" }),
          };
        case "accepted":
          return {
            label: "Start Preparing 👨‍🍳",
            onClick: () =>
              updateStatus.mutate({ id: order.id, status: "preparing" }),
          };
        case "preparing":
          return {
            label: "Mark Ready 📦",
            onClick: () =>
              updateStatus.mutate({ id: order.id, status: "ready" }),
          };
        case "ready":
          return {
            label: "Mark Delivered ✅",
            color: "#22c55e",
            onClick: () =>
              updateStatus.mutate({ id: order.id, status: "delivered" }),
          };
        default:
          return null;
      }
    }
  }

  // Payment buttons: dine-in only after chef marks served
  const showPaymentButtons = (order: Order) =>
    order.type === "dine_in" &&
    order.status === "served" &&
    order.payment_status !== "paid";

  const canCancel = (order: Order) =>
    ["pending", "accepted", "preparing"].includes(order.status);

  return (
    <div ref={pageRef} className="h-full flex gap-4 overflow-hidden">
      {/* Orders List */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order # or customer..."
              className="input pl-9 text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input text-sm w-auto py-2"
          >
            <option value="active">Active</option>
            <option value="">All Today</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="preparing">Preparing</option>
            <option value="served">Served</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => refetch()}
            className="btn btn-secondary btn-icon"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No orders found
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const isSelected = selectedOrder?.id === order.id;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`card p-4 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "border-[var(--brand-500)] bg-[rgba(var(--brand-rgb),0.04)]"
                      : "hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="font-mono font-bold text-sm"
                          style={{ color: "var(--text-primary)" }}
                        >
                          #{order.order_number}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                        {order.type === "dine_in" && order.table_number && (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Table {order.table_number}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-sm"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {order.customer_name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {order.items.length} item
                        {order.items.length !== 1 ? "s" : ""} ·{" "}
                        {formatDistanceToNow(new Date(order.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="font-bold font-display"
                        style={{ color: "var(--brand-400)" }}
                      >
                        {sym}
                        {order.total.toFixed(2)}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {order.type === "dine_in"
                          ? "🍽️ Dine-in"
                          : order.type === "delivery"
                            ? "🛵 Delivery"
                            : "🏃 Pickup"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Order Detail Panel */}
      <div className="w-80 flex-shrink-0 flex flex-col card p-5 overflow-y-auto">
        {!selectedOrder ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-10">
            <CreditCard
              size={32}
              className="mb-3"
              style={{ color: "var(--text-muted)" }}
            />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Select an order to view details
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3
                className="font-display font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                #{selectedOrder.order_number}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="btn btn-ghost btn-icon"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className="space-y-2 text-sm mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              <div className="flex justify-between">
                <span>Customer</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {selectedOrder.customer_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Type</span>
                <span>
                  {selectedOrder.type === "dine_in"
                    ? "🍽️ Dine-in"
                    : selectedOrder.type === "delivery"
                      ? "🛵 Delivery"
                      : "🏃 Pickup"}
                </span>
              </div>
              {selectedOrder.table_number && (
                <div className="flex justify-between">
                  <span>Table</span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {selectedOrder.table_number}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Status</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background:
                      STATUS_CONFIG[selectedOrder.status]?.bg ||
                      "rgba(163,163,163,0.1)",
                    color:
                      STATUS_CONFIG[selectedOrder.status]?.color || "#a3a3a3",
                  }}
                >
                  {STATUS_CONFIG[selectedOrder.status]?.label ||
                    selectedOrder.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="capitalize">
                  {selectedOrder.payment_method}
                </span>
              </div>
            </div>

            <div className="divider" />

            <div className="space-y-2 mb-4 flex-1">
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span style={{ color: "var(--text-secondary)" }}>
                    {item.quantity}× {item.product_name}
                  </span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {sym}
                    {item.total_price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="divider" />
            <div className="flex justify-between font-bold">
              <span style={{ color: "var(--text-primary)" }}>Total</span>
              <span style={{ color: "var(--brand-400)" }}>
                {sym}
                {selectedOrder.total.toFixed(2)}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {/* Primary action */}
              {(() => {
                const action = getNextAction(selectedOrder);
                if (!action) return null;
                return (
                  <button
                    onClick={action.onClick}
                    className="btn btn-primary w-full gap-2 text-sm"
                    style={action.color ? { background: action.color } : {}}
                  >
                    <Check size={15} /> {action.label}
                  </button>
                );
              })()}

              {/* Waiting for chef — dine-in preparing */}
              {selectedOrder.type === "dine_in" &&
                selectedOrder.status === "preparing" && (
                  <div
                    className="text-xs text-center py-2 rounded-lg"
                    style={{
                      background: "rgba(var(--brand-rgb),0.08)",
                      color: "var(--brand-300)",
                    }}
                  >
                    👨‍🍳 Waiting for chef to mark as served…
                  </div>
                )}

              {/* Payment buttons — dine-in after served */}
              {showPaymentButtons(selectedOrder) && (
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      checkoutMutation.mutate({
                        id: selectedOrder.id,
                        payment_method: "cash",
                      })
                    }
                    className="btn btn-primary flex-1 text-sm"
                  >
                    Pay Cash 💵
                  </button>
                  <button
                    onClick={() =>
                      checkoutMutation.mutate({
                        id: selectedOrder.id,
                        payment_method: "card",
                      })
                    }
                    className="btn btn-secondary flex-1 text-sm"
                  >
                    Pay Card 💳
                  </button>
                </div>
              )}

              {/* Cancel */}
              {canCancel(selectedOrder) && (
                <button
                  onClick={() =>
                    updateStatus.mutate({
                      id: selectedOrder.id,
                      status: "cancelled",
                    })
                  }
                  className="btn btn-danger w-full gap-2 text-sm"
                >
                  <X size={15} /> Cancel Order
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}