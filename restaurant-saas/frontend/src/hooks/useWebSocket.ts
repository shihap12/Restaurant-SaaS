/**
 * Real-time hooks — polling based (works perfectly on XAMPP).
 * No WebSocket server required. Polls the PHP API every N seconds.
 *
 * For true WebSockets you'd need a separate Node/Ratchet server,
 * but polling every 5-10s gives a great real-time feel on XAMPP.
 */

import { useEffect, useRef, useCallback } from 'react';
import { orderApi } from '@/api';
import type { OrderStatus, Notification } from '@/types';

// ─── Branch Orders polling ────────────────────
interface UseBranchOrdersOptions {
  branchId: number;
  onNewOrder?:   (event: { order_id: number; order_number: string; customer_name: string; total: number; type: string; table_number?: string }) => void;
  onOrderUpdate?:(event: { order_id: number; order_number: string; status: string }) => void;
  intervalMs?:   number;
}

export function useBranchOrders({
  branchId,
  onNewOrder,
  onOrderUpdate,
  intervalMs = 8000,
}: UseBranchOrdersOptions) {
  const lastOrderIdRef   = useRef<number>(0);
  const lastStatusMapRef = useRef<Record<number, string>>({});
  const timerRef         = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    if (!branchId) return;
    try {
      const res   = await orderApi.getAll(branchId, { status: 'active', per_page: 50, today: true });
      const orders = (res.data.data as { id: number; order_number: string; status: string; customer_name: string; total: number; type: string; table_number?: string }[]) ?? [];

      for (const order of orders) {
        // Detect new orders
        if (order.id > lastOrderIdRef.current) {
          if (lastOrderIdRef.current > 0) {
            onNewOrder?.({
              order_id:      order.id,
              order_number:  order.order_number,
              customer_name: order.customer_name,
              total:         order.total,
              type:          order.type,
              table_number:  order.table_number,
            });
          }
          lastOrderIdRef.current = Math.max(lastOrderIdRef.current, order.id);
        }

        // Detect status changes
        const prevStatus = lastStatusMapRef.current[order.id];
        if (prevStatus && prevStatus !== order.status) {
          onOrderUpdate?.({
            order_id:     order.id,
            order_number: order.order_number,
            status:       order.status,
          });
        }
        lastStatusMapRef.current[order.id] = order.status;
      }

      // Seed lastOrderId on first poll
      if (lastOrderIdRef.current === 0 && orders.length > 0) {
        lastOrderIdRef.current = Math.max(...orders.map(o => o.id));
        orders.forEach(o => { lastStatusMapRef.current[o.id] = o.status; });
      }
    } catch {
      // Silently ignore network errors during polling
    }
  }, [branchId, onNewOrder, onOrderUpdate]);

  useEffect(() => {
    if (!branchId) return;
    poll(); // initial fetch
    timerRef.current = setInterval(poll, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [branchId, intervalMs, poll]);
}

// ─── Order Tracking polling ───────────────────
interface UseOrderTrackingOptions {
  orderNumber: string;
  onStatusChange?: (status: OrderStatus, eta?: string) => void;
  intervalMs?: number;
}

export function useOrderTracking({
  orderNumber,
  onStatusChange,
  intervalMs = 6000,
}: UseOrderTrackingOptions) {
  const lastStatusRef = useRef<string>('');
  const timerRef      = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!orderNumber) return;

    const poll = async () => {
      try {
        const res   = await orderApi.getOrderByNumber(orderNumber);
        const order = res.data.data as { status: OrderStatus; estimated_ready_at?: string };

        if (order.status !== lastStatusRef.current) {
          lastStatusRef.current = order.status;
          const eta = order.estimated_ready_at
            ? new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : undefined;
          onStatusChange?.(order.status, eta);
        }
      } catch {
        // ignore
      }
    };

    poll();
    timerRef.current = setInterval(poll, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [orderNumber, intervalMs]);
}

// ─── Notification polling (stub) ──────────────
interface UseNotificationsOptions {
  userId?: number;
  onNotification?: (notification: Notification) => void;
}

export function useNotifications(_options: UseNotificationsOptions) {
  // Notifications come through order polling above on XAMPP setup.
  // Hook kept for API compatibility with DashboardLayout.
}
