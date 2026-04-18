import { useState, useRef, useEffect } from "react";
import {
  X,
  Plus,
  Minus,
  Star,
  Clock,
  Flame,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import type { Product, ProductVariant, ProductAddon } from "@/types";
import { useCartStore, useBranchStore } from "@/store";
import {
  animateModalIn,
  animateModalOut,
  animateAddToCart,
} from "@/hooks/useGSAP";
import toast from "react-hot-toast";

interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

export default function ProductModal({ product, onClose }: ProductModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const { addItem } = useCartStore();
  const { currentBranch } = useBranchStore();
  const sym = currentBranch?.currency_symbol || "$";
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<
    ProductVariant | undefined
  >(product.variants.find((v) => v.is_default));
  const [selectedAddons, setSelectedAddons] = useState<ProductAddon[]>([]);
  const [instructions, setInstructions] = useState("");
  const [showIngredients, setShowIngredients] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  const allImages = [product.image, ...product.images].filter(
    Boolean,
  ) as string[];

  const unitPrice = (() => {
    let price = product.price;
    if (selectedVariant) price += selectedVariant.price_modifier;
    selectedAddons.forEach((a) => (price += a.price));
    return price;
  })();

  const totalPrice = unitPrice * quantity;

  useEffect(() => {
    if (backdropRef.current && contentRef.current) {
      animateModalIn(backdropRef.current, contentRef.current);
    }

    // Handle escape key
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);

  const handleClose = () => {
    if (backdropRef.current && contentRef.current) {
      animateModalOut(backdropRef.current, contentRef.current, onClose);
    } else {
      onClose();
    }
  };

  const toggleAddon = (addon: ProductAddon) => {
    setSelectedAddons((prev) =>
      prev.find((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon],
    );
  };

  const handleAddToCart = () => {
    addItem(product, quantity, selectedVariant, selectedAddons, instructions);
    if (addBtnRef.current) {
      animateAddToCart(addBtnRef.current);
    }
    toast.success(`${product.name} added to cart`, {
      icon: "🛒",
    });
    setTimeout(handleClose, 400);
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === backdropRef.current) handleClose();
      }}
    >
      <div
        ref={contentRef}
        className="w-full sm:max-w-lg max-h-[95vh] overflow-hidden flex flex-col rounded-t-3xl sm:rounded-3xl"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Image Carousel */}
        <div className="relative h-56 sm:h-64 flex-shrink-0 overflow-hidden bg-[var(--surface-3)]">
          {allImages.length > 0 ? (
            <>
              <img
                src={allImages[currentImage]}
                alt={product.name}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
              {allImages.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {allImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImage(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        i === currentImage ? "w-4 bg-white" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">
              🍽️
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1">
            {product.is_new && (
              <span className="badge badge-success">
                <Flame size={10} /> New
              </span>
            )}
          </div>

          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full glass flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Title & Rating */}
          <div>
            <h2
              className="text-2xl font-display font-bold mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              {product.name}
            </h2>
            <div
              className="flex items-center gap-4 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {product.ratings_count > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={14} className="text-yellow-400 fill-yellow-400" />
                  {product.ratings_avg.toFixed(1)} ({product.ratings_count})
                </span>
              )}
              {product.preparation_time && (
                <span className="flex items-center gap-1">
                  <Clock size={14} /> {product.preparation_time} min
                </span>
              )}
              {product.calories && <span>{product.calories} kcal</span>}
            </div>
            {product.description && (
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {product.description}
              </p>
            )}
          </div>

          {/* Variants */}
          {product.variants.length > 0 && (
            <div>
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Size / Variant
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
                      selectedVariant?.id === variant.id
                        ? "border-[var(--brand-500)] bg-[rgba(var(--brand-rgb),0.1)] text-[var(--brand-400)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {variant.name}
                    {variant.price_modifier !== 0 && (
                      <span className="ml-1 opacity-70">
                        {variant.price_modifier > 0 ? "+" : ""}
                        {variant.price_modifier.toFixed(2)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {product.addons.length > 0 && (
            <div>
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Add-ons
              </h3>
              <div className="space-y-2">
                {product.addons.map((addon) => {
                  const isSelected = selectedAddons.some(
                    (a) => a.id === addon.id,
                  );
                  return (
                    <button
                      key={addon.id}
                      onClick={() => toggleAddon(addon)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all duration-200 ${
                        isSelected
                          ? "border-[var(--brand-500)] bg-[rgba(var(--brand-rgb),0.08)]"
                          : "border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <span style={{ color: "var(--text-primary)" }}>
                        {addon.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span
                          style={{ color: "var(--text-secondary)" }}
                        >{`+${sym}${addon.price.toFixed(2)}`}</span>
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            isSelected
                              ? "brand-gradient border-transparent"
                              : "border-[var(--border)]"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              viewBox="0 0 12 12"
                              className="w-3 h-3 text-white fill-white"
                            >
                              <path
                                d="M1 6l4 4 6-8"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ingredients & Allergens */}
          {(product.ingredients.length > 0 || product.allergens.length > 0) && (
            <div>
              <button
                onClick={() => setShowIngredients(!showIngredients)}
                className="flex items-center justify-between w-full text-sm font-semibold py-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span>Ingredients & Allergens</span>
                {showIngredients ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>

              {showIngredients && (
                <div className="mt-2 space-y-2 animate-slide-down">
                  {product.ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {product.ingredients.map((ing, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2.5 py-1 rounded-full border ${
                            ing.is_allergen
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                              : "bg-[var(--surface-3)] text-[var(--text-muted)] border-[var(--border)]"
                          }`}
                        >
                          {ing.is_allergen && "⚠ "}
                          {ing.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {product.allergens.length > 0 && (
                    <div
                      className="flex items-start gap-2 p-3 rounded-xl"
                      style={{
                        background: "rgba(234,179,8,0.08)",
                        border: "1px solid rgba(234,179,8,0.15)",
                      }}
                    >
                      <AlertTriangle
                        size={14}
                        className="text-yellow-400 flex-shrink-0 mt-0.5"
                      />
                      <p className="text-xs text-yellow-300">
                        Contains: {product.allergens.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Special Instructions */}
          <div>
            <label
              className="text-sm font-semibold block mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Special Instructions
              <span
                className="font-normal ml-1"
                style={{ color: "var(--text-muted)" }}
              >
                (optional)
              </span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Any allergies, preferences, or requests for the chef..."
              rows={2}
              maxLength={200}
              className="input resize-none text-sm"
            />
            <p
              className="text-xs mt-1 text-right"
              style={{ color: "var(--text-muted)" }}
            >
              {instructions.length}/200
            </p>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div
          className="flex-shrink-0 px-5 py-4 border-t border-[var(--border)]"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="flex items-center gap-4">
            {/* Quantity */}
            <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-[var(--border)]">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 flex items-center justify-center hover:bg-[var(--surface-3)] transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <Minus size={16} />
              </button>
              <span
                className="w-10 text-center text-sm font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 flex items-center justify-center hover:bg-[var(--surface-3)] transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Add to Cart */}
            <button
              ref={addBtnRef}
              onClick={handleAddToCart}
              disabled={product.status !== "active"}
              className="flex-1 btn btn-primary btn-lg gap-2"
            >
              <ShoppingCart size={18} />
              <span>Add to Cart</span>
              <span className="ml-auto font-bold">
                {sym}
                {totalPrice.toFixed(2)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
