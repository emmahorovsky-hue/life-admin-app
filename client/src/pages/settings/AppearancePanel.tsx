import { THEMES, type Theme } from '@life-admin/shared';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/**
 * Appearance panel (LIF-186): theme segmented control. Writes go through
 * ThemeContext, which persists + syncs. Default currency used to live here too;
 * it moved to Account (LIF-277).
 */
export default function AppearancePanel() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="space-y-8 rounded-[2px] border border-border bg-white p-6 dark:bg-card">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Theme
        </p>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="mt-3 inline-flex w-full max-w-[320px] rounded-[2px] border border-border p-0.5"
        >
          {THEMES.map((option) => {
            const active = theme === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(option)}
                className={cn(
                  'flex-1 rounded-[2px] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {THEME_LABELS[option]}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
