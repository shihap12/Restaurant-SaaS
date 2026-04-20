import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { usePageTransition } from "@/hooks/useGSAP";
import { orderApi } from "@/api";
import { useAuthStore, useBranchStore } from "@/store";
import type { Order } from "@/types";
import { formatDistanceToNow } from "date-fns";

// ─── Backend status colours ───────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:            "#facc15",
  accepted:           "#60a5fa",
  preparing:          "var(--brand-400)",
  ready:              "#4ade80",
  served:             "#a78bfa",
  checkout_requested: "#f472b6",
  delivered:          "#a3a3a3",
  completed:          "#a3a3a3",
  cancelled:          "#f87171",
};

const STATUS_LABELS: Record<string, string> = {
  pending:            "Pending",
  accepted:           "Accepted",
  preparing:          "Preparing",
  ready:              "Ready",
  served:             "Served",
  checkout_requested: "Bill Requested",
  delivered:          "Delivered",
  completed:          "Completed",
  cancelled:          "Cancelled",
};

// ─── Next-status helpers matching backend transitions ─────────────────────
//
//  Dine-in:   pending → preparing → served → checkout_requested → completed
//  Others:    pending → accepted  → preparing → ready → delivered
//
function getNextStatus(order: Order): string | null {
  if (order.type === "dine_in") {
    const map: Record<string, string> = {
      pending:   "preparing",
      preparing: "served",
      served:    "checkout_requested",
    };
    return map[order.status] ?? null;
  }
  const map: Record<string, string> = {
    pending:   "accepted",
    accepted:  "preparing",
    preparing: "ready",
    ready:     "delivered",
  };
  return map[order.status] ?? null;
}

function getNextLabel(order: Order): string | null {
  const next = getNextStatus(order);
  if (!next) return null;
  const labels: Record<string, string> = {
    preparing:          "Prepare",
    served:             "Served",
    checkout_requested: "Bill",
    accepted:           "Accept",
    ready:              "Ready",
    delivered:          "Done ✅",
  };
  return labels[next] ?? next;
}

export default function ManagerOrders() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const queryClient = useQueryClient();
  const sym = currentBranch?.currency_symbol || "$";
  const [statusFilter, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["manager-orders", branchId, statusFilter, search],
    queryFn: () =>
      orderApi.getAll(branchId, {
        status: statusFilter || undefined,
        search: search || undefined,
        today: !statusFilter,
      }),
    select: (res) => res.data.data as Order[],
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      orderApi.updateStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["manager-orders", branchId] }),
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Failed to update order.";
      console.error(msg);
    },
  });

  // Backend: only super_admin, owner, cashier, chef can change statuses
  const canUpdate = ["super_admin", "owner", "cashier", "chef"].includes(
    user?.role || "",
  );

  return (
    <div ref={pageRef} className="space-y-5">
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-display font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Orders
        </h1>
        <div
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="status-dot live" /> Live
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer..."
            className="input pl-9 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatus(e.target.value)}
          className="input text-sm w-auto py-2"
        >
          <option value="">Today</option>
          {[
            "pending",
            "accepted",
            "preparing",
            "ready",
            "served",
            "checkout_requested",
            "delivered",
            "completed",
            "cancelled",
          ].map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  "Order #",
                  "Customer",
                  "Type",
                  "Items",
                  "Total",
                  "Status",
                  "Time",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const nextStatus = getNextStatus(order);
                const nextLabel = getNextLabel(order);
                return (
                  <tr
                    key={order.id}
                    style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-[var(--surface-3)] transition-colors"
                  >
                    <td
                      className="px-4 py-3 font-mono font-bold text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      #{order.order_number}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {order.customer_name}
                      {order.table_number && (
                        <span style={{ color: "var(--text-muted)" }}>
                          {" "}
                          · T{order.table_number}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-xs capitalize"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {order.type === "dine_in"
                        ? "🍽️ Dine-in"
                        : order.type === "delivery"
                          ? "🛵 Delivery"
                          : "🏃 Pickup"}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {order.items.length}
                    </td>
                    <td
                      className="px-4 py-3 font-bold"
                      style={{ color: "var(--brand-400)" }}
                    >
                      {sym}
                      {order.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="badge text-xs"
                        style={{
                          background: `${STATUS_COLORS[order.status] ?? "#a3a3a3"}18`,
                          color: STATUS_COLORS[order.status] ?? "#a3a3a3",
                          border: `1px solid ${STATUS_COLORS[order.status] ?? "#a3a3a3"}30`,
                        }}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatDistanceToNow(new Date(order.created_at), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {canUpdate && nextStatus && nextLabel && (
                        <button
                          onClick={() =>
                            updateStatus.mutate({
                              id: order.id,
                              status: nextStatus,
                            })
                          }
                          className="btn btn-primary btn-sm text-xs"
                        >
                          {nextLabel}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div
              className="py-12 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              No orders found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}