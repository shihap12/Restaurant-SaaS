import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Plus, Search, AlertTriangle, CheckCircle,
  XCircle, Clock, RefreshCw, X, Loader, PauseCircle,
  PlayCircle, TrendingUp, Calendar, Building2,
} from 'lucide-react';
import { usePageTransition } from '@/hooks/useGSAP';
import api from '@/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ───────────────────────────────────
interface Subscription {
  id:                number;
  restaurant_id:     number;
  restaurant_name:   string;
  restaurant_slug:   string;
  owner_name:        string;
  owner_email:       string;
  plan:              'trial' | 'basic' | 'pro' | 'enterprise';
  status:            'active' | 'expired' | 'cancelled' | 'suspended';
  amount:            number;
  currency:          string;
  starts_at:         string;
  expires_at:        string;
  days_remaining:    number | null;
  is_expired:        boolean;
  is_expiring_soon:  boolean;
  notes:             string | null;
  created_by_name:   string | null;
  created_at:        string;
}

interface Restaurant { id: number; name: string; plan: string; }

// ─── Constants ───────────────────────────────
const PLAN_CONFIG = {
  trial:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Trial',      price: 0    },
  basic:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Basic',      price: 299  },
  pro:        { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Pro',        price: 699  },
  enterprise: { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  label: 'Enterprise', price: 1499 },
};

const STATUS_CONFIG = {
  active:    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: <CheckCircle size={13} />,  label: 'Active'    },
  expired:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: <XCircle size={13} />,      label: 'Expired'   },
  cancelled: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: <XCircle size={13} />,      label: 'Cancelled' },
  suspended: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: <PauseCircle size={13} />,  label: 'Suspended' },
};

// ─── New Subscription Modal ───────────────────
function SubscriptionModal({
  restaurants,
  onClose,
  onSave,
  isSaving,
}: {
  restaurants: Restaurant[];
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    restaurant_id:    '',
    plan:             'basic',
    amount:           '299',
    duration_months:  '12',
    currency:         'SAR',
    notes:            '',
    starts_at:        new Date().toISOString().slice(0, 10),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handlePlanChange = (plan: string) => {
    set('plan', plan);
    set('amount', String(PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.price ?? 0));
  };

  const expiresAt = form.starts_at
    ? new Date(new Date(form.starts_at).setMonth(new Date(form.starts_at).getMonth() + Number(form.duration_months)))
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.restaurant_id) return toast.error('Please select a restaurant.');
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pt-60 p-4"
  style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
  <div className="card w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>

    {/* Header */}
    <div className="px-6 py-4 flex items-center justify-between"
      style={{ borderBottom: '1px solid var(--border)' }}>
      <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
        New Subscription
      </h2>
      <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
    </div>

    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

      {/* Restaurant */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Restaurant *
        </label>
        <select value={form.restaurant_id} onChange={e => set('restaurant_id', e.target.value)}
          className="input" required>
          <option value="">Select restaurant...</option>
          {restaurants.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Plan */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Plan *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PLAN_CONFIG).map(([key, cfg]) => (
            <button key={key} type="button"
              onClick={() => handlePlanChange(key)}
              className={`p-3 rounded-xl border text-left transition-all ${
                form.plan === key ? 'ring-1' : ''
              }`}
              style={{
                background: form.plan === key ? cfg.bg : 'var(--surface-3)',
                borderColor: form.plan === key ? cfg.color : 'var(--border)',
                boxShadow: form.plan === key ? `0 0 0 1px ${cfg.color}` : 'none',
              }}>
              <p className="text-sm font-semibold" style={{ color: form.plan === key ? cfg.color : 'var(--text-primary)' }}>
                {cfg.label}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {cfg.price === 0 ? 'Free' : `${cfg.price} SAR/yr`}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Amount + Currency */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Amount *
          </label>
          <input type="number" min="0" value={form.amount}
            onChange={e => set('amount', e.target.value)}
            className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Currency
          </label>
          <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
            {['SAR', 'USD', 'AED', 'KWD'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Start Date + Duration */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Start Date
          </label>
          <input type="date" value={form.starts_at}
            onChange={e => set('starts_at', e.target.value)}
            className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Duration (months)
          </label>
          <select value={form.duration_months}
            onChange={e => set('duration_months', e.target.value)} className="input">
            {[1, 3, 6, 12, 24].map(m => (
              <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expires At Preview */}
      {expiresAt && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
          style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
          <Calendar size={13} />
          Expires: <span style={{ color: 'var(--text-primary)' }} className="font-medium">
            {format(expiresAt, 'MMM dd, yyyy')}
          </span>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Notes
        </label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          className="input resize-none" rows={2}
          placeholder="Payment reference, notes..." />
      </div>

      {/* Footer Buttons */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="btn btn-primary flex-1">
          {isSaving ? (
            <div className="flex items-center justify-center gap-2">
              <Loader size={14} className="animate-spin" />
              <span>Creating...</span>
            </div>
          ) : (
            'Create Subscription'
          )}
        </button>
      </div>
    </form>
  </div>
</div>
  );
}

// ─── Days Badge ───────────────────────────────
function DaysBadge({ sub }: { sub: Subscription }) {
  if (sub.status !== 'active') return null;

  if (sub.is_expired) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
        Expired
      </span>
    );
  }

  if (sub.is_expiring_soon) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
        style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>
        <AlertTriangle size={10} /> {sub.days_remaining}d left
      </span>
    );
  }

  return (
    <span className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
      {sub.days_remaining}d left
    </span>
  );
}

// ─── Main Page ───────────────────────────────
export default function AdminSubscriptions() {
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  const queryClient = useQueryClient();

  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatus]     = useState('');
  const [showModal,   setShowModal]   = useState(false);

  // ── Queries ──────────────────────────────
  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ['subscriptions', statusFilter],
    queryFn:  () => api.get('/subscriptions', {
      params: { status: statusFilter || undefined }
    }).then(r => r.data.data ?? [] ),
    refetchInterval: 60_000,
  });

  const { data: expiringSoon = [] } = useQuery<Subscription[]>({
    queryKey: ['subscriptions-expiring'],
    queryFn:  () => api.get('/subscriptions/expiring', { params: { days: 30 } }).then(r => r.data.data ?? []),
  });

  const { data: restaurants = [] } = useQuery<Restaurant[]>({
    queryKey: ['restaurants-for-sub'],
    queryFn:  () => api.get('/restaurants').then(r => r.data.data??[]),
  });

  // ── Stats ────────────────────────────────
  const stats = {
    active:    subscriptions.filter(s => s.status === 'active').length,
    expiring:  expiringSoon.length,
    suspended: subscriptions.filter(s => s.status === 'suspended').length,
    revenue:   subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + s.amount, 0),
  };

  // ── Mutations ────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/subscriptions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      toast.success('Subscription created!');
      setShowModal(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to create.'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.patch(`/subscriptions/${id}/${action}`),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      const msgs: Record<string, string> = {
        cancel:     'Subscription cancelled.',
        suspend:    'Subscription suspended.',
        reactivate: 'Subscription reactivated!',
      };
      toast.success(msgs[action] ?? 'Done.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Action failed.'),
  });

  const handleAction = (id: number, action: string, label: string) => {
    if (!confirm(`${label} this subscription?`)) return;
    actionMutation.mutate({ id, action });
  };

  // ── Filter ───────────────────────────────
  const filtered = subscriptions.filter(s =>
    s.restaurant_name.toLowerCase().includes(search.toLowerCase()) ||
    s.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={pageRef} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Subscriptions
        </h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm gap-1.5">
          <Plus size={15} /> New Subscription
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active',
            value: stats.active,
            icon: <CheckCircle size={16} />,
            color: '#4ade80',
          },
          {
            label: 'Expiring Soon',
            value: stats.expiring,
            icon: <AlertTriangle size={16} />,
            color: '#fb923c',
          },
          {
            label: 'Suspended',
            value: stats.suspended,
            icon: <PauseCircle size={16} />,
            color: '#f87171',
          },
          {
            label: 'Total Revenue',
            value: `${stats.revenue.toLocaleString()} SAR`,
            icon: <TrendingUp size={16} />,
            color: 'var(--brand-400)',
          },
        ].map((s, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl"
                style={{ background: `${s.color}18`, color: s.color }}>
                {s.icon}
              </div>
            </div>
            <p className="text-2xl font-display font-bold mb-0.5"
              style={{ color: 'var(--text-primary)' }}>
              {s.value}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoon.length > 0 && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
          <AlertTriangle size={18} style={{ color: '#fb923c' }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#fb923c' }}>
              {expiringSoon.length} subscription{expiringSoon.length > 1 ? 's' : ''} expiring within 30 days
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {expiringSoon.map(s => s.restaurant_name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search restaurant or owner..." className="input pl-9 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="input text-sm w-auto py-2">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <Loader size={24} className="animate-spin mx-auto mb-3" />
            Loading subscriptions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No subscriptions match your search.' : 'No subscriptions yet.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Restaurant', 'Plan', 'Amount', 'Period', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => {
                const plan   = PLAN_CONFIG[sub.plan] ?? PLAN_CONFIG.trial;
                const status = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.active;
                return (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}
                    className="hover:bg-[var(--surface-3)] transition-colors">

                    {/* Restaurant */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {sub.restaurant_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {sub.restaurant_name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {sub.owner_name} · {sub.owner_email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold capitalize px-2.5 py-1 rounded-full"
                        style={{ color: plan.color, background: plan.bg }}>
                        {plan.label}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3">
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {sub.amount.toLocaleString()} {sub.currency}
                      </p>
                    </td>

                    {/* Period */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {format(new Date(sub.starts_at), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            → {format(new Date(sub.expires_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-1">
                        <DaysBadge sub={sub} />
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"
                        style={{ color: status.color, background: status.bg }}>
                        {status.icon} {status.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {sub.status === 'active' && (
                          <>
                            <button
                              onClick={() => handleAction(sub.id, 'suspend', 'Suspend')}
                              className="btn btn-ghost btn-sm btn-icon"
                              title="Suspend"
                              style={{ color: '#fb923c' }}>
                              <PauseCircle size={15} />
                            </button>
                            <button
                              onClick={() => handleAction(sub.id, 'cancel', 'Cancel')}
                              className="btn btn-ghost btn-sm btn-icon hover:text-red-400"
                              title="Cancel">
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                        {(sub.status === 'suspended' || sub.status === 'expired') && (
                          <button
                            onClick={() => handleAction(sub.id, 'reactivate', 'Reactivate')}
                            className="btn btn-ghost btn-sm btn-icon"
                            title="Reactivate"
                            style={{ color: '#4ade80' }}>
                            <PlayCircle size={15} />
                          </button>
                        )}
                        {/* تجديد = إنشاء اشتراك جديد */}
                        <button
                          onClick={() => setShowModal(true)}
                          className="btn btn-ghost btn-sm btn-icon"
                          title="Renew subscription"
                          style={{ color: 'var(--brand-400)' }}>
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <SubscriptionModal
          restaurants={restaurants}
          onClose={() => setShowModal(false)}
          onSave={data => createMutation.mutate(data)}
          isSaving={createMutation.isPending}
        />
      )}
    </div>
  );
}