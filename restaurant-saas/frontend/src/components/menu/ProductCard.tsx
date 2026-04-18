import { useRef } from 'react';
import { Star, Clock, Plus, Flame, Sparkles } from 'lucide-react';
import type { Product } from '@/types';
import { animateMenuItemHover } from '@/hooks/useGSAP';
import { useCartStore, useBranchStore } from '@/store';
import toast from 'react-hot-toast';

interface Props {
  product: Product;
  onClick: () => void;
}

export default function ProductCard({ product, onClick }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { addItem }       = useCartStore();
  const { currentBranch } = useBranchStore();
  const sym = currentBranch?.currency_symbol || '$';

  const handleEnter = () => { if (cardRef.current) animateMenuItemHover(cardRef.current, true); };
  const handleLeave = () => { if (cardRef.current) animateMenuItemHover(cardRef.current, false); };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.status !== 'active') return;
    addItem(product, 1);
    toast.success(`${product.name} added!`, { icon: '🛒', duration: 1800 });
    const btn = e.currentTarget as HTMLButtonElement;
    btn.style.transform = 'scale(0.85)';
    setTimeout(() => { btn.style.transform = ''; }, 150);
  };

  const unavailable = product.status !== 'active';

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      role="button"
      tabIndex={0}
      aria-label={`View ${product.name}`}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className={`card cursor-pointer group will-change-transform select-none ${unavailable ? 'opacity-60' : ''}`}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-[var(--surface-3)]">
        {product.image ? (
          <img
            src={product.image} alt={product.name} loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🍽️</div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          {product.is_new && (
            <span className="badge text-xs" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', backdropFilter: 'blur(8px)' }}>
              <Flame size={10} /> New
            </span>
          )}
          {product.is_featured && (
            <span className="badge text-xs" style={{ background: 'rgba(var(--brand-rgb),0.15)', color: 'var(--brand-400)', border: '1px solid rgba(var(--brand-rgb),0.25)', backdropFilter: 'blur(8px)' }}>
              <Sparkles size={10} /> Featured
            </span>
          )}
          {unavailable && (
            <span className="badge badge-neutral text-xs">Unavailable</span>
          )}
        </div>

        {/* Quick-add */}
        {!unavailable && (
          <button
            onClick={handleQuickAdd}
            aria-label={`Add ${product.name} to cart`}
            className="absolute bottom-2 right-2 w-9 h-9 rounded-xl brand-gradient text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-display font-semibold text-base mb-1 line-clamp-1" style={{ color: 'var(--text-primary)' }}>
          {product.name}
        </h3>

        {product.description && (
          <p className="text-xs line-clamp-2 mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {product.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {product.ratings_count > 0 && (
            <span className="flex items-center gap-1">
              <Star size={11} className="text-yellow-400 fill-yellow-400" />
              {Number(product.ratings_avg).toFixed(1)}
              <span>({product.ratings_count})</span>
            </span>
          )}
          {product.preparation_time && (
            <span className="flex items-center gap-1">
              <Clock size={11} /> {product.preparation_time}m
            </span>
          )}
          {product.calories && <span>{product.calories} kcal</span>}
        </div>

        {/* Price + Allergens */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold font-display" style={{ color: 'var(--brand-400)' }}>
              {sym}{Number(product.price).toFixed(2)}
            </span>
            {product.variants?.length > 0 && (
              <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>+ options</span>
            )}
          </div>
          {product.allergens?.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.1)', color: '#facc15', border: '1px solid rgba(234,179,8,0.2)' }}>
              ⚠ Allergens
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
