# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## What this is

The Expo (SDK 57) mobile client for Life Admin — one workspace of the monorepo, alongside `server/`,
`client/` (the web SPA), and `packages/shared`. React Native 0.86 on React 19. Note the web client is
still on React 18, so shared code must stay React-free.

## Commands

Run from `mobile/`:

```bash
npm run start     # Expo dev server
npm run ios       # open in the iOS simulator
npm run android   # open in the Android emulator
npm run web       # run in a browser
```

There is no lint or test script here yet. Install dependencies from the **repo root** (`npm install`)
— this is an npm workspace, and the hoisted tree is what makes `@life-admin/shared` resolve.

## Routing

`expo-router`, so the filesystem is the route table:

- `app/(auth)/` — login, register, forgot-password, reset-password
- `app/(app)/` — index (dashboard), subscriptions, timeline, profile
- `app/_layout.tsx` — root layout; the `(app)` group is gated on auth state

## Auth — differs from the web client, and the difference matters

The web SPA authenticates with an **httpOnly cookie**. Mobile can't use one, so it stores the JWT in
**expo-secure-store** (`lib/storage.ts`) and sends it as an `Authorization: Bearer` header
(`lib/api.ts`), along with `X-Platform: mobile`.

The server's `authenticateToken` middleware accepts either: it prefers the Bearer header and falls
back to the cookie. Login and register return the token in the JSON body precisely so mobile can keep
it.

## API base URL

`lib/api.ts` reads `Constants.expoConfig.extra.apiUrl`, which `app.config.ts` populates from the
`API_URL` env var at **build** time — it is baked into the binary, not read at runtime. There is
deliberately no localhost fallback in release builds: a production build without `API_URL` fails fast
rather than silently pointing at a dev machine. See "Part 6: Mobile Builds (EAS)" in `DEPLOYMENT.md`.

## Shared code

`@life-admin/shared` (`packages/shared`) holds the types, constants, and subscription/date utilities
used by both mobile and web. It ships raw TypeScript — Metro transpiles it from source — so import
from it freely, but keep React code out of it (see the React version split above).
