import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { UnverifiedEmailBanner } from './UnverifiedEmailBanner';
import { Logo } from './Logo';
import {
  Menu,
  X,
  LayoutDashboard,
  CalendarClock,
  RefreshCw,
  User,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * "Filed receipt" navigation (design 1a).
 *
 * Reads like a receipt: a mono "MAIN MENU" kicker, a perforated (dashed)
 * divider under it, an ink-filled active row, mono count/status badges flush
 * right, and the account docked beneath a double-hairline rule with the P. mark.
 *
 * The same content renders in the desktop sidebar and the mobile full-screen
 * overlay; `size` scales the rows, icons, badges, and account tile up on mobile.
 */
interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/timeline', label: 'Timeline', icon: CalendarClock },
  { path: '/subscriptions', label: 'Subscriptions', icon: RefreshCw },
  { path: '/profile', label: 'Profile', icon: User },
];

type SidebarSize = 'sidebar' | 'overlay';

/** Size-dependent class sets so the overlay scales up from the desktop rail. */
const sizing: Record<
  SidebarSize,
  {
    nav: string;
    row: string;
    icon: string;
    tile: string;
    logout: string;
    logoutIcon: string;
  }
> = {
  sidebar: {
    nav: 'flex-1 px-3 flex flex-col gap-[3px]',
    row: 'h-11 px-3 gap-3 text-[15px]',
    icon: 'h-5 w-5',
    tile: 'h-[38px] w-[38px] text-[17px]',
    logout: 'h-[34px] w-[34px]',
    logoutIcon: 'h-4 w-4',
  },
  overlay: {
    nav: 'flex-1 px-3.5 flex flex-col gap-1',
    row: 'h-[52px] px-3.5 gap-3.5 text-[17px]',
    icon: 'h-6 w-6',
    tile: 'h-10 w-10 text-[18px]',
    logout: 'h-9 w-9',
    logoutIcon: 'h-[18px] w-[18px]',
  },
};

interface SidebarContentProps {
  currentPath: string;
  userEmail: string | undefined;
  size: SidebarSize;
  onNav: (path: string) => void;
  onLogout: () => void;
  onClose?: () => void;
}

function SidebarContent({ currentPath, userEmail, size, onNav, onLogout, onClose }: SidebarContentProps) {
  const s = sizing[size];
  return (
    <>
      {/* Wordmark row */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h1 className="leading-none">
          <Logo height={24} />
        </h1>
        {onClose && (
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Close navigation" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Perforated divider */}
      <div className="mx-5 mb-3 border-t-[1.5px] border-dashed border-border" />

      {/* Nav rows */}
      <nav className={s.nav}>
        {navItems.map((item) => {
          const active = currentPath === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => onNav(item.path)}
              aria-current={active ? 'page' : undefined}
              className={[
                'relative flex items-center rounded transition-colors',
                s.row,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active
                  ? 'bg-accent text-foreground font-semibold'
                  : 'text-foreground font-medium hover:bg-accent',
              ].join(' ')}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-orange"
                />
              )}
              <Icon className={active ? `${s.icon} text-brand-orange` : `${s.icon} text-muted-foreground`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Account — docked under a double hairline */}
      <div className="px-4 pb-4 pt-3.5">
        <div className="border-t-[3px] border-double border-border pt-3.5 flex items-center gap-3">
          <div
            className={[
              'shrink-0 rounded bg-primary text-primary-foreground flex items-center justify-center font-extrabold',
              s.tile,
            ].join(' ')}
          >
            P<span className="text-brand-orange">.</span>
          </div>
          <div className="min-w-0 flex-1">
            {/* Swap for the user's display name once available. */}
            <p className="text-sm font-semibold leading-tight truncate">{userEmail ?? 'Account'}</p>
            <p className="font-mono text-[11px] text-muted-foreground truncate">{userEmail}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className={`${s.logout} shrink-0 text-muted-foreground`}
            aria-label="Log out"
            onClick={onLogout}
          >
            <LogOut className={s.logoutIcon} />
          </Button>
        </div>
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
    <div className="h-screen bg-background flex flex-col">
      <UnverifiedEmailBanner />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-[262px] border-r bg-card shrink-0 overflow-y-auto">
          <SidebarContent
            currentPath={location.pathname}
            userEmail={user?.email}
            size="sidebar"
            onNav={handleNav}
            onLogout={handleLogout}
          />
        </aside>

        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          {/* Mobile header */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
            <h1 className="leading-none">
              <Logo height={24} />
            </h1>
            <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </header>

          {/* Mobile full-screen overlay menu */}
          {mobileOpen && (
            <aside
              role="dialog"
              aria-modal="true"
              className="md:hidden fixed inset-0 z-50 bg-card flex flex-col"
            >
              <SidebarContent
                currentPath={location.pathname}
                userEmail={user?.email}
                size="overlay"
                onNav={handleNav}
                onLogout={handleLogout}
                onClose={() => setMobileOpen(false)}
              />
            </aside>
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
