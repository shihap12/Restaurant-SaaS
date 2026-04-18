import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag, Edit2, Trash2, X, Save, Loader2 } from 'lucide-react';
import { usePageTransition } from '@/hooks/useGSAP';
import { couponApi } from '@/api';
import { useAuthStore, useBranchStore } from '@/store';
import type { Coupon } from '@/types';
import toast from 'react-hot-toast';

type CouponForm = {
  code: string; type: 'percentage' | 'fixed'; value: string;
  min_order_amount: string; usage_limit: string;
  description: string; expires_at: string; is_active: boolean;
};

const defaultForm: CouponForm = {
  code: '', type: 'percentage', value: '',
  min_order_amount: '0', usage_limit: '',
  description: '', expires_at: '', is_active: true,
};

function CouponModal({
  coupon, branchId, onClose,
}: { coupon?: Coupon; branchId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CouponForm>(
    coupon ? {
      code: coupon.code, type: coupon.type, value: String(coupon.value),
      min_order_amount: String(coupon.min_order_amount),
      usage_limit: coupon.usage_limit ? String(coupon.usage_limit) : '',
      description: coupon.description || '', expires_at: coupon.expires_at || '',
      is_active: coupon.is_active,
    } : defaultForm
  );

  const set = (k: keyof CouponForm, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      coupon ? couponApi.update(coupon.id, data) : couponApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons', branchId] });
      toast.success(coupon ? 'Coupon updated!' : 'Coupon created!');
      onClose();
    },
    onError: () => toast.error('Failed to save coupon'),
  });

  const handleSubmit = () => {
    if (!form.code || !form.value) return toast.error('Code and value are required');
    mutation.mutate({
      branch_id: branchId, code: form.code.toUpperCase(), type: form.type,
      value: Number(form.value), min_order_amount: Number(form.min_order_amount),
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      description: form.description || null,
      expires_at: form.expires_at || null, is_active: form.is_active,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold" style={{ color: 'var(--text-primary)' }}>
            {coupon ? 'Edit Coupon' : 'New Coupon'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Code</label>
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                className="input font-mono" placeholder="SUMMER20" />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="input">
                <option value="percentage">Percentage %</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Value</label>
              <input type="number" value={form.value} onChange={e => set('value', e.target.value)}
                className="input" placeholder={form.type === 'percentage' ? '20' : '5.00'} />
            </div>
            <div>
              <label className="label">Min Order</label>
              <input type="number" value={form.min_order_amount}
                onChange={e => set('min_order_amount', e.target.value)} className="input" placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Usage Limit</label>
              <input type="number" value={form.usage_limit}
                onChange={e => set('usage_limit', e.target.value)} className="input" placeholder="Unlimited" />
            </div>
            <div>
              <label className="label">Expires At</label>
              <input type="date" value={form.expires_at}
                onChange={e => set('expires_at', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              className="input" placeholder="Optional description" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface-3)' }}>
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Active</span>
            <button onClick={() => set('is_active', !form.is_active)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-[var(--surface-4)]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} className="btn btn-primary flex-1 gap-2">
            {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {coupon ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerCoupons() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const queryClient = useQueryClient();
  const sym = currentBranch?.currency_symbol || '$';
  const [modalCoupon, setModalCoupon] = useState<Coupon | null | 'new'>(null);

  const { data: coupons = [] } = useQuery({
    queryKey: ['coupons', branchId],
    queryFn: () => couponApi.getAll(branchId),
    select: res => res.data.data as Coupon[],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => couponApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons', branchId] });
      toast.success('Coupon deleted.');
    },
  });

  return (
    <>
      <div ref={pageRef} className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Coupons</h1>
          <button onClick={() => setModalCoupon('new')} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={15} /> New Coupon
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map(coupon => (
            <div key={coupon.id} className={`card p-5 relative overflow-hidden ${!coupon.is_active ? 'opacity-60' : ''}`}>
              {coupon.qr_code_url && (
                <img src={coupon.qr_code_url} alt="QR" className="absolute top-3 right-3 w-14 h-14 rounded-lg" />
              )}
              <div className="mb-3">
                <span className="font-mono font-bold text-lg tracking-widest" style={{ color: 'var(--brand-400)' }}>
                  {coupon.code}
                </span>
              </div>
              <p className="text-xl font-display font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {coupon.type === 'percentage' ? `${coupon.value}% Off` : `${sym}${coupon.value} Off`}
              </p>
              {coupon.description && (
                <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{coupon.description}</p>
              )}
              <div className="space-y-1 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                <p>Min order: {sym}{coupon.min_order_amount}</p>
                {coupon.usage_limit && <p>Used: {coupon.used_count}/{coupon.usage_limit}</p>}
                {coupon.expires_at && <p>Expires: {new Date(coupon.expires_at).toLocaleDateString()}</p>}
              </div>
              <div className="flex items-center justify-between">
                <span className={`badge ${coupon.is_active ? 'badge-success' : 'badge-neutral'}`}>
                  {coupon.is_active ? 'Active' : 'Inactive'}
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => setModalCoupon(coupon)} className="btn btn-ghost btn-sm btn-icon">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(coupon.id)}
                    className="btn btn-ghost btn-sm btn-icon hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {coupons.length === 0 && (
            <div className="col-span-full card p-10 text-center">
              <Tag size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)' }}>No coupons yet. Create your first one!</p>
            </div>
          )}
        </div>
      </div>

      {modalCoupon !== null && (
        <CouponModal
          coupon={modalCoupon === 'new' ? undefined : modalCoupon}
          branchId={branchId}
          onClose={() => setModalCoupon(null)}
        />
      )}
    </>
  );
}