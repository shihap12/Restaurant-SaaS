import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Clock, AlertCircle } from 'lucide-react';
import { orderApi } from '@/api';
import { useAuthStore, useBranchStore } from '@/store';
import type { Order } from '@/types';
import { useBranchOrders } from '@/hooks/useWebSocket';
import { usePageTransition } from '@/hooks/useGSAP';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export default function ChefDashboard() {
  const { user } = useAuthStore();
  const { currentBranch } = useBranchStore();
  const branchId = currentBranch?.id || user?.branch_id || 1;
  const queryClient = useQueryClient();
  const pageRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['chef-orders', branchId],
    queryFn: () => orderApi.getAll(branchId, { status: 'active', per_page: 100 }),
    select: res => (res.data.data as Order[]).filter(o =>
      ['accepted', 'preparing'].includes(o.status)
    ),
    refetchInterval: 15000,
  });

  useBranchOrders({
    branchId,
    onNewOrder: () => queryClient.invalidateQueries({ queryKey: ['chef-orders', branchId] }),
    onOrderUpdate: () => queryClient.invalidateQueries({ queryKey: ['chef-orders', branchId] }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      orderApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef-orders', branchId] });
      toast.success('Order updated!');
    },
  });

  const accepted  = orders.filter(o => o.status === 'accepted');
  const preparing = orders.filter(o => o.status === 'preparing');

  return (
    <div ref={pageRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center">
            <ChefHat size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
              Kitchen Queue
            </h1>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="status-dot live" />
              <span style={{ color: 'var(--text-muted)' }}>Live — {orders.length} active</span>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">👨‍🍳</div>
          <h3 className="text-xl font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            All caught up!
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>No orders in the kitchen right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accepted — Start Preparing */}
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--text-secondary)' }}>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              New Orders ({accepted.length})
            </h2>
            <div className="space-y-3">
              {accepted.map(order => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  action={{ label: 'Start Preparing 👨‍🍳', nextStatus: 'preparing' }}
                  onAction={() => updateStatus.mutate({ id: order.id, status: 'preparing' })}
                />
              ))}
            </div>
          </div>

          {/* Preparing — Mark Ready */}
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--text-secondary)' }}>
              <div className="w-2.5 h-2.5 rounded-full animate-pulse-soft"
                style={{ background: 'var(--brand-500)' }} />
              Preparing ({preparing.length})
            </h2>
            <div className="space-y-3">
              {preparing.map(order => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  action={{ label: 'Mark Ready ✅', nextStatus: 'ready' }}
                  onAction={() => updateStatus.mutate({ id: order.id, status: 'ready' })}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KitchenCard({ order, action, onAction }: {
  order: Order;
  action: { label: string; nextStatus: string };
  onAction: () => void;
}) {
  const elapsed = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isUrgent = elapsed > 20;

  return (
    <div className={`card p-4 transition-all ${isUrgent ? 'border-red-500/30' : ''}`}
      style={isUrgent ? { borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.03)' } : {}}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              #{order.order_number}
            </span>
            {order.table_number && (
              <span className="badge badge-brand text-xs">Table {order.table_number}</span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
              {order.type === 'dine_in' ? '🍽️ Dine-In' : order.type === 'delivery' ? '🛵 Delivery' : '🏃 Pickup'}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {order.customer_name}
          </p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-red-400' : ''}`}
          style={!isUrgent ? { color: 'var(--text-muted)' } : {}}>
          <Clock size={12} />
          {elapsed}m
          {isUrgent && <AlertCircle size={12} />}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5 mb-4">
        {order.items.map(item => (
          <div key={item.id} className="flex items-start gap-2 text-sm">
            <span className="font-bold text-xs px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: 'var(--brand-500)', color: '#fff' }}>
              ×{item.quantity}
            </span>
            <div>
              <span style={{ color: 'var(--text-primary)' }}>{item.product_name}</span>
              {item.variant_name && (
                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>({item.variant_name})</span>
              )}
              {item.special_instructions && (
                <p className="text-xs italic mt-0.5" style={{ color: 'var(--brand-300)' }}>
                  ⚡ {item.special_instructions}
                </p>
              )}
            </div>
          </div>
        ))}
        {order.special_instructions && (
          <div className="p-2 rounded-lg text-xs mt-2 italic"
            style={{ background: 'rgba(var(--brand-rgb),0.08)', color: 'var(--brand-300)' }}>
            📝 {order.special_instructions}
          </div>
        )}
      </div>

      <button onClick={onAction} className="btn btn-primary w-full text-sm">
        {action.label}
      </button>
    </div>
  );
}
