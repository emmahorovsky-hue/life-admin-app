import { Link } from 'react-router-dom';
import {
  IconBell,
  IconChevron,
  IconTheme,
  IconWarning,
  IconUser,
  type PayprIconComponent,
} from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import { AvatarTile } from '@/components/settings/AvatarTile';
import { cn } from '@/lib/utils';

interface MenuItem {
  to: string;
  label: string;
  icon: PayprIconComponent;
  orange?: boolean;
}

const menuItems: MenuItem[] = [
  { to: '/settings/account', label: 'Account', icon: IconUser, orange: true },
  { to: '/settings/notifications', label: 'Notifications', icon: IconBell },
  { to: '/settings/appearance', label: 'Appearance', icon: IconTheme },
  { to: '/settings/privacy', label: 'Data & privacy', icon: IconWarning, orange: true },
];

/** Mobile-only settings index: identity block + drill-down menu list. */
export default function SettingsIndex() {
  const { user } = useAuth();
  const displayName = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.email;

  return (
    <div>
      <h2 className="text-3xl font-bold">
        Settings<span className="text-brand-orange">.</span>
      </h2>

      {/* Identity block */}
      <div className="mt-5 flex items-center gap-4">
        <AvatarTile size="md" />
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
            {/* Already orange-tinted rows drop the accent to currentColor —
                see the same reasoning on Layout's active nav row. */}
            <Icon
              className={cn('h-5 w-5', orange ? 'text-brand-orange' : 'text-muted-foreground')}
              ink={orange ? 'inherit' : 'brand'}
            />
            <span className="flex-1 text-[17px] font-bold">{label}</span>
            <IconChevron className="h-5 w-5 text-muted-foreground" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
