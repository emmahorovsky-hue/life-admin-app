// LIF-131: refuse to build for production without a real API URL. The value
// comes from eas.json (build.<profile>.env.API_URL) or an EAS environment
// variable; EAS_BUILD_PROFILE is set by EAS Build while this config is
// evaluated. The localhost fallback for local dev lives in lib/api.ts,
// guarded by __DEV__ — release bundles never fall back silently.
function resolveApiUrl(): string | undefined {
  const apiUrl = process.env.API_URL;

  if (process.env.EAS_BUILD_PROFILE === 'production') {
    if (!apiUrl || apiUrl.includes('REPLACE-WITH') || /localhost|127\.0\.0\.1/.test(apiUrl)) {
      throw new Error(
        `API_URL is not configured for a production build (got: ${JSON.stringify(apiUrl)}). ` +
          'Set the real production API URL in mobile/eas.json under build.production.env.API_URL ' +
          '(or as an EAS environment variable). See DEPLOYMENT.md, "Part 6: Mobile Builds".',
      );
    }
  }

  return apiUrl;
}

export default {
  expo: {
    name: 'Life Admin',
    slug: 'life-admin',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'lifeadmin',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      bundleIdentifier: 'com.yourname.lifeadmin',
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-notifications',
      ['expo-image-picker', { cameraPermission: 'Allow Life Admin to scan receipts.' }],
      '@react-native-community/datetimepicker',
    ],
    extra: {
      apiUrl: resolveApiUrl(),
      logoDevToken: process.env.LOGO_DEV_TOKEN,
    },
  },
};
