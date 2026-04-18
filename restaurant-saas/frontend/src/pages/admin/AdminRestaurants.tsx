import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  Store, ChevronDown, X, Loader,
} from 'lucide-react';
import { usePageTransition } from '@/hooks/useGSAP';
import api, { userApi } from '@/api';
import toast from 'react-hot-toast';
import type { User } from '@/types';



// ─── Types ───────────────────────────────────
interface Restaurant {
  id:              number;
  owner_id:        number;
  name:            string;
  slug:            string;
  description:     string;
  cuisine_type:    string;
  plan:            'trial' | 'basic' | 'pro' | 'enterprise';
  max_branches:    number;
  is_active:       boolean;
  branches_count:  number;
  staff_count:     number;
  owner_name:      string;
  owner_email:     string;
  created_at:      string;
}

const PLAN_COLOR: Record<string, string> = {
  trial:      'var(--text-muted)',
  basic:      '#60a5fa',
  pro:        '#a78bfa',
  enterprise: '#f97316',
};

const PLAN_MAX: Record<string, number> = {
  trial: 1, basic: 3, pro: 10, enterprise: 99,
};

// ─── Modal ───────────────────────────────────
function RestaurantModal({
  restaurant, owners, onClose, onSave,
}: {
  restaurant?: Restaurant | null;
  owners: User[];
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const isEdit = !!restaurant;
  const [form, setForm] = useState({
    owner_id:     restaurant?.owner_id     ?? '',
    name:         restaurant?.name         ?? '',
    slug:         restaurant?.slug         ?? '',
    description:  restaurant?.description  ?? '',
    cuisine_type: restaurant?.cuisine_type ?? '',
    plan:         restaurant?.plan         ?? 'trial',
    max_branches: restaurant?.max_branches ?? 1,
    is_active:    restaurant?.is_active    ?? true,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    set('name', val);
    if (!isEdit) {
      set('slug', val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  // Auto-set max_branches when plan changes
  const handlePlanChange = (plan: string) => {
    set('plan', plan);
    set('max_branches', PLAN_MAX[plan] ?? 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pt-60 p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="card w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Restaurant' : 'New Restaurant'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Owner */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Owner *
            </label>
            <select value={form.owner_id} onChange={e => set('owner_id', e.target.value)}
              className="input" required>
              <option value="">Select an owner...</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name} — {o.email}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Restaurant Name *
            </label>
            <input value={form.name} onChange={e => handleNameChange(e.target.value)}
              className="input" placeholder="e.g. Bab Al Hara" required />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              URL Slug * <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>
                (used in branch URLs)
              </span>
            </label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2 text-sm rounded-l-xl border-r-0"
                style={{ background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                /
              </span>
              <input value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className="input rounded-l-none" placeholder="bab-al-hara" required />
            </div>
          </div>

          {/* Cuisine + Description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Cuisine Type
              </label>
              <input value={form.cuisine_type} onChange={e => set('cuisine_type', e.target.value)}
                className="input" placeholder="Arabian, Italian..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Plan
              </label>
              <select value={form.plan} onChange={e => handlePlanChange(e.target.value)} className="input">
                {['trial', 'basic', 'pro', 'enterprise'].map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Max Branches */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Max Branches
            </label>
            <input type="number" min={1} max={99} value={form.max_branches}
              onChange={e => set('max_branches', Number(e.target.value))}
              className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Description
            </label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input resize-none" rows={2} placeholder="Short description..." />
          </div>

          {isEdit && (
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface-3)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Active</span>
              <button type="button" onClick={() => set('is_active', !form.is_active)}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-green-500' : 'bg-[var(--border)]'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn btn-primary flex-1">
              {isEdit ? 'Save Changes' : 'Create Restaurant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────
export default function AdminRestaurants() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const queryClient = useQueryClient();

  const [search,  setSearch]  = useState('');
  const [planFilter, setPlan] = useState('');
  const [modal,   setModal]   = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Restaurant | null>(null);

  // ── Queries ──────────────────────────────
  const { data: restaurants = [], isLoading } = useQuery<Restaurant[]>({
    queryKey: ['admin-restaurants', planFilter],
    queryFn:  () => api.get('/restaurants', { params: { plan: planFilter || undefined } }).then(r => r.data.data),
  });

const { data: owners = [] } = useQuery<User[]>({
  queryKey: ['owners-list'],
  queryFn: async () => {
    const res = await userApi.getAll({ role: 'owner' });
    return (res.data?.data ?? []) as User[];
  },
});
  // ── Mutations ────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/restaurants', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      toast.success('Restaurant created!');
      setModal(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to create.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/restaurants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      toast.success('Restaurant updated!');
      setModal(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to update.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/restaurants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      toast.success('Restaurant deleted.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to delete.'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/restaurants/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] }),
  });

  // ── Handlers ─────────────────────────────
  const handleSave = (formData: any) => {
    if (modal === 'edit' && selected) {
      updateMutation.mutate({ id: selected.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (r: Restaurant) => {
    if (!confirm(`Delete "${r.name}"? This will also delete all its branches.`)) return;
    deleteMutation.mutate(r.id);
  };

  // ── Filter ───────────────────────────────
  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.slug.toLowerCase().includes(search.toLowerCase()) ||
    r.owner_name?.toLowerCase().includes(search.toLowerCase())
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div ref={pageRef} className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Restaurants
        </h1>
        <button onClick={() => setModal('create')} className="btn btn-primary btn-sm gap-1.5">
          <Plus size={15} /> New Restaurant
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search restaurants..." className="input pl-9 text-sm" />
        </div>
        <select value={planFilter} onChange={e => setPlan(e.target.value)} className="input text-sm w-auto py-2">
          <option value="">All Plans</option>
          {['trial', 'basic', 'pro', 'enterprise'].map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <Loader size={24} className="animate-spin mx-auto mb-3" />
            Loading restaurants...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Store size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No restaurants match your search.' : 'No restaurants yet. Create one!'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Restaurant', 'Owner', 'Branches', 'Staff', 'Plan', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}
                  className="hover:bg-[var(--surface-3)] transition-colors">

                  {/* Name + Slug */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center text-white font-bold flex-shrink-0">
                        {r.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>/{r.slug}</p>
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="px-5 py-3">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.owner_name || '—'}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.owner_email || ''}</p>
                  </td>

                  {/* Branches */}
                  <td className="px-5 py-3">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {r.branches_count}
                    </span>
                    <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                      / {r.max_branches}
                    </span>
                  </td>

                  {/* Staff */}
                  <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {r.staff_count}
                  </td>

                  {/* Plan */}
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold capitalize px-2.5 py-1 rounded-full"
                      style={{ color: PLAN_COLOR[r.plan], background: `${PLAN_COLOR[r.plan]}18` }}>
                      {r.plan}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <span className={`badge ${r.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleMutation.mutate(r.id)}
                        className="btn btn-ghost btn-sm btn-icon" title="Toggle active">
                        {r.is_active
                          ? <ToggleRight size={16} className="text-green-400" />
                          : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => { setSelected(r); setModal('edit'); }}
                        className="btn btn-ghost btn-sm btn-icon" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(r)}
                        className="btn btn-ghost btn-sm btn-icon hover:text-red-400" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <RestaurantModal
          restaurant={modal === 'edit' ? selected : null}
          owners={owners}
          onClose={() => { setModal(null); setSelected(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}