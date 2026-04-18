import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import { Search, X, Filter, Star, Flame, Sparkles } from 'lucide-react';
import { productApi, categoryApi } from '@/api';
import { useBranchStore, useCartStore } from '@/store';
import type { Product, Category } from '@/types';
import ProductCard from '@/components/menu/ProductCard';
import ProductModal from '@/components/menu/ProductModal';
import CategoryBar from '@/components/menu/CategoryBar';
import HeroSection from '@/components/menu/HeroSection';
import { useStaggerAnimation } from '@/hooks/useGSAP';

export default function MenuPage() {
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || 1;

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories', branchId],
    queryFn: () => categoryApi.getAll(branchId),
    select: (res) => res.data.data as Category[],
  });

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', branchId, selectedCategory, searchQuery],
    queryFn: () => productApi.getAll(branchId, {
      category_id: selectedCategory,
      search: searchQuery || undefined,
    }),
    select: (res) => res.data.data as Product[],
  });

  const categories = categoriesData || [];
  const allProducts = productsData || [];

  // Apply client-side tag filter
  const products = filterTag
    ? allProducts.filter(p => {
        if (filterTag === 'featured') return p.is_featured;
        if (filterTag === 'new') return p.is_new;
        if (filterTag === 'top_rated') return p.ratings_avg >= 4.5;
        return true;
      })
    : allProducts;

  // Animate grid on products change
  useStaggerAnimation(gridRef, '[data-product-card]', { stagger: 0.04 });

  // Search focus animation
  const focusSearch = () => {
    if (searchRef.current) {
      gsap.to(searchRef.current.parentElement, {
        scale: 1.01,
        duration: 0.2,
        ease: 'power2.out',
      });
    }
  };

  const blurSearch = () => {
    if (searchRef.current) {
      gsap.to(searchRef.current.parentElement, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
      });
    }
  };

  // Group products by category for browsing
  const groupedProducts = categories.reduce<Record<string, Product[]>>((acc, cat) => {
    const catProducts = products.filter(p => p.category_id === cat.id);
    if (catProducts.length > 0) acc[cat.name] = catProducts;
    return acc;
  }, {});

  const showGrouped = !searchQuery && !selectedCategory && !filterTag;

  const filterTags = [
    { id: 'featured', label: 'Featured', icon: <Sparkles size={13} /> },
    { id: 'new', label: 'New', icon: <Flame size={13} /> },
    { id: 'top_rated', label: 'Top Rated', icon: <Star size={13} /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Hero */}
      <HeroSection branch={currentBranch} />

      {/* Sticky Category + Search Bar */}
      <div className="sticky top-16 z-40 border-b border-[var(--border)]"
        style={{ background: 'var(--surface)', backdropFilter: 'blur(12px)' }}>
        <div className="container-app py-3">
          {/* Search */}
          <div className="relative mb-3" onFocus={focusSearch} onBlur={blurSearch}>
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search dishes, ingredients..."
              className="input pl-10 pr-10"
              aria-label="Search menu"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:text-[var(--text-primary)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category Scroll Bar */}
          <CategoryBar
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />

          {/* Filter Tags */}
          <div className="flex items-center gap-2 mt-2 scroll-x pb-1">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn btn-sm flex-shrink-0 ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Filter size={13} /> Filter
            </button>
            {filterTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
                className={`btn btn-sm flex-shrink-0 gap-1 ${
                  filterTag === tag.id ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {tag.icon} {tag.label}
              </button>
            ))}
            {(filterTag || selectedCategory || searchQuery) && (
              <button
                onClick={() => { setFilterTag(null); setSelectedCategory(null); setSearchQuery(''); }}
                className="btn btn-sm btn-ghost flex-shrink-0 text-red-400"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Products ── */}
      <div className="container-app py-8">
        {isLoading ? (
          <ProductsGridSkeleton />
        ) : products.length === 0 ? (
          <EmptyState query={searchQuery} />
        ) : showGrouped ? (
          /* Grouped by category */
          <div className="space-y-10">
            {Object.entries(groupedProducts).map(([catName, catProducts]) => (
              <CategorySection
                key={catName}
                title={catName}
                products={catProducts}
                onProductClick={setSelectedProduct}
              />
            ))}
            {products.filter(p => !p.category_id).length > 0 && (
              <CategorySection
                title="More Items"
                products={products.filter(p => !p.category_id)}
                onProductClick={setSelectedProduct}
              />
            )}
          </div>
        ) : (
          /* Flat grid */
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {products.length} item{products.length !== 1 ? 's' : ''} found
            </p>
            <div ref={gridRef}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map(product => (
                <div key={product.id} data-product-card>
                  <ProductCard
                    product={product}
                    onClick={() => setSelectedProduct(product)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

// ─── Category Section ────────────────────────

function CategorySection({
  title, products, onProductClick
}: {
  title: string;
  products: Product[];
  onProductClick: (p: Product) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        gsap.fromTo(ref.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
        );
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {products.length} items
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onClick={() => onProductClick(product)}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Skeleton ────────────────────────────────

function ProductsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="skeleton h-44 w-full" />
          <div className="p-4 space-y-2">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-4">🍽️</div>
      <h3 className="text-xl font-display font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {query ? `No results for "${query}"` : 'No items available'}
      </h3>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {query ? 'Try a different search term or browse by category' : 'Check back soon!'}
      </p>
    </div>
  );
}
