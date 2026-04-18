import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, X, Save, Loader2 } from 'lucide-react';
import { usePageTransition } from '@/hooks/useGSAP';
import { productApi } from '@/api';
import { useAuthStore, useBranchStore } from '@/store';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

function UpdateStockModal({
  product, onClose,
}: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || 1;
  const [qty, setQty] = useState('');

  const mutation = useMutation({
    mutationFn: () => productApi.updateStock(product.id, Number(qty)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-products', branchId] });
      toast.success('Stock updated!');
      onClose();
    },
    onError: () => toast.error('Failed to update stock'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold" style={{ color: 'var(--text-primary)' }}>
            Update Stock
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
        </div>

        <div className="p-3 rounded-xl" style={{ background: 'var(--surface-3)' }}>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
          <span className={`badge text-xs mt-1 ${
            product.status === 'active' ? 'badge-success'
            : product.status === 'out_of_stock' ? 'badge-warning' : 'badge-neutral'
          }`}>{product.status.replace('_', ' ')}</span>
        </div>

        <div>
          <label className="label">New Quantity</label>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)}
            className="input" placeholder="Enter quantity" min="0" autoFocus />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!qty || mutation.isPending}
            className="btn btn-primary flex-1 gap-2">
            {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Update
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerInventory() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ['inventory-products', branchId],
    queryFn: () => productApi.getAll(branchId),
    select: res => res.data.data as Product[],
  });

  return (
    <>
      <div ref={pageRef} className="space-y-5">
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Inventory</h1>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Product', 'Category', 'Price', 'Stock Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} style={{ borderBottom: '1px solid var(--border)' }}
                  className="hover:bg-[var(--surface-3)] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--surface-4)' }}>
                        {product.image
                          ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
                      </div>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{product.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {(product as any).category?.name || '—'}
                  </td>
                  <td className="px-5 py-3 font-bold" style={{ color: 'var(--brand-400)' }}>
                    {currentBranch?.currency_symbol || '$'}{Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${
                      product.status === 'active' ? 'badge-success'
                      : product.status === 'out_of_stock' ? 'badge-warning' : 'badge-neutral'
                    }`}>{product.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => setStockProduct(product)} className="btn btn-secondary btn-sm gap-1 text-xs">
                      <Package size={12} /> Update Stock
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {stockProduct && (
        <UpdateStockModal product={stockProduct} onClose={() => setStockProduct(null)} />
      )}
    </>
  );
}