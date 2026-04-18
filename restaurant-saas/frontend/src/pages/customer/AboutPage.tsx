import { MapPin, Phone, Mail } from 'lucide-react';
import { useBranchStore } from '@/store';

export default function AboutPage() {
  const { currentBranch } = useBranchStore();
  const branding = currentBranch?.restaurant?.branding as any;

  return (
    <div className="container-app max-w-2xl py-16">
      <h1 className="text-4xl font-display font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        About {currentBranch?.name || 'Us'}
      </h1>
      <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--text-secondary)' }}>
        {branding?.about_text || 'We are passionate about bringing you the finest culinary experience. Every dish is crafted with care using the freshest ingredients.'}
      </p>

      {currentBranch && (
        <div className="card p-6 space-y-3">
          <h2 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Visit Us</h2>
          <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p className="flex items-center gap-2">
              <MapPin size={15} style={{ color: 'var(--brand-400)' }} />{currentBranch.address}
            </p>
            {currentBranch.phone && (
              <p className="flex items-center gap-2">
                <Phone size={15} style={{ color: 'var(--brand-400)' }} />{currentBranch.phone}
              </p>
            )}
            {currentBranch.email && (
              <p className="flex items-center gap-2">
                <Mail size={15} style={{ color: 'var(--brand-400)' }} />{currentBranch.email}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
