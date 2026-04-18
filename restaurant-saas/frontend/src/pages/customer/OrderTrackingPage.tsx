import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Package,
  Home,
  ArrowLeft,
} from "lucide-react";
import { orderApi } from "@/api";
import type { Order, OrderStatus } from "@/types";
import { useOrderTracking } from "@/hooks/useWebSocket";
import { usePageTransition } from "@/hooks/useGSAP";
import gsap from "gsap";

const STATUS_STEPS: {
  status: OrderStatus;
  label: string;
  icon: React.ReactNode;
  desc: string;
}[] = [
  {
    status: "pending",
    label: "Order Placed",
    icon: <Clock size={20} />,
    desc: "Waiting for confirmation",
  },
  {
    status: "accepted",
    label: "Accepted",
    icon: <CheckCircle2 size={20} />,
    desc: "Restaurant confirmed your order",
  },
  {
    status: "preparing",
    label: "Preparing",
    icon: <ChefHat size={20} />,
    desc: "Our chefs are cooking your meal",
  },
  {
    status: "ready",
    label: "Ready",
    icon: <Package size={20} />,
    desc: "Your order is ready!",
  },
  {
    status: "delivered",
    label: "Delivered",
    icon: <Home size={20} />,
    desc: "Enjoy your meal! 🎉",
  },
];

export default function OrderTrackingPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);

  const [currentStatus, setCurrentStatus] = useState<OrderStatus>("pending");
  const [eta, setEta] = useState<string | null>(null);

  const { data: order, refetch } = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: () => orderApi.getOrderByNumber(orderNumber!),
    select: (res) => res.data.data as Order,
    enabled: !!orderNumber,
  });

  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status);

      // Sync active_order in localStorage
      const doneStatuses = ["delivered", "cancelled"];
      try {
        if (doneStatuses.includes(order.status)) {
          localStorage.removeItem("active_order");
          // notify same-tab listeners
          try {
            window.dispatchEvent(
              new CustomEvent("active_order_changed", {
                detail: { status: order.status },
              }),
            );
          } catch {}
        } else {
          const active: Record<string, any> = {
            orderNumber: order.order_number,
            status: order.status,
          };
          if (order.branch && order.branch.slug)
            active.slug = order.branch.slug;
          localStorage.setItem("active_order", JSON.stringify(active));
          try {
            window.dispatchEvent(
              new CustomEvent("active_order_changed", { detail: active }),
            );
          } catch {}
        }
      } catch {}
    }
  }, [order]);

  // Real-time tracking
  useOrderTracking({
    orderNumber: orderNumber || "",
    onStatusChange: (status, newEta) => {
      setCurrentStatus(status);
      if (newEta) setEta(newEta);
      refetch();

      // Update localStorage for active order status
      try {
        const doneStatuses = ["delivered", "cancelled"];
        if (doneStatuses.includes(status)) {
          localStorage.removeItem("active_order");
          try {
            window.dispatchEvent(
              new CustomEvent("active_order_changed", { detail: { status } }),
            );
          } catch {}
        } else {
          const saved = localStorage.getItem("active_order");
          if (saved) {
            const parsed = JSON.parse(saved);
            localStorage.setItem(
              "active_order",
              JSON.stringify({ ...parsed, status }),
            );
            try {
              window.dispatchEvent(
                new CustomEvent("active_order_changed", {
                  detail: { ...parsed, status },
                }),
              );
            } catch {}
          }
        }
      } catch {}

      // Animate the step
      const stepEl = document.querySelector(`[data-step="${status}"]`);
      if (stepEl) {
        gsap.fromTo(
          stepEl,
          { scale: 1.15 },
          { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.5)" },
        );
      }
    },
  });

  const currentStepIndex = STATUS_STEPS.findIndex(
    (s) => s.status === currentStatus,
  );
  const sym = order?.branch?.currency_symbol || "$";

  const backTo = order?.branch?.slug ? `/${order.branch.slug}` : "/";

  return (
    <div
      ref={pageRef}
      className="min-h-screen py-10"
      style={{ background: "var(--surface)" }}
    >
      <div className="container-app max-w-xl">
        <Link
          to={backTo}
          className="flex items-center gap-2 text-sm mb-8 hover:text-[var(--text-primary)] transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={16} /> Back to Menu
        </Link>

        {/* Order Number */}
        <div className="text-center mb-8">
          <p
            className="text-sm font-mono mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Order
          </p>
          <h1
            className="text-3xl font-display font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            #{orderNumber}
          </h1>
          {order && (
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {order.type === "dine_in"
                ? `Table ${order.table_number}`
                : order.type}
              {" · "}
              {sym}
              {order.total.toFixed(2)}
            </p>
          )}
          {eta && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full badge-brand">
              <Clock size={14} />
              <span className="text-sm font-medium">Est. ready: {eta}</span>
            </div>
          )}
        </div>

        {/* Status Timeline */}
        <div className="card p-6 mb-6">
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-6 top-6 bottom-6 w-0.5"
              style={{ background: "var(--border)" }}
            />
            {/* Progress line */}
            <div
              className="absolute left-6 top-6 w-0.5 transition-all duration-700"
              style={{
                background: "var(--brand-500)",
                height:
                  currentStepIndex === 0
                    ? "0%"
                    : `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%`,
              }}
            />

            <div className="space-y-6 relative">
              {STATUS_STEPS.map((step, i) => {
                const isDone = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                const isPending = i > currentStepIndex;

                return (
                  <div
                    key={step.status}
                    data-step={step.status}
                    className="flex items-start gap-4"
                  >
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 z-10 ${
                        isDone
                          ? "brand-gradient text-white"
                          : isCurrent
                            ? "brand-gradient text-white shadow-glow"
                            : ""
                      }`}
                      style={
                        isPending
                          ? {
                              background: "var(--surface-3)",
                              color: "var(--text-muted)",
                              border: "1px solid var(--border)",
                            }
                          : {}
                      }
                    >
                      {isDone ? <CheckCircle2 size={20} /> : step.icon}
                    </div>

                    {/* Content */}
                    <div className="pt-2.5">
                      <p
                        className={`font-semibold text-sm ${
                          isCurrent
                            ? "text-[var(--brand-400)]"
                            : isDone
                              ? "text-[var(--text-primary)]"
                              : "text-[var(--text-muted)]"
                        }`}
                      >
                        {step.label}
                        {isCurrent && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs">
                            <span className="status-dot live" /> Live
                          </span>
                        )}
                      </p>
                      {(isCurrent || isDone) && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {step.desc}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Items */}
        {order && (
          <div className="card p-5">
            <h3
              className="font-display font-semibold mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Your Order
            </h3>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
                    style={{ background: "var(--surface-3)" }}
                  >
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        🍽️
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.quantity}× {item.product_name}
                    </p>
                    {item.variant_name && (
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {item.variant_name}
                      </p>
                    )}
                  </div>
                  <p
                    className="text-sm font-bold"
                    style={{ color: "var(--brand-400)" }}
                  >
                    {sym}
                    {item.total_price.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div className="flex justify-between text-sm font-bold">
              <span style={{ color: "var(--text-primary)" }}>Total Paid</span>
              <span style={{ color: "var(--brand-400)" }}>
                {sym}
                {order.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {currentStatus === "delivered" && (
          <div className="text-center mt-8 animate-slide-up">
            <div className="text-5xl mb-3">🎉</div>
            <h2
              className="text-xl font-display font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Enjoy your meal!
            </h2>
            <Link to={backTo} className="btn btn-primary mt-3">
              Order Again
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
