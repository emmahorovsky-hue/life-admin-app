# @life-admin/shared

Types, constants, utilities, and design tokens shared by `server/`, `client/`, and `mobile/`.
Builds to CommonJS in `dist/` (`npm run build`, auto via `prepare`); keep it React-free — the
web client is on React 18 and mobile on React 19.

## Design tokens (`src/tokens/`)

Source of truth for design-token **values** (light palette + radii/spacing/type scale):

- **Web** keeps `client/src/index.css` hand-authored; `client/src/lib/tokens.test.ts` fails
  whenever its `:root` vars disagree with the shared `hsl` strings. Change both together.
- **Mobile** sources `mobile/lib/theme.ts` colors from the `hex` values (the exact sRGB render
  of each `hsl` triplet).
- **Dark-mode tokens are web-only for now** — mobile is light-only and dark mode there is
  deferred. When that changes, add `darkColors` and extend the drift test to `.dark`.
- Font family names stay out of shared: CSS names ("Space Mono") and RN loaded-font names
  ("SpaceMono_400Regular") differ per platform.
