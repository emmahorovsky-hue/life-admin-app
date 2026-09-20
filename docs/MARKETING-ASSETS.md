# Marketing assets on paypr.live

Public, static marketing images (social creatives for Buffer etc.) are hosted on
the production Vercel site under `https://paypr.live/marketing/`.

## How it works

- Everything in `client/public/` is copied verbatim into the Vite build output
  (`client/dist/`), and the Vercel project serves real files from there **before**
  the SPA catch-all rewrite in `client/vercel.json` kicks in. That's the same
  mechanism that already serves `/og-image.png`, `/favicon.svg`, etc.
- The current asset folder is `client/public/marketing/week1/`. Add sibling
  folders (`week2/`, `campaigns/<name>/`, …) the same way as campaigns grow.

## Adding or replacing an image

1. Drop the file into `client/public/marketing/week1/` (or a new subfolder).
   Use lowercase-kebab-case names, e.g. `week1-launch-square.png`.
2. Commit on a branch, open a PR, merge to `main`.
3. Vercel auto-deploys production on merge. The file is then live at
   `https://paypr.live/marketing/week1/<name>.png` — that URL is what you paste
   into Buffer.
4. Verify with `curl -sI https://paypr.live/marketing/week1/<name>.png`
   — expect `HTTP/2 200` and `content-type: image/png`.

Replacing a file (same name, new bytes) works identically. If a post has
already gone out with the old image, prefer a **new filename**: social
platforms and their CDNs cache aggressively by URL.

## Gotchas

- The bare folder URL `https://paypr.live/marketing/week1/` shows the app, not
  a directory listing (the SPA rewrite catches paths that aren't real files).
  Only direct file URLs are meaningful.
- Everything in this folder is public the moment it deploys, and the repo is
  public too — never park unreleased/confidential creatives here.
- PR preview deployments (`*.vercel.app`) sit behind Vercel deployment
  protection (they 302 to a Vercel SSO login), so preview URLs are not usable
  for checking assets unless you're logged into the project's Vercel account —
  and never usable for Buffer. Only production `paypr.live` URLs are public.

## Which Vercel project?

The Vercel project is the one connected to the `emmahorovsky-hue/life-admin-app`
GitHub repo (root directory `client/`, config in `client/vercel.json`), with the
`paypr.live` domain attached. Production deploys track `main`.
