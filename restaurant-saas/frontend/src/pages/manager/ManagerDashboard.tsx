import { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, TrendingUp, Users, Clock, CheckCircle } from 'lucide-react';
import { orderApi, analyticsApi } from '@/api';
import { useAuthStore, useBranchStore } from '@/store';
import type { Order } from '@/types';
import { useBranchOrders } from '@/hooks/useWebSocket';
import { useStaggerAnimation, useCountUp } from '@/hooks/useGSAP';
import toast from 'react-hot-toast';
import gsap from 'gsap';

// ─── Backend status colours ───────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:   '#facc15',
  accepted:  '#60a5fa',
  preparing: 'var(--brand-400)',
  ready:     '#4ade80',
  served:    '#a78bfa',
  delivered: '#a3a3a3',
  completed: '#a3a3a3',
  cancelled: '#f87171',
};

// ─── Next-status maps ─────────────────────────────────────────────────────
//
//  Dine-in:          pending → accepted → preparing → served → completed
//  Delivery/Pickup:  pending → accepted → preparing → ready  → delivered
//
const STATUS_NEXT_DINEIN: Record<string, string> = {
  pending:   'accepted',
  accepted:  'preparing',
  preparing: 'served',
};

const STATUS_NEXT_DELIVERY: Record<string, string> = {
  pending:   'accepted',
  accepted:  'preparing',
  preparing: 'ready',
  ready:     'delivered',
};

export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const queryClient = useQueryClient();
  const statsRef = useRef<HTMLDivElement>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());

  useStaggerAnimation(statsRef, '[data-stat]', { stagger: 0.08 });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', branchId, 'live'],
    queryFn: () => orderApi.getAll(branchId, { status: 'active', per_page: 50 }),
    select: res => (res.data.data as Order[]).filter(o =>
      ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
    ),
    refetchInterval: 30000,
  });

  const { data: overview } = useQuery({
    queryKey: ['analytics', branchId, 'day'],
    queryFn: () => analyticsApi.getOverview(branchId, 'day'),
    select: res => res.data.data as Record<string, number>,
  });

  useBranchOrders({
    branchId,
    onNewOrder: (event) => {
      toast.custom((t) => (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-modal ${t.visible ? 'animate-slide-up' : ''}`}
          style={{ background: 'var(--surface-2)', border: '1px solid var(--brand-500)', maxWidth: 300 }}
        >
          <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              New Order #{event.order_number}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {event.customer_name} · ${event.total.toFixed(2)}
            </p>
          </div>
        </div>
      ), { duration: 5000 });

      setNewOrderIds(prev => new Set([...prev, event.order_id]));
      queryClient.invalidateQueries({ queryKey: ['orders', branchId] });
      setTimeout(() => {
        setNewOrderIds(prev => { const n = new Set(prev); n.delete(event.order_id); return n; });
      }, 5000);
    },
    onOrderUpdate: () => queryClient.invalidateQueries({ queryKey: ['orders', branchId] }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      orderApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', branchId] }),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update status'),
  });

  const grouped = {
    pending:   orders.filter(o => o.status === 'pending'),
    accepted:  orders.filter(o => o.status === 'accepted'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready:     orders.filter(o => o.status === 'ready'),
    served:    orders.filter(o => o.status === 'served'),
  };

  const sym = currentBranch?.currency_symbol || '$';
  const canAdvance = ['super_admin', 'owner', 'cashier', 'chef'].includes(user?.role || '');

  function getNextStatus(order: Order, columnStatus: string): string | undefined {
    return order.type === 'dine_in'
      ? STATUS_NEXT_DINEIN[columnStatus]
      : STATUS_NEXT_DELIVERY[columnStatus];
  }

  const columns: { status: string; label: string }[] = [
    { status: 'pending',   label: '🔔 Pending'     },
    { status: 'accepted',  label: '✅ Accepted'    },
    { status: 'preparing', label: '👨‍🍳 Preparing' },
    { status: 'ready',     label: '📦 Ready'       },
    { status: 'served',    label: '🍽️ Served'      },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Today Revenue',   value: overview?.total_revenue  || 0, icon: <TrendingUp size={18} />, prefix: sym, color: '#4ade80'          },
          { label: 'Active Orders',   value: orders.length,                 icon: <ShoppingBag size={18} />,             color: 'var(--brand-400)' },
          { label: 'Customers Today', value: overview?.total_customers || 0, icon: <Users size={18} />,                 color: '#60a5fa'           },
          { label: 'Avg Wait Time',   value: 18,                            icon: <Clock size={18} />,     suffix: 'min', color: '#facc15'          },
        ].map((stat, i) => <StatCard key={i} {...stat} />)}
      </div>

      {/* Live Orders Board */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
            Live Orders Board
          </h2>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="status-dot live" /> Real-time
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {columns.map(({ status, label }) => (
              <OrderColumn
                key={status}
                status={status}
                label={label}
                orders={grouped[status as keyof typeof grouped] || []}
                newOrderIds={newOrderIds}
                canAdvance={canAdvance}
                onStatusChange={(order) => {
                  const next = getNextStatus(order, status);
                  if (next) updateStatus.mutate({ id: order.id, status: next });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────

function StatCard({ label, value, icon, prefix = '', suffix = '', color }: {
  label: string; value: number; icon: React.ReactNode; prefix?: string; suffix?: string; color: string;
}) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useCountUp(valueRef as any, value, 1.5, prefix, suffix);
  return (
    <div data-stat className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18`, color }}>{icon}</div>
      </div>
      <p className="text-2xl font-display font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
        <span ref={valueRef}>{prefix}0{suffix}</span>
      </p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

// ─── Order Column ─────────────────────────────

function OrderColumn({ status, label, orders, newOrderIds, onStatusChange, canAdvance }: {
  status: string; label: string; orders: Order[];
  newOrderIds: Set<number>; canAdvance: boolean; onStatusChange: (order: Order) => void;
}) {
  const color = STATUS_COLORS[status] || '#a3a3a3';
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between" style={{ borderLeft: `3px solid ${color}` }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
        {orders.length > 0 && (
          <span className="badge" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
            {orders.length}
          </span>
        )}
      </div>
      <div className="flex-1 p-3 space-y-3 max-h-96 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle size={28} style={{ color: 'var(--text-muted)' }} className="mb-2" />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No orders</p>
          </div>
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              isNew={newOrderIds.has(order.id)}
              columnStatus={status}
              canAdvance={canAdvance}
              onAdvance={() => onStatusChange(order)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────

function OrderCard({ order, isNew, columnStatus, onAdvance, canAdvance }: {
  order: Order; isNew: boolean; columnStatus: string; canAdvance: boolean; onAdvance: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isNew && cardRef.current) {
      gsap.fromTo(cardRef.current, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.4)' });
    }
  }, [isNew]);

  const elapsed = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);

  const nextMap = order.type === 'dine_in' ? STATUS_NEXT_DINEIN : STATUS_NEXT_DELIVERY;
  const next = nextMap[columnStatus];
  const advanceLabels: Record<string, string> = {
    accepted:  '→ Accept',
    preparing: '→ Prepare',
    served:    '→ Served',
    ready:     '→ Ready',
    delivered: '→ Delivered',
  };
  const advanceLabel = next ? (advanceLabels[next] || `→ ${next}`) : '';

  return (
    <div
      ref={cardRef}
      className={`p-3 rounded-xl border transition-all duration-300 ${isNew ? 'border-[var(--brand-500)] bg-[rgba(var(--brand-rgb),0.06)]' : 'border-[var(--border)]'}`}
      style={{ background: isNew ? undefined : 'var(--surface-3)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
          #{order.order_number}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            {order.type === 'dine_in' ? '🍽️' : order.type === 'delivery' ? '🛵' : '🏃'}
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Clock size={11} />{elapsed}m
          </span>
        </div>
      </div>

      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {order.customer_name}
        {order.table_number && <span style={{ color: 'var(--text-muted)' }}> · Table {order.table_number}</span>}
      </p>

      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        {order.items.map(i => `${i.quantity}× ${i.product_name}`).join(', ')}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: 'var(--brand-400)' }}>
          ${order.total.toFixed(2)}
        </span>
        {canAdvance && advanceLabel && (
          <button onClick={onAdvance} className="btn btn-primary btn-sm text-xs">
            {advanceLabel}
          </button>
        )}
      </div>
    </div>
  );
}