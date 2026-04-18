import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4"
      style={{ background: 'var(--surface)' }}>
      <div className="text-8xl mb-6 animate-float">🍽️</div>
      <h1 className="text-6xl font-display font-bold mb-4 gradient-text">404</h1>
      <h2 className="text-2xl font-display font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Page Not Found
      </h2>
      <p className="mb-8 max-w-sm" style={{ color: 'var(--text-muted)' }}>
        Looks like this page went off the menu. Let's get you back to something delicious.
      </p>
      <Link to="/" className="btn btn-primary btn-lg gap-2">
        <Home size={18} /> Back to Menu
      </Link>
    </div>
  );
}
