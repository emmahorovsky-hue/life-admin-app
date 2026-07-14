// UI theme preference. Stored on User.theme; 'system' follows the OS scheme.
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];
