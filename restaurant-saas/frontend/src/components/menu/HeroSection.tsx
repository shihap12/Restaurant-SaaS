import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { Branch } from '@/types';
import { MapPin, Clock, Star } from 'lucide-react';

interface HeroSectionProps {
  branch: Branch | null;
}

export default function HeroSection({ branch }: HeroSectionProps) {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-hero-title]',
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 }
      );
      gsap.fromTo('[data-hero-sub]',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.4 }
      );
      gsap.fromTo('[data-hero-badge]',
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.1, duration: 0.4, delay: 0.6, ease: 'back.out(1.5)' }
      );
    }, heroRef);
    return () => ctx.revert();
  }, []);

  const isOpen = branch?.is_accepting_orders ?? true;

  return (
    <div ref={heroRef} className="relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface) 100%)' }}>
      {/* Decorative gradient blob */}
      <div className="absolute top-0 right-0 w-96 h-96 opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--brand-500) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

      <div className="container-app py-12 pb-8 relative">
        {/* Status badge */}
        <div data-hero-badge className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-sm"
          style={{
            background: isOpen ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isOpen ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: isOpen ? '#4ade80' : '#f87171',
          }}>
          <span className={`status-dot ${isOpen ? 'live' : ''}`}
            style={{ background: isOpen ? '#22c55e' : '#ef4444' }} />
          {isOpen ? 'Now Accepting Orders' : 'Currently Closed'}
        </div>

        {/* Title */}
        <h1 data-hero-title className="text-4xl sm:text-5xl font-display font-bold mb-3 leading-tight"
          style={{ color: 'var(--text-primary)' }}>
          {branch?.name || 'Our Menu'}
        </h1>

        {/* Subtitle */}
        <p data-hero-sub className="text-lg max-w-xl leading-relaxed mb-6"
          style={{ color: 'var(--text-secondary)' }}>
          {branch?.restaurant?.branding?.tagline ||
           branch?.restaurant?.description ||
           'Explore our carefully crafted menu — from starters to desserts.'}
        </p>

        {/* Info Badges */}
        <div className="flex flex-wrap gap-3">
          {branch?.address && (
            <span data-hero-badge className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <MapPin size={13} style={{ color: 'var(--brand-400)' }} />
              {branch.address.split(',')[0]}
            </span>
          )}
          {branch?.settings?.estimated_prep_time && (
            <span data-hero-badge className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <Clock size={13} style={{ color: 'var(--brand-400)' }} />
              ~{branch.settings.estimated_prep_time} min prep
            </span>
          )}
          <span data-hero-badge className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
            style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            <Star size={13} className="text-yellow-400 fill-yellow-400" />
            4.8 · 1,200+ reviews
          </span>
        </div>
      </div>
    </div>
  );
}
