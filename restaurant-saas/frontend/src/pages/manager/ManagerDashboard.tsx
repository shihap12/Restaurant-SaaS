import { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, TrendingUp, Users, Clock, CheckCircle } from 'lucide-react';
import { orderApi, analyticsApi } from '@/api';
import { useAuthStore, useBranchStore } from '@/store';
import type { Order, OrderStatus } from '@/types';
import { useBranchOrders } from '@/hooks/useWebSocket';
import { useStaggerAnimation, useCountUp } from '@/hooks/useGSAP';
import toast from 'react-hot-toast';
import gsap from 'gsap';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#facc15',
  accepted: '#60a5fa',
  preparing: 'var(--brand-400)',
  ready: '#4ade80',
  delivered: '#a3a3a3',
  cancelled: '#f87171',
};

const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};

export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const queryClient = useQueryClient();
  const statsRef = useRef<HTMLDivElement>(null);
  const ordersRef = useRef<HTMLDivElement>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());

  useStaggerAnimation(statsRef, '[data-stat]', { stagger: 0.08 });

  // Fetch today's orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', branchId, 'live'],
    queryFn: () => orderApi.getAll(branchId, { status: 'active', per_page: 50 }),
    select: res => (res.data.data as Order[]).filter(o =>
      ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)
    ),
    refetchInterval: 30000,
  });

  // Analytics overview
  const { data: overview } = useQuery({
    queryKey: ['analytics', branchId, 'day'],
    queryFn: () => analyticsApi.getOverview(branchId, 'day'),
    select: res => res.data.data as Record<string, number>,
  });

  // Real-time new orders
  useBranchOrders({
    branchId,
    onNewOrder: (event) => {
      toast.custom((t) => (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-modal ${t.visible ? 'animate-slide-up' : ''}`}
          style={{ background: 'var(--surface-2)', border: '1px solid var(--brand-500)', maxWidth: 300 }}>
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

      // Clear highlight after 5s
      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev);
          next.delete(event.order_id);
          return next;
        });
      }, 5000);
    },
    onOrderUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', branchId] });
    },
  });

  // Update order status
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      orderApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', branchId] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  // Group orders by status
  const grouped = {
    pending: orders.filter(o => o.status === 'pending'),
    accepted: orders.filter(o => o.status === 'accepted'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready'),
  };

  const sym = currentBranch?.currency_symbol || '$';

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Today Revenue', value: overview?.total_revenue || 0, icon: <TrendingUp size={18} />, prefix: sym, color: '#4ade80' },
          { label: 'Active Orders', value: orders.length, icon: <ShoppingBag size={18} />, color: 'var(--brand-400)' },
          { label: 'Customers Today', value: overview?.total_customers || 0, icon: <Users size={18} />, color: '#60a5fa' },
          { label: 'Avg Wait Time', value: 18, icon: <Clock size={18} />, suffix: 'min', color: '#facc15' },
        ].map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      {/* Live Orders Board */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
            Live Orders Board
          </h2>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="status-dot live" />
            Real-time
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-48 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {(['pending', 'accepted', 'preparing', 'ready'] as OrderStatus[]).map(status => (
              <OrderColumn
                key={status}
                status={status}
                orders={grouped[status as keyof typeof grouped] || []}
                newOrderIds={newOrderIds}
                onStatusChange={(id) => {
                  const next = STATUS_NEXT[status];
                  if (next) updateStatus.mutate({ id, status: next });
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
  label: string; value: number; icon: React.ReactNode;
  prefix?: string; suffix?: string; color: string;
}) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useCountUp(valueRef as any, value, 1.5, prefix, suffix);

  return (
    <div data-stat className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18`, color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-display font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
        <span ref={valueRef}>{prefix}0{suffix}</span>
      </p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

// ─── Order Column ─────────────────────────────

function OrderColumn({ status, orders, newOrderIds, onStatusChange }: {
  status: OrderStatus;
  orders: Order[];
  newOrderIds: Set<number>;
  onStatusChange: (id: number) => void;
}) {
  const labels: Record<string, string> = {
    pending: '🔔 Pending',
    accepted: '✅ Accepted',
    preparing: '👨‍🍳 Preparing',
    ready: '📦 Ready',
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between"
        style={{ borderLeft: `3px solid ${STATUS_COLORS[status]}` }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {labels[status]}
        </span>
        {orders.length > 0 && (
          <span className="badge" style={{
            background: `${STATUS_COLORS[status]}18`,
            color: STATUS_COLORS[status],
            border: `1px solid ${STATUS_COLORS[status]}30`,
          }}>
            {orders.length}
          </span>
        )}
      </div>

      {/* Orders */}
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
              nextStatus={STATUS_NEXT[status]}
              onAdvance={() => onStatusChange(order.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────

function OrderCard({ order, isNew, nextStatus, onAdvance }: {
  order: Order;
  isNew: boolean;
  nextStatus?: OrderStatus;
  onAdvance: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const sym = '$';

  useEffect(() => {
    if (isNew && cardRef.current) {
      gsap.fromTo(cardRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.4)' }
      );
    }
  }, [isNew]);

  const elapsed = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <div
      ref={cardRef}
      className={`p-3 rounded-xl border transition-all duration-300 ${
        isNew ? 'border-[var(--brand-500)] bg-[rgba(var(--brand-rgb),0.06)]' : 'border-[var(--border)]'
      }`}
      style={{ background: isNew ? undefined : 'var(--surface-3)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
          #{order.order_number}
        </span>
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <Clock size={11} />{elapsed}m ago
        </span>
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
          {sym}{order.total.toFixed(2)}
        </span>
        {nextStatus && (
          <button
            onClick={onAdvance}
            className="btn btn-primary btn-sm text-xs"
          >
            → {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
          </button>
        )}
      </div>
    </div>
  );
}
