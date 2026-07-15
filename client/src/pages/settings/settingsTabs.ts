export interface SettingsTab {
  slug: string;
  label: string;
  /** Renders the tab label in accent orange (Data & privacy). */
  danger?: boolean;
}

export const SETTINGS_TABS: readonly SettingsTab[] = [
  { slug: 'account', label: 'Account' },
  { slug: 'notifications', label: 'Notifications' },
  { slug: 'appearance', label: 'Appearance' },
  { slug: 'privacy', label: 'Data & privacy', danger: true },
];
