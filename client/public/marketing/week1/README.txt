Paypr marketing assets — week 1

This folder is served as static files on https://paypr.live/marketing/week1/
(everything in client/public/ is copied verbatim into the production bundle).

Placeholder only for now — final Week 1 social creatives land here later.

How to publish/replace an image:
1. Drop the PNG into client/public/marketing/week1/ (lowercase-kebab-case names,
   e.g. week1-launch-square.png).
2. Commit, open a PR, merge to main. Vercel auto-deploys production.
3. The file is then public at https://paypr.live/marketing/week1/<name>.png
   — that's the URL to paste into Buffer.

Notes:
- Replacing a file (same name, new content) works the same way; Vercel serves
  the new bytes on the next deploy. Prefer a new filename if a post already
  went out, since social CDNs may have cached the old image.
- The bare folder URL (/marketing/week1/) has no directory listing — it falls
  through to the app. Only direct file URLs matter.

See docs/MARKETING-ASSETS.md for the full write-up.
