import { useEffect, useRef, useState } from "react";
import {
  X,
  Minus,
  Plus,
  Trash2,
  QrCode,
  Tag,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { useCartStore, useBranchStore } from "@/store";
import type { CartItem } from "@/types";
import { useCartAnimation } from "@/hooks/useGSAP";
import { couponApi } from "@/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import QRScanner from "@/components/ui/QRScanner";
import gsap from "gsap";

interface CartDrawerProps {
  cartIconRef?: React.RefObject<HTMLButtonElement>;
}

export default function CartDrawer({ cartIconRef }: CartDrawerProps) {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const {
    isOpen,
    closeCart,
    items,
    removeItem,
    updateQuantity,
    subtotal,
    discount,
    delivery_fee,
    total,
    applied_coupon,
    applyCoupon,
    removeCoupon,
    order_type,
  } = useCartStore();

  const { currentBranch } = useBranchStore();
  const sym = currentBranch?.currency_symbol || "$";

  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);

  // Animate on open/close
  useEffect(() => {
    if (!drawerRef.current || !overlayRef.current) return;

    if (isOpen) {
      document.body.style.overflow = "hidden";
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3 },
      );
      gsap.fromTo(
        drawerRef.current,
        { x: "100%" },
        { x: "0%", duration: 0.4, ease: "power3.out" },
      );
      // Animate items
      gsap.fromTo(
        "[data-cart-item]",
        { opacity: 0, x: 20 },
        {
          opacity: 1,
          x: 0,
          stagger: 0.04,
          delay: 0.15,
          duration: 0.3,
          ease: "power2.out",
        },
      );
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  const handleClose = () => {
    if (!drawerRef.current || !overlayRef.current) {
      closeCart();
      return;
    }
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.25 });
    gsap.to(drawerRef.current, {
      x: "100%",
      duration: 0.3,
      ease: "power2.in",
      onComplete: closeCart,
    });
  };

  const applyCouponCode = async (code: string) => {
    if (!code.trim() || !currentBranch) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await couponApi.validate(code, currentBranch.id, subtotal);
      applyCoupon(res.data.data as any);
      setCouponCode("");
      setShowCouponInput(false);
      toast.success("Coupon applied!");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Invalid or expired coupon";
      setCouponError(msg);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleQRScan = (code: string) => {
    setShowScanner(false);
    applyCouponCode(code);
  };

  const handleCheckout = () => {
    handleClose();
    setTimeout(() => {
      if (currentBranch?.slug) navigate(`/${currentBranch.slug}/checkout`);
      else navigate("/checkout");
    }, 350);
  };

  if (!isOpen && !drawerRef.current) return null;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col shadow-modal"
        style={{
          background: "var(--surface-2)",
          borderLeft: "1px solid var(--border)",
          transform: "translateX(100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} style={{ color: "var(--brand-400)" }} />
            <h2
              className="text-lg font-display font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Your Cart
            </h2>
            {items.length > 0 && (
              <span className="badge badge-brand">
                {items.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            )}
          </div>
          <button onClick={handleClose} className="btn btn-ghost btn-icon">
            <X size={20} />
          </button>
        </div>

        {/* Order Type Badge */}
        <div className="px-5 py-2 border-b border-[var(--border)]">
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Order type:</span>
            <span className="badge badge-brand">
              {order_type === "dine_in"
                ? "🍽 Dine-In"
                : order_type === "delivery"
                  ? "🛵 Delivery"
                  : "🏃 Pickup"}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {items.length === 0 ? (
            <EmptyCart />
          ) : (
            items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                sym={sym}
                onRemove={() => removeItem(item.id)}
                onQuantityChange={(q) => updateQuantity(item.id, q)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-4 space-y-4">
            {/* Coupon Section */}
            {applied_coupon ? (
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.15)",
                }}
              >
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Tag size={14} />
                  <span className="font-mono font-bold">
                    {applied_coupon.code}
                  </span>
                  <span>
                    applied — saving {sym}
                    {discount.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCouponInput(!showCouponInput)}
                    className="btn btn-secondary btn-sm flex-1 gap-1.5"
                  >
                    <Tag size={14} /> Add Coupon
                  </button>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="btn btn-secondary btn-sm gap-1.5"
                    title="Scan QR coupon"
                  >
                    <QrCode size={14} /> Scan QR
                  </button>
                </div>

                {showCouponInput && (
                  <div className="mt-2 flex gap-2 animate-slide-down">
                    <input
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" && applyCouponCode(couponCode)
                      }
                      placeholder="Enter coupon code"
                      className="input text-sm font-mono flex-1"
                      autoFocus
                    />
                    <button
                      onClick={() => applyCouponCode(couponCode)}
                      disabled={couponLoading || !couponCode}
                      className="btn btn-primary btn-sm"
                    >
                      {couponLoading ? <span className="loader" /> : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p className="text-xs text-red-400 mt-1 animate-fade-in">
                    {couponError}
                  </p>
                )}
              </div>
            )}

            {/* Price Summary */}
            <div className="space-y-2 text-sm">
              <div
                className="flex justify-between"
                style={{ color: "var(--text-secondary)" }}
              >
                <span>Subtotal</span>
                <span>
                  {sym}
                  {subtotal.toFixed(2)}
                </span>
              </div>
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
                    {delivery_fee === 0
                      ? "Free"
                      : `${sym}${delivery_fee.toFixed(2)}`}
                  </span>
                </div>
              )}
              <div className="divider" />
              <div
                className="flex justify-between text-base font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                <span>Total</span>
                <span style={{ color: "var(--brand-400)" }}>
                  {sym}
                  {total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              className="btn btn-primary btn-lg w-full gap-2"
            >
              Proceed to Checkout
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}

// ─── Cart Item Row ────────────────────────────

function CartItemRow({
  item,
  sym,
  onRemove,
  onQuantityChange,
}: {
  item: CartItem;
  sym: string;
  onRemove: () => void;
  onQuantityChange: (q: number) => void;
}) {
  return (
    <div
      data-cart-item
      className="flex gap-3 p-3 rounded-2xl transition-all duration-200"
      style={{
        background: "var(--surface-3)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Product Image */}
      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--surface-4)]">
        {item.product.image ? (
          <img
            src={item.product.image}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            🍽️
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4
          className="text-sm font-semibold line-clamp-1"
          style={{ color: "var(--text-primary)" }}
        >
          {item.product.name}
        </h4>
        {item.selected_variant && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {item.selected_variant.name}
          </p>
        )}
        {item.selected_addons.length > 0 && (
          <p
            className="text-xs line-clamp-1"
            style={{ color: "var(--text-muted)" }}
          >
            + {item.selected_addons.map((a) => a.name).join(", ")}
          </p>
        )}
        {item.special_instructions && (
          <p
            className="text-xs italic line-clamp-1 mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            "{item.special_instructions}"
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          {/* Quantity Control */}
          <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-[var(--border)]">
            <button
              onClick={() => onQuantityChange(item.quantity - 1)}
              className="w-7 h-7 flex items-center justify-center hover:bg-[var(--surface-4)] transition-colors text-[var(--text-secondary)]"
            >
              <Minus size={12} />
            </button>
            <span
              className="w-7 text-center text-xs font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {item.quantity}
            </span>
            <button
              onClick={() => onQuantityChange(item.quantity + 1)}
              className="w-7 h-7 flex items-center justify-center hover:bg-[var(--surface-4)] transition-colors text-[var(--text-secondary)]"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Price */}
          <span
            className="text-sm font-bold"
            style={{ color: "var(--brand-400)" }}
          >
            {sym}
            {item.total_price.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="self-start p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors text-[var(--text-muted)]"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Empty State ─────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
      <div className="text-6xl mb-4 animate-float">🛒</div>
      <h3
        className="text-lg font-display font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        Your cart is empty
      </h3>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Browse our menu and add items to get started
      </p>
    </div>
  );
}
