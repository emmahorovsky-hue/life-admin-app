import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { buttonVariants } from '@/components/ui/button';
import {
  RefreshCw,
  FileText,
  Users,
  Shield,
  Globe,
  Home,
  Calendar,
  Bell,
  LayoutGrid,
} from 'lucide-react';

const TRACKED_ITEMS = [
  { icon: RefreshCw, label: 'Subscriptions', description: 'Netflix, Spotify, SaaS tools' },
  { icon: FileText, label: 'Contracts', description: 'Service agreements, phone plans' },
  { icon: Users, label: 'Memberships', description: 'Gym, clubs, associations' },
  { icon: Shield, label: 'Warranties', description: 'Appliances, electronics, vehicles' },
  { icon: Globe, label: 'Domain Names', description: 'Never let a domain lapse' },
  { icon: Home, label: 'Leases', description: 'Rent, storage, parking' },
];

const FEATURES = [
  {
    icon: Calendar,
    title: 'Upcoming timeline',
    description: 'See everything due in the next 7, 30, and 90 days at a glance. No surprises.',
  },
  {
    icon: Bell,
    title: 'Renewal alerts',
    description: 'Know before it renews. Plan cancellations and budget for upcoming charges in advance.',
  },
  {
    icon: LayoutGrid,
    title: 'One organised view',
    description: 'All your commitments in one place. Filter by category, sort by date, and finally feel in control.',
  },
];

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">
            Paypr
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className={buttonVariants({ variant: 'ghost', size: 'default' })}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className={buttonVariants({ size: 'default' })}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 md:py-36 px-4 text-center overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
            Know what's{' '}
            <span className="text-primary">coming next.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Subscriptions, contracts, warranties, leases — everything with a deadline,
            organised on one timeline. Never miss a renewal or forget what you've committed to.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              className={buttonVariants({ size: 'lg' })}
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className={buttonVariants({ variant: 'ghost', size: 'lg' })}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* What you track */}
      <section id="what-you-track" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Everything with a deadline, in one place
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            If it renews, expires, or auto-charges — Paypr tracks it.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {TRACKED_ITEMS.map(({ icon: Icon, label, description }) => (
              <div
                key={label}
                className="rounded-lg border bg-card p-5 space-y-3 hover:border-primary/50 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key features */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Built around what matters
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            No spreadsheets. No guessing. Just clarity.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-lg border bg-card p-6 space-y-4">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="relative py-20 px-4 text-center overflow-hidden bg-gradient-to-t from-primary/10 via-background to-background">
        <div className="container mx-auto max-w-xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Stop guessing. Start knowing.
          </h2>
          <p className="text-muted-foreground mb-8">Free to use. No credit card required.</p>
          <Link
            to="/register"
            className={buttonVariants({ size: 'lg' })}
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© 2026 Paypr</p>
          <div className="flex gap-4">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
