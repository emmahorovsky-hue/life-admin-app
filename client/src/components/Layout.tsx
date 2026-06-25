import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { UnverifiedEmailBanner } from './UnverifiedEmailBanner';
import { Logo } from './Logo';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/subscriptions', label: 'Subscriptions' },
  { path: '/profile', label: 'Profile' },
];

interface SidebarContentProps {
  currentPath: string;
  userEmail: string | undefined;
  onNav: (path: string) => void;
  onLogout: () => void;
  onClose?: () => void;
}

function SidebarContent({ currentPath, userEmail, onNav, onLogout, onClose }: SidebarContentProps) {
  return (
    <>
      <div className="p-6 border-b flex items-center justify-between">
        <Logo height={24} />
        {onClose && (
          <Button variant="ghost" size="sm" aria-label="Close navigation" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant={currentPath === item.path ? 'default' : 'ghost'}
            className="justify-start"
            onClick={() => onNav(item.path)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="p-4 border-t">
        <p className="text-sm text-muted-foreground mb-3 truncate">{userEmail}</p>
        <Button variant="outline" className="w-full" onClick={onLogout}>
          Logout
        </Button>
      </div>
    </>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <UnverifiedEmailBanner />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-60 border-r bg-card shrink-0 overflow-y-auto">
          <SidebarContent
            currentPath={location.pathname}
            userEmail={user?.email}
            onNav={handleNav}
            onLogout={handleLogout}
          />
        </aside>

        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          {/* Mobile header */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
            <Logo height={24} />
            <Button variant="ghost" size="sm" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </header>

          {/* Mobile sidebar overlay */}
          {mobileOpen && (
            <div
              className="md:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            >
              <aside
                role="dialog"
                aria-modal="true"
                className="absolute left-0 top-0 bottom-0 w-60 bg-card border-r flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <SidebarContent
                  currentPath={location.pathname}
                  userEmail={user?.email}
                  onNav={handleNav}
                  onLogout={handleLogout}
                  onClose={() => setMobileOpen(false)}
                />
              </aside>
            </div>
          )}

          {/* Main content */}
          <main className="flex-1 p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
