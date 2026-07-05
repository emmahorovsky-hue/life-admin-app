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
      apiUrl: process.env.API_URL || 'http://localhost:3001/api',
      logoDevToken: process.env.LOGO_DEV_TOKEN,
    },
  },
};
