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

// Crash reporting DSN, read by lib/sentry.ts. Optional in the same sense as
// LOGO_DEV_TOKEN — no DSN means Sentry never initialises and the app is
// otherwise unaffected — so an unset value must not fail the build. But an
// unreported release is exactly the failure that hides itself, so a production
// build without it says so in the build log.
//
// A Sentry DSN is publishable by design (it ships in every client bundle), yet
// like the logo.dev token it stays out of eas.json because this repo is public.
function resolveSentryDsn(): string | undefined {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn && process.env.EAS_BUILD_PROFILE === 'production') {
    console.warn(
      '[app.config] SENTRY_DSN is not set — this production build will report no ' +
        'crashes or errors. Set it as an EAS environment variable; see DEPLOYMENT.md 6.3.',
    );
  }

  return dsn;
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
      // iPhone only. This was the Expo template's default, and shipping it
      // would have committed the App Store listing to iPad: a second set of
      // screenshots, and a reviewer running the app on a 13" screen. Nothing
      // here is designed for that — the tab bar floats (LIF-214), every modal
      // surface is a bottom sheet, and the dashboard hero is a fixed 54pt on a
      // single content column. It would be reviewed as a stretched phone app,
      // because that is what it is.
      //
      // Reversible whenever an iPad layout actually exists: flip this back and
      // add the iPad screenshots. Native config, so it needs a new build.
      supportsTablet: false,
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
      // LIF-222: becomes NSFaceIDUsageDescription in Info.plist — native config,
      // not shippable over the air, so it needs a new build to take effect. Same
      // rule as the LIF-219 strings above: Apple wants the purpose string to say
      // *why* the app wants Face ID, not merely that it does. The default the
      // plugin ships ("Allow $(PRODUCT_NAME) to use Face ID") states the what.
      ['expo-local-authentication', {
        faceIDPermission: 'Paypr uses Face ID so you can unlock your subscriptions without typing your password.',
      }],
      '@react-native-community/datetimepicker',
      // Adds the native Sentry SDK and the build phase that uploads source maps
      // and debug symbols. Without it a JS stack trace arrives as minified
      // bundle offsets, which is technically a crash report and practically
      // unreadable.
      //
      // The upload needs SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN on the
      // build, and absent those it FAILS THE BUILD — it does not skip with a
      // warning. sentry-cli runs unconditionally in the Xcode build phase and
      // exits with "An organization ID or slug is required (provide with
      // --org)", surfacing as an EAS XCODE_BUILD_ERROR. This is not theoretical:
      // it broke build 19 (2026-08-04), the first build to carry this plugin.
      //
      // To ship without symbolication, set SENTRY_DISABLE_AUTO_UPLOAD=true as an
      // EAS environment variable. It applies per environment, so any profile
      // without it still fails — `eas env:list` says which have it. It is a
      // temporary hatch: remove it once the three vars above are set, or it
      // silently skips the upload they exist to perform. See DEPLOYMENT.md 6.3.
      '@sentry/react-native',
    ],
    extra: {
      eas: {
        projectId: '173c8d3b-4b6b-4ff1-9988-010e8d138228',
      },
      apiUrl: resolveApiUrl(),
      logoDevToken: resolveLogoDevToken(),
      sentryDsn: resolveSentryDsn(),
    },
  },
};
