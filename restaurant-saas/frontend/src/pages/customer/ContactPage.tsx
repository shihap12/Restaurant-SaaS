import { useState } from 'react';
import { Phone, MapPin, Send } from 'lucide-react';
import { useBranchStore } from '@/store';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const { currentBranch } = useBranchStore();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    toast.success("Message sent! We'll get back to you soon.");
  };

  return (
    <div className="container-app max-w-xl py-16">
      <h1 className="text-4xl font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Contact Us</h1>
      <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>We'd love to hear from you!</p>

      {sent ? (
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-xl font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Message Sent!</h2>
          <p style={{ color: 'var(--text-muted)' }}>We'll respond within 24 hours.</p>
          <button onClick={() => setSent(false)} className="btn btn-secondary mt-4">Send Another</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input" placeholder="Your name" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="input" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Message</label>
            <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
              className="input resize-none" rows={5} placeholder="How can we help?" required />
          </div>
          <button type="submit" className="btn btn-primary btn-lg w-full gap-2">
            <Send size={16} /> Send Message
          </button>
        </form>
      )}

      {currentBranch && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {currentBranch.phone && (
            <a href={`tel:${currentBranch.phone}`}
              className="card p-4 flex items-center gap-2 hover:border-[var(--brand-500)] transition-all">
              <Phone size={16} style={{ color: 'var(--brand-400)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Call Us</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{currentBranch.phone}</p>
              </div>
            </a>
          )}
          {currentBranch.address && (
            <div className="card p-4 flex items-center gap-2">
              <MapPin size={16} style={{ color: 'var(--brand-400)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Find Us</p>
                <p className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }}>{currentBranch.address}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
