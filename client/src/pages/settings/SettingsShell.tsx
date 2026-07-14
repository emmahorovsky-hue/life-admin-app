import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SETTINGS_TABS } from './settingsTabs';

/**
 * Settings area shell (design 1D "The Counter", LIF-177).
 *
 * One set of nested routes serves both form factors:
 * - Desktop: page title + top tab bar; `/settings` redirects to the Account
 *   tab (see SettingsIndexOrRedirect).
 * - Mobile: `/settings` is a drill-down index menu; child routes render a
 *   centered title with an icon-only back chevron.
 */

function activeTab(pathname: string) {
  const slug = pathname.split('/')[2];
  return SETTINGS_TABS.find((tab) => tab.slug === slug);
}

export default function SettingsShell() {
  const location = useLocation();
  const tab = activeTab(location.pathname);

  return (
    <div>
      {/* Desktop: title + top tab bar */}
      <div className="hidden md:block">
        {/* Matches the page heading on Dashboard/Subscriptions/Timeline. */}
        <h2 className="text-3xl font-bold">
          Settings<span className="text-brand-orange">.</span>
        </h2>
        <nav aria-label="Settings sections" className="mt-5 flex gap-7 border-b-[1.5px] border-border">
          {SETTINGS_TABS.map(({ slug, label, danger }) => (
            <NavLink
              key={slug}
              to={`/settings/${slug}`}
              className={({ isActive }) =>
                cn(
                  'relative pb-3 text-sm transition-colors',
                  isActive ? 'font-bold' : 'font-medium text-muted-foreground hover:text-foreground',
                  danger && 'text-brand-orange hover:text-brand-orange'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-[1.5px] left-0 right-0 h-[2.5px] bg-brand-orange"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Mobile: icon-only back chevron + centered title on detail pages */}
      {tab && (
        <div className="md:hidden relative flex h-11 items-center justify-center">
          <Link
            to="/settings"
            aria-label="Back to settings"
            className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-[2px] text-foreground hover:bg-accent"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h2 className="text-[17px] font-bold">
            {tab.label}
            <span className="text-brand-orange">.</span>
          </h2>
        </div>
      )}

      <div className="mt-6 max-w-[660px]">
        <Outlet />
      </div>
    </div>
  );
}
