import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/api';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store';

/**
 * useNotifications
 * بيجيب الـ notifications من الـ API ويحدّث الـ UIStore
 * استخدمه مرة واحدة في DashboardLayout
 */
export function useNotifications() {
  const { isAuthenticated } = useAuthStore();
  const { setNotifications, markAllRead: markAllLocal, markRead: markReadLocal } = useUIStore();
  const queryClient = useQueryClient();

  // ── Fetch ────────────────────────────────
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notificationApi.getAll().then(r => r.data.data),
    enabled:  isAuthenticated,
    refetchInterval: 60_000, // كل دقيقة
    staleTime: 30_000,
  });

  // لما تجي بيانات جديدة، حدّث الـ store
  useEffect(() => {
    if (data) {
      setNotifications(data.notifications ?? [], data.unread_count ?? 0);
    }
  }, [data]);

  // ── Mark All Read ────────────────────────
  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.readAll(),
    onMutate: () => {
      // Optimistic update
      markAllLocal();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // ── Mark One Read ────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.read(id),
    onMutate: (id) => {
      markReadLocal(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    markAllRead: () => markAllMutation.mutate(),
    markRead:    (id: number) => markReadMutation.mutate(id),
  };
}