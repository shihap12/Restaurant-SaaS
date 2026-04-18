import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Check, X, Search, RefreshCw } from "lucide-react";
import { orderApi } from "@/api";
import { useAuthStore, useBranchStore } from "@/store";
import type { Order, OrderStatus } from "@/types";
import { useBranchOrders } from "@/hooks/useWebSocket";
import { usePageTransition } from "@/hooks/useGSAP";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

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
  delivered: {
    label: "Delivered",
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

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      orderApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] });
      if (selectedOrder?.id === vars.id) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, status: vars.status as OrderStatus } : null,
        );
      }
      toast.success("Order updated!");
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
      if (selectedOrder?.id === vars.id) {
        setSelectedOrder((prev) =>
          prev
            ? { ...prev, payment_status: "paid", status: "delivered" }
            : null,
        );
      }
      toast.success("Payment recorded. Order closed.");
    },
  });

  return (
    <div ref={pageRef} className="h-full flex gap-4 overflow-hidden">
      {/* Orders List */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
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
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
          </select>

          <button
            onClick={() => refetch()}
            className="btn btn-secondary btn-icon"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Orders */}
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
                        className="text-xs capitalize"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {order.payment_method}
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
                <span className="capitalize">
                  {selectedOrder.type.replace("_", "-")}
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
                <span>Payment</span>
                <span className="capitalize">
                  {selectedOrder.payment_method}
                </span>
              </div>
            </div>

            <div className="divider" />

            {/* Items */}
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

            {/* Actions */}
            <div className="mt-4 space-y-2">
              {selectedOrder.status === "pending" && (
                <button
                  onClick={() =>
                    updateStatus.mutate({
                      id: selectedOrder.id,
                      status: "accepted",
                    })
                  }
                  className="btn btn-primary w-full gap-2 text-sm"
                >
                  <Check size={15} /> Accept Order
                </button>
              )}
              {selectedOrder.status === "ready" && (
                <button
                  onClick={() =>
                    updateStatus.mutate({
                      id: selectedOrder.id,
                      status: "delivered",
                    })
                  }
                  className="btn btn-primary w-full gap-2 text-sm"
                  style={{ background: "#22c55e" }}
                >
                  <Check size={15} /> Mark Delivered / Served
                </button>
              )}

              {/* For dine-in: allow cashier to record payment and close order */}
              {selectedOrder.type === "dine_in" &&
                selectedOrder.payment_status !== "paid" && (
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
                      Pay Cash
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
                      Pay Card
                    </button>
                  </div>
                )}
              {["pending", "accepted"].includes(selectedOrder.status) && (
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
