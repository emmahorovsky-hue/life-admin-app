import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Sun, TriangleAlert, User as UserIcon, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AvatarTile } from '@/components/settings/AvatarTile';
import { cn } from '@/lib/utils';

interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  orange?: boolean;
}

const menuItems: MenuItem[] = [
  { to: '/settings/account', label: 'Account', icon: UserIcon, orange: true },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings/appearance', label: 'Appearance', icon: Sun },
  { to: '/settings/privacy', label: 'Data & privacy', icon: TriangleAlert, orange: true },
];

/** Mobile-only settings index: identity block + drill-down menu list. */
export default function SettingsIndex() {
  const { user } = useAuth();
  const displayName = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.email;

  return (
    <div>
      <h2 className="text-[32px] font-extrabold tracking-tight">
        Settings<span className="text-brand-orange">.</span>
      </h2>

      {/* Identity block */}
      <div className="mt-5 flex items-center gap-4">
        <AvatarTile user={user} size="md" />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-extrabold">{displayName}</p>
          <p className="truncate font-mono text-[12px] text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Menu list */}
      <nav
        aria-label="Settings menu"
        className="mt-5 rounded-[2px] border border-border bg-white dark:bg-card"
      >
        {menuItems.map(({ to, label, icon: Icon, orange }, index) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex min-h-[56px] items-center gap-3.5 px-4 hover:bg-accent',
              index < menuItems.length - 1 && 'border-b-[1.5px] border-dotted border-border'
            )}
          >
            <Icon className={cn('h-5 w-5', orange ? 'text-brand-orange' : 'text-muted-foreground')} />
            <span className="flex-1 text-[17px] font-bold">{label}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
