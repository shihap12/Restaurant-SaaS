import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingBag, Globe, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTransition, useStaggerAnimation } from '@/hooks/useGSAP';
import { analyticsApi } from '@/api';
import { useAuthStore, useBranchStore } from '@/store';

export default function OwnerDashboard() {
  const pageRef  = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  usePageTransition(pageRef as any);
  useStaggerAnimation(statsRef, '[data-stat]', { stagger: 0.08 });

  const { user }              = useAuthStore();
  const { branches }          = useBranchStore();

  const { data: overview } = useQuery({
    queryKey: ['owner-overview', user?.restaurant_id],
    queryFn: () => analyticsApi.getOverview(branches[0]?.id || 1, 'month'),
    select: res => res.data.data as Record<string, number>,
    enabled: branches.length > 0,
  });

  const stats = [
    { label: 'Monthly Revenue', value: `$${(overview?.total_revenue || 0).toLocaleString()}`, icon: <TrendingUp size={18} />, color: '#4ade80' },
    { label: 'Total Orders',    value: overview?.total_orders || 0,                           icon: <ShoppingBag size={18} />, color: 'var(--brand-400)' },
    { label: 'Active Branches', value: branches.filter(b => b.is_active).length,              icon: <Globe size={18} />,       color: '#60a5fa' },
    { label: 'Avg Order Value', value: `$${(overview?.avg_order_value || 0).toFixed(2)}`,     icon: <BarChart3 size={18} />,   color: '#a78bfa' },
  ];

  return (
    <div ref={pageRef} className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Here's your restaurant performance overview.
        </p>
      </div>

      <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} data-stat className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            </div>
            <p className="text-2xl font-display font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: '/owner/analytics', icon: <BarChart3 size={20} />, label: 'View Analytics',  desc: 'Revenue, heatmaps, products' },
          { to: '/owner/branding',  icon: <Globe size={20} />,     label: 'Branding Studio', desc: 'Customize colors, fonts, content' },
          { to: '/owner/branches',  icon: <Globe size={20} />,     label: 'Manage Branches', desc: 'View and configure all branches' },
        ].map(item => (
          <Link key={item.to} to={item.to}
            className="card p-5 flex items-start gap-3 hover:border-[var(--brand-500)] group transition-all">
            <div className="p-2.5 rounded-xl group-hover:brand-gradient transition-all"
              style={{ background: 'var(--surface-3)', color: 'var(--brand-400)' }}>
              {item.icon}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
