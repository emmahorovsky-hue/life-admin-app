import { useState } from 'react';
import { toast } from 'sonner';
import { THEMES, currencies, type Theme } from '@life-admin/shared';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Select } from '@/components/ui/select';
import { updateProfile } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { cn } from '@/lib/utils';

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/**
 * Appearance panel (LIF-186): theme segmented control + default currency.
 * Theme writes go through ThemeContext (which persists + syncs); currency
 * writes straight to the profile.
 */
export default function AppearancePanel() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [savingCurrency, setSavingCurrency] = useState(false);

  const handleCurrencyChange = async (defaultCurrency: string) => {
    setSavingCurrency(true);
    try {
      const res = await updateProfile({ defaultCurrency });
      updateUser(res.data.user);
      toast.success('Default currency updated.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update currency. Please try again.'));
    } finally {
      setSavingCurrency(false);
    }
  };

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

      <div>
        <label
          htmlFor="default-currency"
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground"
        >
          Default currency
        </label>
        <Select
          id="default-currency"
          className="mt-3 h-11 max-w-[300px] rounded-[2px]"
          value={user?.defaultCurrency ?? 'SGD'}
          onChange={(e) => handleCurrencyChange(e.target.value)}
          disabled={savingCurrency}
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      </div>
    </section>
  );
}
