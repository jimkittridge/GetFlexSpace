# GetFlexSpace

Marketing and lead-generation site for small-bay flex and warehouse space in
North Carolina and South Carolina — Durham, Asheville (Fletcher), and Columbia.

Live at **https://getflexspace.com**

## Stack

| Piece | What |
|---|---|
| Framework | [Astro](https://astro.build) static site |
| Styling | Tailwind, via `@tailwindcss/vite` |
| CMS | [Sveltia CMS](https://github.com/sveltia/sveltia-cms) at `/admin/`, GitHub backend |
| Hosting | GitHub Pages, via `.github/workflows/deploy.yml` |

## Local development

```bash
npm ci
npm run dev     # local dev server
npm run build   # production build -> dist/
```

**Always run `npm run build` before pushing** content or schema changes. See
"A failed build is a silently stale site" below.

## Project structure

```
src/
  content/            markdown + frontmatter, typed by content.config.ts (Zod)
    locations/        one file per market — drives the whole location page
    blog/             blog posts
    pages/            homepage, about, contact, faq
  layouts/
    NewLayout.astro   current design (cream #f7f5f1, Inter, rounded cards)
    BaseLayout.astro  legacy — still used by faq.astro
  pages/
    locations/[slug].astro
    blog/[...page].astro, [slug].astro, category/[category]/[...page].astro
public/admin/         Sveltia CMS config + entry point
oauth-proxy/          hand-rolled Cloudflare Worker for CMS auth (see below)
```

Location pages are driven entirely by `src/content/locations/*.md`. The homepage
pulls its stats, featured suite card, and hero location pills **dynamically**
from the locations collection — edit the location markdown, don't hardcode suite
specs into the homepage.

## Editing content

Content is edited through Sveltia CMS at `/admin/`, which commits straight to
GitHub. It can also be edited by hand in `src/content/`.

### Signing in

The **"Sign in with GitHub"** button does not work. `public/admin/config.yml`
has no `base_url`, so Sveltia falls back to Netlify's OAuth service and the
popup 404s against `api.netlify.com` — this site is on GitHub Pages, not Netlify.

**Use "Sign In Using Access Token"** instead, with a classic GitHub personal
access token (`repo` scope). That talks directly to the GitHub API and needs no
OAuth server. It stops working when the token expires.

**Permanent fix (not yet done):** deploy
[`sveltia/sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) to
Cloudflare Workers, register a GitHub OAuth App pointing at `<worker>/callback`,
set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `ALLOWED_DOMAINS`, then add
`base_url: <worker-url>` under `backend:` in `config.yml`.

`oauth-proxy/` holds an alternative worker. It emits valid JS now (a
quote-escaping bug that broke the callback was fixed), but it has **no CSRF
`state` parameter and no domain allowlist** — prefer the official worker.

## Gotchas

**A failed build is a silently stale site.** If `astro build` fails, the Pages
workflow never publishes and the live site keeps serving the previous version
with no visible error. If the site "isn't updating", run `npm run build` first —
that has been the cause twice.

**The CMS writes `null` for cleared fields.** Zod's `.default()` only fills in
for `undefined`, so a field cleared in the admin UI fails validation and breaks
the build. Optional CMS-managed fields need to tolerate null — see
`heroOverlayColor` / `heroOverlayOpacity` in `src/content.config.ts` for the
pattern (`.nullish().transform(v => v ?? fallback)`).

**List widgets write flat strings.** A CMS `list` widget with a singular
`field:` produces `- NC`, not `- category: NC`. Externally authored content has
gotten this wrong and broken the build. Match what the CMS actually writes.

**Suite specs live at the location level.** `ceilingHeight`, `power`,
`doorSize`, and `lease` belong in `specs:` on the location. Suites carry only
`name`, `size`, `status`, `description`, `baseRent`. Don't reintroduce per-suite
specs — they were deduplicated deliberately.

## Known issues

- `master` is behind `claude/build-flexspace-site-dSsmL`, and `deploy.yml`
  triggers on **both** branches — whichever run finishes last overwrites the
  live site. Needs merging, and one trigger removed.
- `public/admin/index.html` loads Sveltia **unpinned** from a CDN, so upstream
  releases change the admin UI with no change here. Worth pinning (last known
  good: 0.208.2).
- Three deploy configs coexist: `.github/workflows/deploy.yml` (GitHub Pages),
  `netlify.toml`, and an earlier Cloudflare Pages setup. Only the Pages workflow
  is known to be live; the others are probably dead weight.
- Blog posts link to `/durham/`, `/asheville/`, `/columbia/`, but the real routes
  are `/locations/<slug>/`. Those internal links likely 404 — unverified.
