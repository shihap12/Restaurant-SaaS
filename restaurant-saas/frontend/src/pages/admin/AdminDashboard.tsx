import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Store, Users, ShoppingBag, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTransition, useStaggerAnimation } from '@/hooks/useGSAP';
import api from '@/api';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ───────────────────────────────────
interface PlatformOverview {
  total_restaurants:  number;
  active_restaurants: number;
  total_branches:     number;
  active_branches:    number;
  total_staff:        number;
  orders_today:       number;
  revenue_today:      number;
  pending_orders:     number;
}

interface AdminData {
  overview:       PlatformOverview;
  recent_orders:  any[];
  revenue_chart:  any[];
  restaurants:    any[];
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'badge-warning',
  accepted:  'badge-brand',
  preparing: 'badge-brand',
  ready:     'badge-success',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
};

export default function AdminDashboard() {
  const pageRef  = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  useStaggerAnimation(statsRef, '[data-stat]', { stagger: 0.08 });

  const { data, isLoading } = useQuery<AdminData>({
    queryKey: ['admin-overview'],
    queryFn:  () => api.get('/admin/overview').then(r => r.data.data),
    refetchInterval: 30_000,
  });

  const ov = data?.overview;

  const stats = [
    {
      label: 'Total Restaurants',
      value: ov?.total_restaurants ?? '—',
      sub:   `${ov?.active_restaurants ?? 0} active`,
      icon:  <Store size={18} />,
      color: '#f97316',
    },
    {
      label: 'Total Branches',
      value: ov?.total_branches ?? '—',
      sub:   `${ov?.active_branches ?? 0} active`,
      icon:  <Globe size={18} />,
      color: '#60a5fa',
    },
    {
      label: 'Total Staff',
      value: ov?.total_staff ?? '—',
      sub:   'across all branches',
      icon:  <Users size={18} />,
      color: '#4ade80',
    },
    {
      label: "Today's Orders",
      value: ov?.orders_today ?? '—',
      sub:   `${ov?.pending_orders ?? 0} pending`,
      icon:  <ShoppingBag size={18} />,
      color: '#a78bfa',
    },
  ];

  return (
    <div ref={pageRef} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Platform Overview
        </h1>
        {ov && (
          <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl"
            style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
            <TrendingUp size={14} style={{ color: '#4ade80' }} />
            <span>Revenue today:</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {ov.revenue_today.toLocaleString()} SAR
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} data-stat className="card p-5">
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--surface-3)' }} />
                <div className="h-8 w-16 rounded-lg" style={{ background: 'var(--surface-3)' }} />
                <div className="h-3 w-24 rounded" style={{ background: 'var(--surface-3)' }} />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl" style={{ background: `${s.color}18`, color: s.color }}>
                    {s.icon}
                  </div>
                </div>
                <p className="text-3xl font-display font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                  {s.value}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Orders */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recent Orders
            </h2>
            {(ov?.pending_orders ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
                <AlertCircle size={12} />
                {ov?.pending_orders} pending
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="h-4 flex-1 rounded" style={{ background: 'var(--surface-3)' }} />
                    <div className="h-4 w-20 rounded" style={{ background: 'var(--surface-3)' }} />
                    <div className="h-4 w-16 rounded" style={{ background: 'var(--surface-3)' }} />
                  </div>
                ))}
              </div>
            ) : (data?.recent_orders?.length ?? 0) === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                No orders today yet
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Order', 'Customer', 'Branch', 'Total', 'Status', 'Time'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.recent_orders.map((order: any) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}
                      className="hover:bg-[var(--surface-3)] transition-colors">
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--brand-400)' }}>
                        #{order.order_number}
                      </td>
                      <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {order.customer_name}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {order.branch_name}
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {Number(order.total).toLocaleString()} SAR
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${STATUS_COLOR[order.status] || 'badge-neutral'} capitalize`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Restaurants Quick View */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Restaurants</h2>
            <Link to="/admin/restaurants" className="btn btn-secondary btn-sm">Manage</Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {isLoading ? (
              <div className="p-5 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3 items-center">
                    <div className="w-9 h-9 rounded-xl" style={{ background: 'var(--surface-3)' }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-28 rounded" style={{ background: 'var(--surface-3)' }} />
                      <div className="h-3 w-20 rounded" style={{ background: 'var(--surface-3)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (data?.restaurants ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No restaurants yet
              </div>
            ) : (
              data?.restaurants.map((r: any) => (
                <div key={r.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-[var(--surface-3)] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {r.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {r.branches_count} {r.branches_count === 1 ? 'branch' : 'branches'}
                        {r.orders_today > 0 && ` · ${r.orders_today} orders today`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
                      {r.plan}
                    </span>
                    <span className={`badge ${r.is_active ? 'badge-success' : 'badge-neutral'} text-xs`}>
                      {r.is_active ? 'Active' : 'Off'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}