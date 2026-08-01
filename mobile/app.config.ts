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

// LIF-216: the logo.dev token is genuinely optional — rows fall back to the
// category icon — so an unset value must not fail the build the way API_URL
// does. But that graceful degradation is exactly why the token stayed unset
// through several releases without anyone noticing, so say so in the build log.
function resolveLogoDevToken(): string | undefined {
  const token = process.env.LOGO_DEV_TOKEN;

  if (!token && process.env.EAS_BUILD_PROFILE) {
    console.warn(
      '[app.config] LOGO_DEV_TOKEN is not set — subscription rows will fall back to ' +
        'category icons instead of brand logos. Set it as an EAS environment variable; ' +
        'see DEPLOYMENT.md 6.2.',
    );
  }

  return token;
}

export default {
  expo: {
    name: 'Paypr',
    slug: 'paypr-live',
    owner: 'paypr-lives-team',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'lifeadmin',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      bundleIdentifier: 'com.paypr.live',
      supportsTablet: true,
      infoPlist: {
        // Paypr uses only standard TLS/HTTPS and Keychain (expo-secure-store),
        // which are exempt from US export encryption rules. Declaring this here
        // skips the manual export-compliance prompt on every TestFlight build.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        // Snow, matching the splash and the app background (LIF-218). Was
        // #E6F4FE — a pale blue left over from the Expo template.
        backgroundColor: '#FBFBF9',
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
      // LIF-218: the static frame iOS draws before JS boots. `splash-icon.png`
      // is the Paypr wordmark rasterised at 3.5px per point (font-size 210 = the
      // 60pt wordmark `components/BrandSplash.tsx` renders), so imageWidth is
      // 1024 / 3.5 — at that width the static wordmark and the animated one are
      // the same size in the same place, and the handover is invisible. Change
      // one of the two and you must change the other. The orange square is
      // deliberately absent from the frame: BrandSplash stamps it in.
      //
      // Android gets the square alone. Android 12+ masks the splash icon into a
      // circle, which would crop a wordmark this wide to "yp" — the mark is the
      // part of the lockup that survives the mask.
      ['expo-splash-screen', {
        image: './assets/splash-icon.png',
        imageWidth: 293,
        resizeMode: 'contain',
        backgroundColor: '#FBFBF9', // Snow — lightColors.background.hex
        android: {
          image: './assets/splash-icon-android.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: '#FBFBF9',
        },
      }],
      // LIF-219: these become NSCameraUsageDescription / NSPhotoLibraryUsageDescription
      // in Info.plist, so they are the copy in the system permission dialogs — native
      // config, not JS, and therefore not shippable over the air. The camera string
      // named "Life Admin" until the first App Store submission; nothing else in the
      // product has carried that name since the Paypr rebrand. photosPermission was
      // left to expo-image-picker's generic default even though the library is used
      // in two places (lib/receiptScan.ts, components/settings/AvatarTile.tsx), so it
      // is spelled out here — Apple asks purpose strings to say why, not just what.
      ['expo-image-picker', {
        cameraPermission: 'Paypr uses the camera to scan receipts, so it can fill in subscription details for you.',
        photosPermission: 'Paypr accesses your photos so you can pick a saved receipt to scan, or set a profile picture.',
      }],
      '@react-native-community/datetimepicker',
    ],
    extra: {
      eas: {
        projectId: '173c8d3b-4b6b-4ff1-9988-010e8d138228',
      },
      apiUrl: resolveApiUrl(),
      logoDevToken: resolveLogoDevToken(),
    },
  },
};
