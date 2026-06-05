import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { UnverifiedEmailBanner } from './UnverifiedEmailBanner';
import { APP_NAME } from '@/lib/constants';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/subscriptions', label: 'Subscriptions' },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold">{APP_NAME}</h1>
      </div>
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant={location.pathname === item.path ? 'default' : 'ghost'}
            className="justify-start"
            onClick={() => handleNav(item.path)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="p-4 border-t">
        <p className="text-sm text-muted-foreground mb-3 truncate">{user?.email}</p>
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <UnverifiedEmailBanner />
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-60 border-r bg-card shrink-0 sticky top-0 h-screen">
          <SidebarContent />
        </aside>

        <div className="flex flex-col flex-1 min-w-0">
          {/* Mobile header */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
            <h1 className="text-xl font-bold">{APP_NAME}</h1>
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)}>
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
                className="absolute left-0 top-0 bottom-0 w-60 bg-card border-r flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b flex items-center justify-between">
                  <h1 className="text-xl font-bold">{APP_NAME}</h1>
                  <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <nav className="flex-1 p-4 flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Button
                      key={item.path}
                      variant={location.pathname === item.path ? 'default' : 'ghost'}
                      className="justify-start"
                      onClick={() => handleNav(item.path)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </nav>
                <div className="p-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3 truncate">{user?.email}</p>
                  <Button variant="outline" className="w-full" onClick={handleLogout}>
                    Logout
                  </Button>
                </div>
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
