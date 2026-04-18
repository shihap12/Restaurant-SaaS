import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Edit2,
  BarChart3,
  Phone,
  X,
  Save,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { usePageTransition } from "@/hooks/useGSAP";
import { branchApi, analyticsApi } from "@/api";
import type { Branch } from "@/types";
import toast from "react-hot-toast";

// ─── Edit Branch Modal ────────────────────────────────────────
function EditBranchModal({
  branch,
  onClose,
}: {
  branch: Branch;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: branch.name,
    address: branch.address,
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    currency: branch.currency,
    currency_symbol: branch.currency_symbol,
    timezone: branch.timezone,
    is_accepting_orders: branch.is_accepting_orders,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Branch>) => branchApi.update(branch.id, data),
    onSuccess: () => {
      toast.success("Branch updated!");
      qc.invalidateQueries({ queryKey: ["owner-branches"] });
      onClose();
    },
    onError: () => toast.error("Failed to update branch"),
  });

  const set = (key: string, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-5"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-display font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Edit Branch
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Branch Name</label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="input"
                placeholder="Main Branch"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="input"
                placeholder="+966..."
              />
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className="input"
              placeholder="Street, City"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="input"
              placeholder="branch@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Currency Code</label>
              <input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
                className="input"
                placeholder="SAR"
                maxLength={3}
              />
            </div>
            <div>
              <label className="label">Currency Symbol</label>
              <input
                value={form.currency_symbol}
                onChange={(e) => set("currency_symbol", e.target.value)}
                className="input"
                placeholder="﷼"
              />
            </div>
          </div>

          {/* Toggle accepting orders */}
          <div
            className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: "var(--surface-3)" }}
          >
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Accepting Orders
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Customers can place orders from this branch
              </p>
            </div>
            <button
              onClick={() =>
                set("is_accepting_orders", !form.is_accepting_orders)
              }
              className={`relative w-12 h-6 rounded-full transition-colors ${
                form.is_accepting_orders
                  ? "bg-green-500"
                  : "bg-[var(--surface-4)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.is_accepting_orders ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="btn btn-primary flex-1 gap-2"
          >
            {mutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Drawer ─────────────────────────────────────────
function BranchAnalyticsDrawer({
  branch,
  onClose,
}: {
  branch: Branch;
  onClose: () => void;
}) {
  const sym = branch.currency_symbol || "$";

  const { data: overview, isLoading } = useQuery({
    queryKey: ["branch-analytics-overview", branch.id],
    queryFn: async () =>
      (await analyticsApi.getOverview(branch.id, "week")).data
        .data as import("@/types").AnalyticsOverview,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ["branch-analytics-products", branch.id],
    queryFn: () => analyticsApi.getProductPerformance(branch.id),
    select: (res) => (res.data.data as any[]).slice(0, 5),
  });

  const stats = [
    {
      label: "Revenue (7d)",
      value: overview
        ? `${sym}${Number(overview.total_revenue).toLocaleString()}`
        : "—",
      icon: <DollarSign size={16} />,
      color: "#4ade80",
    },
    {
      label: "Orders (7d)",
      value: overview?.total_orders ?? "—",
      icon: <ShoppingBag size={16} />,
      color: "var(--brand-400)",
    },
    {
      label: "Avg Order",
      value: overview
        ? `${sym}${Number(overview.avg_order_value).toFixed(2)}`
        : "—",
      icon: <TrendingUp size={16} />,
      color: "#60a5fa",
    },
    {
      label: "Customers",
      value: overview?.total_customers ?? "—",
      icon: <Clock size={16} />,
      color: "#a78bfa",
    },
  ];

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Drawer */}
      <div
        className="w-full max-w-md h-full overflow-y-auto p-6 space-y-6"
        style={{
          background: "var(--surface-1)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2
              className="text-lg font-display font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {branch.name}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Last 7 days analytics
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <X size={16} />
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          {branch.is_accepting_orders ? (
            <>
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-sm text-green-400">Accepting Orders</span>
            </>
          ) : (
            <>
              <XCircle size={14} className="text-red-400" />
              <span className="text-sm text-red-400">Not Accepting Orders</span>
            </>
          )}
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: "var(--text-muted)" }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s, i) => (
              <div key={i} className="card p-4 space-y-2">
                <div
                  className="flex items-center gap-2"
                  style={{ color: s.color }}
                >
                  {s.icon}
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {s.label}
                  </span>
                </div>
                <p
                  className="text-xl font-display font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Top Products */}
        {topProducts.length > 0 && (
          <div>
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              Top Products
            </h3>
            <div className="space-y-2">
              {topProducts.map((p: any, i: number) => (
                <div
                  key={p.product_id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    className="text-xs font-mono w-4"
                    style={{ color: "var(--text-muted)" }}
                  >
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {p.product_name}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {p.total_orders} orders
                    </p>
                  </div>
                  <span
                    className="text-sm font-bold"
                    style={{ color: "var(--brand-400)" }}
                  >
                    {sym}
                    {Number(p.total_revenue).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div
          className="space-y-2 pt-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {branch.phone && (
            <p
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <Phone size={13} /> {branch.phone}
            </p>
          )}
          <p
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <Globe size={13} /> {branch.currency} {branch.currency_symbol}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Timezone: {branch.timezone}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function OwnerBranches() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);

  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [analyticsBranch, setAnalyticsBranch] = useState<Branch | null>(null);

  const { data: branches = [] } = useQuery({
    queryKey: ["owner-branches"],
    queryFn: () => branchApi.getAll(),
    select: (res) => res.data.data as Branch[],
  });

  return (
    <>
      <div ref={pageRef} className="space-y-5">
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-display font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            My Branches
          </h1>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {branches.length} branch{branches.length !== 1 ? "es" : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <div key={branch.id} className="card p-5 space-y-3">
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <h3
                    className="font-display font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {branch.name}
                  </h3>
                  <p
                    className="text-xs mt-0.5 truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {branch.address}
                  </p>
                </div>
                <span
                  className={`badge flex-shrink-0 ${
                    branch.is_accepting_orders
                      ? "badge-success"
                      : "badge-neutral"
                  }`}
                >
                  {branch.is_accepting_orders ? "Open" : "Closed"}
                </span>
              </div>

              {/* Info */}
              <div
                className="text-sm space-y-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {branch.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone size={12} /> {branch.phone}
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <Globe size={12} /> {branch.currency} {branch.currency_symbol}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditBranch(branch)}
                  className="btn btn-secondary btn-sm flex-1 gap-1"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  onClick={() => setAnalyticsBranch(branch)}
                  className="btn btn-ghost btn-sm btn-icon"
                  title="View analytics"
                >
                  <BarChart3 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editBranch && (
        <EditBranchModal
          branch={editBranch}
          onClose={() => setEditBranch(null)}
        />
      )}

      {/* Analytics Drawer */}
      {analyticsBranch && (
        <BranchAnalyticsDrawer
          branch={analyticsBranch}
          onClose={() => setAnalyticsBranch(null)}
        />
      )}
    </>
  );
}
