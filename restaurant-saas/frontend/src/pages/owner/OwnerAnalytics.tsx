import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Tag,
} from "lucide-react";
import { analyticsApi } from "@/api";
import { useAuthStore, useBranchStore } from "@/store";
import type {
  AnalyticsOverview,
  RevenueDataPoint,
  ProductPerformance,
  HeatmapData,
} from "@/types";
import { usePageTransition } from "@/hooks/useGSAP";

type Period = "day" | "week" | "month" | "year";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`,
);

export default function OwnerAnalytics() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);

  const { user } = useAuthStore();
  const { currentBranch, branches } = useBranchStore();
  const [period, setPeriod] = useState<Period>("week");
  const [selectedBranch, setSelectedBranch] = useState<number>(
    currentBranch?.id || 0,
  );

  const branchId = selectedBranch || currentBranch?.id || 1;

  const { data: overview } = useQuery({
    queryKey: ["analytics-overview", branchId, period],
    queryFn: () => analyticsApi.getOverview(branchId, period),
    select: (res) => res.data.data as AnalyticsOverview,
  });

  const { data: revenue = [] } = useQuery({
    queryKey: ["analytics-revenue", branchId, period],
    queryFn: () => analyticsApi.getRevenue(branchId, period),
    select: (res) => res.data.data as RevenueDataPoint[],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["analytics-products", branchId],
    queryFn: () => analyticsApi.getProductPerformance(branchId),
    select: (res) => res.data.data as ProductPerformance[],
  });

  const { data: heatmap = [] } = useQuery({
    queryKey: ["analytics-heatmap", branchId],
    queryFn: () => analyticsApi.getHeatmap(branchId),
    select: (res) => res.data.data as HeatmapData[],
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["analytics-discounts", branchId],
    queryFn: () => analyticsApi.getDiscountAnalytics(branchId),
    select: (res) => res.data.data as any[],
  });

  const sym = currentBranch?.currency_symbol || "$";

  const pieData = overview
    ? [
        {
          name: "Guests",
          value: overview.guest_orders,
          color: "var(--brand-400)",
        },
        {
          name: "Registered",
          value: overview.registered_orders,
          color: "#60a5fa",
        },
      ]
    : [];

  const customerPieData = overview
    ? [
        { name: "New", value: overview.new_customers, color: "#4ade80" },
        {
          name: "Returning",
          value: overview.returning_customers,
          color: "#a78bfa",
        },
      ]
    : [];

  // Build heatmap grid (24 hours × 7 days)
  const heatmapGrid = DAYS.map((_, day) =>
    HOURS.map((_, hour) => {
      const found = heatmap.find((h) => h.day === day && h.hour === hour);
      return found?.order_count || 0;
    }),
  );
  const maxHeat = Math.max(...heatmapGrid.flat(), 1);

  return (
    <div ref={pageRef} className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1
          className="text-2xl font-display font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Analytics
        </h1>

        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(Number(e.target.value))}
              className="input py-2 text-sm w-auto"
            >
              <option value={0}>All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
            {(["day", "week", "month", "year"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-2 text-sm font-medium transition-colors capitalize ${
                  period === p
                    ? "brand-gradient text-white"
                    : "hover:bg-[var(--surface-3)]"
                }`}
                style={
                  period !== p
                    ? {
                        color: "var(--text-secondary)",
                        background: "var(--surface-2)",
                      }
                    : {}
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Revenue",
            value: overview?.total_revenue || 0,
            icon: <DollarSign size={18} />,
            format: (v: number) =>
              `${sym}${v.toLocaleString("en", { maximumFractionDigits: 0 })}`,
            change: overview?.comparison.revenue_change || 0,
            color: "#4ade80",
          },
          {
            label: "Total Orders",
            value: overview?.total_orders || 0,
            icon: <ShoppingBag size={18} />,
            format: (v: number) => v.toLocaleString(),
            change: overview?.comparison.orders_change || 0,
            color: "var(--brand-400)",
          },
          {
            label: "Avg Order Value",
            value: overview?.avg_order_value || 0,
            icon: <TrendingUp size={18} />,
            format: (v: number) => `${sym}${v.toFixed(2)}`,
            change: 0,
            color: "#60a5fa",
          },
          {
            label: "Customers",
            value: overview?.total_customers || 0,
            icon: <Users size={18} />,
            format: (v: number) => v.toLocaleString(),
            change: 0,
            color: "#a78bfa",
          },
        ].map((stat, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-2.5 rounded-xl"
                style={{ background: `${stat.color}18`, color: stat.color }}
              >
                {stat.icon}
              </div>
              {stat.change !== 0 && (
                <div
                  className={`flex items-center gap-1 text-xs font-medium ${
                    stat.change > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {stat.change > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  {Math.abs(stat.change).toFixed(1)}%
                </div>
              )}
            </div>
            <p
              className="text-2xl font-display font-bold mb-0.5"
              style={{ color: "var(--text-primary)" }}
            >
              {stat.format(stat.value)}
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="card p-6">
        <h2
          className="text-base font-semibold mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Revenue Over Time
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={revenue}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--brand-500)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--brand-500)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${sym}${v}`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
              formatter={(val: any) => {
                const num = typeof val === "number" ? val : Number(val);
                const str = Number.isFinite(num) ? num.toFixed(2) : "0.00";
                return [`${sym}${str}`, "Revenue"];
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--brand-500)"
              strokeWidth={2.5}
              fill="url(#revenueGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 2-col row: Top Products + Customer Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="card p-6">
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Top Selling Products
          </h2>
          <div className="space-y-3">
            {products.slice(0, 6).map((p, i) => (
              <div key={p.product_id} className="flex items-center gap-3">
                <span
                  className="text-xs font-mono w-5"
                  style={{ color: "var(--text-muted)" }}
                >
                  #{i + 1}
                </span>
                <div
                  className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
                  style={{ background: "var(--surface-3)" }}
                >
                  {p.product_image ? (
                    <img
                      src={p.product_image}
                      alt={p.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm">
                      🍽️
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.product_name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div
                      className="flex-1 h-1 rounded-full overflow-hidden"
                      style={{ background: "var(--surface-4)" }}
                    >
                      <div
                        className="h-full rounded-full brand-gradient"
                        style={{
                          width: `${(p.total_orders / (products[0]?.total_orders || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {p.total_orders}
                    </span>
                  </div>
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: "var(--brand-400)" }}
                >
                  {sym}
                  {p.total_revenue.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Mix */}
        <div className="card p-6">
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Customer Insights
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p
                className="text-xs mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Guest vs Registered
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {pieData.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center gap-2 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: d.color }}
                    />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p
                className="text-xs mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                New vs Returning
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={customerPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {customerPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {customerPieData.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center gap-2 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: d.color }}
                    />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Peak Hours Heatmap */}
      <div className="card p-6">
        <h2
          className="text-base font-semibold mb-5"
          style={{ color: "var(--text-primary)" }}
        >
          Peak Hours Heatmap
        </h2>
        <div className="overflow-x-auto scroll-x">
          <div style={{ minWidth: 700 }}>
            {/* Hours header */}
            <div className="flex mb-2">
              <div className="w-10 flex-shrink-0" />
              {HOURS.filter((_, i) => i % 2 === 0).map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {h}
                </div>
              ))}
            </div>
            {/* Rows */}
            {DAYS.map((day, dayIdx) => (
              <div key={day} className="flex items-center mb-1">
                <div
                  className="w-10 text-xs flex-shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  {day}
                </div>
                <div className="flex gap-0.5 flex-1">
                  {heatmapGrid[dayIdx].map((count, hourIdx) => {
                    const intensity = count / maxHeat;
                    return (
                      <div
                        key={hourIdx}
                        title={`${day} ${HOURS[hourIdx]}: ${count} orders`}
                        className="flex-1 h-6 rounded-sm transition-all"
                        style={{
                          background:
                            count === 0
                              ? "var(--surface-3)"
                              : `rgba(var(--brand-rgb), ${0.1 + intensity * 0.9})`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Low
          </span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
              <div
                key={v}
                className="w-6 h-3 rounded-sm"
                style={{ background: `rgba(var(--brand-rgb), ${v})` }}
              />
            ))}
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            High
          </span>
        </div>
      </div>

      {/* Discount Analytics */}
      {discounts.length > 0 && (
        <div className="card p-6">
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Coupon Performance
          </h2>
          <div className="space-y-3">
            {discounts.map((d: any) => (
              <div
                key={d.coupon_code}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "var(--surface-3)" }}
              >
                <Tag size={16} style={{ color: "var(--brand-400)" }} />
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {d.coupon_code}
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {d.usage_count} uses
                </span>
                <span className="text-sm ml-auto text-green-400">
                  −{sym}
                  {d.total_discount.toFixed(2)} discount
                </span>
                <span className="text-sm" style={{ color: "var(--brand-400)" }}>
                  {sym}
                  {d.revenue_generated.toFixed(2)} revenue
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
