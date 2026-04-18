// ─── CategoryBar.tsx ─────────────────────────
import { useRef } from 'react';
import type { Category } from '@/types';

interface CategoryBarProps {
  categories: Category[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}

export default function CategoryBar({ categories, selected, onSelect }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (categories.length === 0) return null;

  return (
    <div ref={scrollRef} className="flex gap-2 scroll-x pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all duration-200 ${
          selected === null
            ? 'brand-gradient text-white shadow-glow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] border border-[var(--border)]'
        }`}
      >
        All
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all duration-200 flex items-center gap-1.5 ${
            selected === cat.id
              ? 'brand-gradient text-white shadow-glow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] border border-[var(--border)]'
          }`}
        >
          {cat.image && (
            <img src={cat.image} alt={cat.name} className="w-4 h-4 rounded-full object-cover" />
          )}
          {cat.name}
          {cat.products_count > 0 && (
            <span className="text-xs opacity-70">({cat.products_count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
