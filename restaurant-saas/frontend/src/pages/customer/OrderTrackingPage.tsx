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
  UtensilsCrossed,
} from "lucide-react";
import { orderApi } from "@/api";
import type { Order, OrderStatus } from "@/types";
import { useOrderTracking } from "@/hooks/useWebSocket";
import { usePageTransition } from "@/hooks/useGSAP";
import gsap from "gsap";

// ─── Steps per order type ─────────────────────────────────────────────────
//
//  Dine-in:          pending → accepted → preparing → served → completed
//  Delivery/Pickup:  pending → accepted → preparing → ready  → delivered
//
// ─────────────────────────────────────────────────────────────────────────

const STEPS_DINE_IN: {
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
    status: "served",
    label: "Served",
    icon: <UtensilsCrossed size={20} />,
    desc: "Your meal has been served. Enjoy! 🍽️",
  },
  {
    status: "completed",
    label: "Completed",
    icon: <Home size={20} />,
    desc: "Thank you for dining with us! 🎉",
  },
];

const STEPS_DELIVERY: {
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

// Final statuses per type — used for localStorage cleanup & celebration screen
const DONE_STATUSES_DINE_IN: OrderStatus[] = ["completed", "cancelled"];
const DONE_STATUSES_DELIVERY: OrderStatus[] = ["delivered", "cancelled"];

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

  // Pick the right steps based on order type
  const isDineIn = order?.type === "dine_in";
  const STATUS_STEPS = isDineIn ? STEPS_DINE_IN : STEPS_DELIVERY;
  const doneStatuses = isDineIn ? DONE_STATUSES_DINE_IN : DONE_STATUSES_DELIVERY;

  useEffect(() => {
    if (!order) return;
    setCurrentStatus(order.status);

    try {
      if (doneStatuses.includes(order.status)) {
        localStorage.removeItem("active_order");
        try {
          window.dispatchEvent(
            new CustomEvent("active_order_changed", {
              detail: { status: order.status },
            }),
          );
        } catch {}
      } else {
        const active: Record<string, unknown> = {
          orderNumber: order.order_number,
          status: order.status,
        };
        if (order.branch?.slug) active.slug = order.branch.slug;
        localStorage.setItem("active_order", JSON.stringify(active));
        try {
          window.dispatchEvent(
            new CustomEvent("active_order_changed", { detail: active }),
          );
        } catch {}
      }
    } catch {}
  }, [order]);

  // ─── FIX: استمع لـ CustomEvent وأعد الجلب فورًا ──────────────────────────
  // هذا يجعل صفحة التتبع تستجيب فوريًا عند تحديث الشيف أو الكاشير
  // بدلاً من الانتظار للـ polling interval التالي (6 ثوانٍ)
  useEffect(() => {
    function handleOrderUpdate() {
      refetch();
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
  }, [refetch]);

  // Real-time tracking via polling
  useOrderTracking({
    orderNumber: orderNumber || "",
    onStatusChange: (status, newEta) => {
      setCurrentStatus(status);
      if (newEta) setEta(newEta);
      refetch();

      try {
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

      // Animate the active step
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

  // Celebration condition differs per type
  const isCompleted =
    isDineIn
      ? currentStatus === "completed"
      : currentStatus === "delivered";

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
                : order.type === "delivery"
                  ? "Delivery"
                  : "Pickup"}
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
            {/* Background line */}
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
                  currentStepIndex <= 0
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
              <span style={{ color: "var(--text-primary)" }}>Total</span>
              <span style={{ color: "var(--brand-400)" }}>
                {sym}
                {order.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Completion screen */}
        {isCompleted && (
          <div className="text-center mt-8 animate-slide-up">
            <div className="text-5xl mb-3">🎉</div>
            <h2
              className="text-xl font-display font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {isDineIn ? "Hope you enjoyed your meal!" : "Enjoy your meal!"}
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