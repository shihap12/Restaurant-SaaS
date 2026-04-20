import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Utensils,
  Bike,
  ShoppingBag,
  CreditCard,
  Banknote,
  Check,
  Loader,
} from "lucide-react";
import gsap from "gsap";
import { orderApi } from "@/api";
import { useCartStore, useBranchStore, useAuthStore } from "@/store";
import type { OrderType, PaymentMethod } from "@/types";
import toast from "react-hot-toast";

type Step = "type" | "details" | "payment" | "confirming";

// ─── Validation ──────────────────────────────
function validate(
  fields: Record<string, string>,
  rules: Record<string, string[]>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, rs] of Object.entries(rules)) {
    const val = fields[field] ?? "";
    if (rs.includes("required") && !val.trim()) {
      errors[field] = `${field.replace("_", " ")} is required.`;
      continue;
    }
    if (rs.includes("phone") && val && !/^\+?[\d\s\-()]{7,}$/.test(val)) {
      errors[field] = "Enter a valid phone number.";
    }
  }
  return errors;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);

  const {
    items,
    subtotal,
    discount,
    delivery_fee,
    total,
    order_type,
    setOrderType,
    setDeliveryFee,
    clearCart,
  } = useCartStore();
  const { currentBranch } = useBranchStore();
  const { guestId, user } = useAuthStore();
  const sym = currentBranch?.currency_symbol || "$";

  const [step, setStep] = useState<Step>("type");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [form, setForm] = useState({
    customer_name: "",
    table_number: "",
    phone: "",
    address: "",
    city: "",
    special_instructions: "",
  });

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
  };

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      if (currentBranch?.slug) navigate(`/${currentBranch.slug}`);
      else navigate("/");
    }
  }, []);

  // Page entrance animation
  useEffect(() => {
    if (!pageRef.current) return;
    gsap.fromTo(
      pageRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" },
    );
  }, [step]);

  const selectType = (type: OrderType) => {
    setOrderType(type);
    setDeliveryFee(
      type === "delivery" ? (currentBranch?.settings?.delivery_fee ?? 15) : 0,
    );
    setStep("details");
  };

  const submitDetails = () => {
    const rules: Record<string, string[]> =
      order_type === "dine_in"
        ? { customer_name: ["required"], table_number: ["required"] }
        : order_type === "delivery"
          ? {
              customer_name: ["required"],
              phone: ["required", "phone"],
              address: ["required"],
              city: ["required"],
            }
          : { customer_name: ["required"], phone: ["required", "phone"] };

    const errs = validate(form, rules);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    // ─── FIX: dine_in → تخطى خطوة Payment وارسل الطلب مباشرة بـ cash ─────
    if (order_type === "dine_in") {
      placeOrder("cash");
      return;
    }

    setStep("payment");
  };

  const placeOrder = async (forcedPaymentMethod?: PaymentMethod) => {
    setStep("confirming");
    try {
      const payload: Record<string, unknown> = {
        branch_id: currentBranch?.id,
        guest_id: guestId,
        user_id: user?.id,
        type: order_type,
        // إذا dine_in نستخدم cash افتراضيًا، وإلا نستخدم اختيار المستخدم
        payment_method: forcedPaymentMethod ?? paymentMethod,
        customer_name: form.customer_name,
        special_instructions: form.special_instructions,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          variant_id: i.selected_variant?.id,
          addon_ids: i.selected_addons.map((a) => a.id),
          special_instructions: i.special_instructions,
        })),
      };

      if (order_type === "dine_in") {
        payload.table_number = form.table_number;
      } else {
        payload.customer_phone = form.phone;
        if (order_type === "delivery") {
          payload.customer_address = `${form.address}, ${form.city}`;
        }
      }

      const res = await orderApi.create(payload);
      const order = res.data.data as { order_number: string; status?: string };
      clearCart();

      // حفظ الطلب النشط بحيث يظهر الـ ActiveOrderBanner
      try {
        const active: Record<string, any> = {
          orderNumber: order.order_number,
          status: order.status || "pending",
        };
        if (currentBranch?.slug) active.slug = currentBranch.slug;
        localStorage.setItem("active_order", JSON.stringify(active));
      } catch {}

      // Navigate to slug-prefixed tracking route when possible
      if (currentBranch?.slug) {
        navigate(`/${currentBranch.slug}/track/${order.order_number}`);
      } else {
        navigate(`/track/${order.order_number}`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to place order. Please try again.";
      toast.error(msg);
      // إذا كان dine_in ارجع لـ details، وإلا ارجع لـ payment
      setStep(order_type === "dine_in" ? "details" : "payment");
    }
  };

  if (items.length === 0) return null;

  // ── Progress steps ──────────────────────────
  // dine_in: خطوتين فقط (type + details)
  // delivery/pickup: ثلاث خطوات (type + details + payment)
  const STEPS =
    order_type === "dine_in"
      ? (["type", "details"] as const)
      : (["type", "details", "payment"] as const);

  const currentIdx = STEPS.indexOf(step as (typeof STEPS)[number]);

  const STEP_LABELS: Record<string, string> = {
    type: "Order Type",
    details: "Your Info",
    payment: "Payment",
  };

  return (
    <div
      ref={pageRef}
      className="min-h-screen py-8"
      style={{ background: "var(--surface)" }}
    >
      <div className="container-app max-w-lg">
        {/* Back */}
        {step !== "confirming" && (
          <button
            onClick={() => {
              const root = currentBranch?.slug ? `/${currentBranch.slug}` : "/";
              if (step === "type") navigate(root);
              if (step === "details") setStep("type");
              if (step === "payment") setStep("details");
            }}
            className="flex items-center gap-1.5 mb-6 text-sm transition-colors hover:text-[var(--text-primary)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronLeft size={18} /> Back
          </button>
        )}

        {/* Progress bar */}
        {step !== "confirming" && (
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all duration-300 ${
                    currentIdx > i
                      ? "brand-gradient text-white"
                      : currentIdx === i
                        ? "border-2 border-[var(--brand-500)] text-[var(--brand-400)] bg-[rgba(var(--brand-rgb),0.1)]"
                        : "border border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  {currentIdx > i ? <Check size={14} /> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block capitalize ${
                    currentIdx === i
                      ? "text-[var(--brand-400)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        currentIdx > i ? "var(--brand-500)" : "var(--border)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 1: Order Type ── */}
        {step === "type" && (
          <div className="space-y-4 animate-slide-up">
            <h1
              className="text-2xl font-display font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              How would you like your order?
            </h1>
            {[
              {
                type: "dine_in" as OrderType,
                icon: <Utensils size={26} />,
                label: "Dine-In",
                desc: "Eat at the restaurant — served at your table",
                sub: "Needs: Name + Table Number",
              },
              {
                type: "delivery" as OrderType,
                icon: <Bike size={26} />,
                label: "Delivery",
                desc: `Delivered to your door — ${sym}${currentBranch?.settings?.delivery_fee ?? 15} fee`,
                sub: "Needs: Phone + Address",
              },
              {
                type: "pickup" as OrderType,
                icon: <ShoppingBag size={26} />,
                label: "Pickup",
                desc: "Pick up at the counter — no extra fee",
                sub: "Needs: Name + Phone",
              },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => selectType(opt.type)}
                className="w-full card p-5 text-left flex gap-4 items-start hover:border-[var(--brand-500)] hover:bg-[rgba(var(--brand-rgb),0.03)] group transition-all duration-200"
              >
                <div
                  className="p-3 rounded-xl transition-all group-hover:brand-gradient"
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--brand-400)",
                  }}
                >
                  {opt.icon}
                </div>
                <div>
                  <p
                    className="font-display font-bold text-lg mb-0.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {opt.label}
                  </p>
                  <p
                    className="text-sm mb-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {opt.desc}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {opt.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 2: Details ── */}
        {step === "details" && (
          <div className="space-y-5 animate-slide-up">
            <h1
              className="text-2xl font-display font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {order_type === "dine_in"
                ? "🍽 Dine-In Details"
                : order_type === "delivery"
                  ? "🛵 Delivery Details"
                  : "🏃 Pickup Details"}
            </h1>

            {/* Name — all types */}
            <FormField label="Your Name" required error={errors.customer_name}>
              <input
                className="input"
                placeholder="Full name"
                value={form.customer_name}
                onChange={(e) => set("customer_name", e.target.value)}
              />
            </FormField>

            {/* Dine-in: table number */}
            {order_type === "dine_in" && (
              <FormField
                label="Table Number"
                required
                error={errors.table_number}
              >
                <input
                  className="input"
                  placeholder="e.g. 7 or A12"
                  value={form.table_number}
                  onChange={(e) => set("table_number", e.target.value)}
                />
              </FormField>
            )}

            {/* Delivery + Pickup: phone */}
            {order_type !== "dine_in" && (
              <FormField label="Phone Number" required error={errors.phone}>
                <input
                  className="input"
                  type="tel"
                  placeholder="+966 5xx xxx xxx"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </FormField>
            )}

            {/* Delivery: address */}
            {order_type === "delivery" && (
              <>
                <FormField
                  label="Street Address"
                  required
                  error={errors.address}
                >
                  <input
                    className="input"
                    placeholder="Street, building, apartment..."
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </FormField>
                <FormField label="City" required error={errors.city}>
                  <input
                    className="input"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </FormField>
              </>
            )}

            {/* Special instructions — all types */}
            <FormField label="Special Instructions" optional>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Allergies, preferences, delivery instructions..."
                value={form.special_instructions}
                onChange={(e) => set("special_instructions", e.target.value)}
              />
            </FormField>

            <button
              onClick={submitDetails}
              className="btn btn-primary btn-lg w-full"
            >
              {order_type === "dine_in" ? "Place Order 🍽️" : "Continue to Payment"}
            </button>
          </div>
        )}

        {/* ── STEP 3: Payment (delivery/pickup only) ── */}
        {step === "payment" && (
          <div className="space-y-6 animate-slide-up">
            <h1
              className="text-2xl font-display font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Payment
            </h1>

            {/* Payment options */}
            <div className="space-y-3">
              {[
                {
                  method: "cash" as PaymentMethod,
                  icon: <Banknote size={22} />,
                  label: "Cash",
                  desc:
                    order_type === "delivery"
                      ? "Pay on delivery"
                      : "Pay at pickup",
                },
                {
                  method: "card" as PaymentMethod,
                  icon: <CreditCard size={22} />,
                  label: "Credit / Debit Card",
                  desc: "Secure payment",
                },
              ].map((opt) => (
                <button
                  key={opt.method}
                  onClick={() => setPaymentMethod(opt.method)}
                  className={`w-full card p-4 flex items-center gap-4 transition-all duration-200 ${
                    paymentMethod === opt.method
                      ? "border-[var(--brand-500)] bg-[rgba(var(--brand-rgb),0.05)]"
                      : "hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl transition-colors ${paymentMethod === opt.method ? "brand-gradient text-white" : ""}`}
                    style={
                      paymentMethod !== opt.method
                        ? {
                            background: "var(--surface-3)",
                            color: "var(--text-secondary)",
                          }
                        : {}
                    }
                  >
                    {opt.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className="font-semibold text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {opt.label}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {opt.desc}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      paymentMethod === opt.method
                        ? "brand-gradient border-transparent"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {paymentMethod === opt.method && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Order summary */}
            <div className="card p-5 space-y-3 text-sm">
              <h3
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Order Summary
              </h3>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span>
                    {item.quantity}× {item.product.name}
                  </span>
                  <span>
                    {sym}
                    {item.total_price.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="divider" />
              {discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>
                    −{sym}
                    {discount.toFixed(2)}
                  </span>
                </div>
              )}
              {order_type === "delivery" && (
                <div
                  className="flex justify-between"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span>Delivery Fee</span>
                  <span>
                    {sym}
                    {delivery_fee.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span style={{ color: "var(--text-primary)" }}>Total</span>
                <span style={{ color: "var(--brand-400)" }}>
                  {sym}
                  {total.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => placeOrder()}
              className="btn btn-primary btn-lg w-full"
            >
              Place Order — {sym}
              {total.toFixed(2)}
            </button>
          </div>
        )}

        {/* ── Confirming ── */}
        {step === "confirming" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full brand-gradient flex items-center justify-center mb-6">
              <Loader size={32} className="text-white animate-spin" />
            </div>
            <h2
              className="text-2xl font-display font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Placing your order…
            </h2>
            <p style={{ color: "var(--text-muted)" }}>Please wait a moment</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FormField helper ────────────────────────
function FormField({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-sm font-medium mb-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {optional && (
          <span
            className="font-normal ml-1"
            style={{ color: "var(--text-muted)" }}
          >
            (optional)
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}