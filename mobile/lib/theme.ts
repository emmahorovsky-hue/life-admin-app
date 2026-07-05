import { Platform } from 'react-native';

// Light palette mirroring client/src/index.css (:root). The app is
// light-only (userInterfaceStyle: 'light' in app.config.ts).
export const colors = {
  background: '#FAFAF8', // Snow
  card: '#FFFFFF',
  foreground: '#161616',
  brandOrange: '#E53D00',
  secondary: '#EEE9E2', // Sand
  mutedForeground: '#86827A',
  border: '#CBC7C1', // Ash
  destructive: '#E53D00',
  success: '#03BF55',
  warning: '#F4B133',
  white: '#FFFFFF',
};

export const fontMono = Platform.select({ ios: 'Menlo', default: 'monospace' });
