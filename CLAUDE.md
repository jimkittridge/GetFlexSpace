# GetFlexSpace — project notes

Marketing / lead-gen site for small-bay flex + warehouse space in NC and SC
(Durham, Asheville/Fletcher, Columbia).

## Stack

- **Astro** static site (`site: https://getflexspace.com`, no `base` path)
- **Tailwind** via `@tailwindcss/vite`
- **Sveltia CMS** at `/admin/` (Decap-compatible), GitHub backend
- **GitHub Pages** deploy via `.github/workflows/deploy.yml`
- Content lives in `src/content/` as markdown + frontmatter, typed by
  `src/content.config.ts` (Zod). Collections: `locations`, `pages`, `blog`.

## Layout

- `src/layouts/NewLayout.astro` — current design (cream `#f7f5f1`, Inter,
  rounded cards). Uses `HeaderNew` / `FooterNew`.
- `src/layouts/BaseLayout.astro` — legacy, still used by `faq.astro`.
- Location pages: `src/pages/locations/[slug].astro`, driven entirely by
  `src/content/locations/*.md`.
- Blog: `src/pages/blog/[...page].astro` (paginated, 12/page),
  `[slug].astro`, and `category/[category]/[...page].astro`.
- Homepage pulls stats, the featured suite card, and the hero location pills
  **dynamically** from the locations collection — don't hardcode suite specs
  there, edit the location markdown instead.

## Gotchas that have bitten us

**A failed build = a silently stale site.** `astro build` failing means the
Pages workflow never publishes, and the live site just keeps serving the old
version with no obvious error. If the site "isn't updating", run
`npm run build` first — that has been the cause twice.

**The CMS writes `null` for cleared fields.** Zod's `.default()` only fills in
for `undefined`, so a field cleared in the admin UI fails validation and breaks
the build. Optional CMS-managed fields should tolerate null — see
`heroOverlayColor` / `heroOverlayOpacity` in `src/content.config.ts` for the
pattern (`.nullish().transform(v => v ?? fallback)`).

**List widgets write flat strings.** A CMS `list` widget with a singular
`field:` produces `- NC`, not `- category: NC`. Externally authored content has
gotten this wrong and broken the build. Match what the CMS writes.

**Specs are defined once, at the location level.** `ceilingHeight`, `power`,
`doorSize`, `lease` live in `specs:` on the location. Suites only carry `name`,
`size`, `status`, `description`, `baseRent`. Don't reintroduce per-suite specs.

## Admin login (known issue)

`public/admin/config.yml` has **no `base_url`**, so Sveltia falls back to
Netlify's OAuth service. The popup hits
`https://api.netlify.com/auth?provider=github&site_id=getflexspace.com...`
and 404s, because this site is on GitHub Pages, not Netlify.

- **Workaround that works:** the "Sign In Using Access Token" button on the
  sign-in screen, with a classic GitHub PAT (`repo` scope). Talks straight to
  the GitHub API, no OAuth server needed. Expires when the token does.
- **Permanent fix (not done):** deploy `sveltia/sveltia-cms-auth` to Cloudflare
  Workers, create a GitHub OAuth App pointing at `<worker>/callback`, set
  `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `ALLOWED_DOMAINS`, then add
  `base_url: <worker-url>` under `backend:` in `config.yml`.

`oauth-proxy/` holds a hand-rolled alternative worker. It builds valid JS now
(a quote-escaping bug that broke the callback was fixed), but it has **no CSRF
`state` parameter and no domain allowlist** — prefer the official worker.

## Open items

- `master` is **15 commits behind** `claude/build-flexspace-site-dSsmL`, and
  `deploy.yml` triggers on **both** branches — whichever run finishes last wins
  and overwrites the live site. Needs merging and one trigger removed.
- `public/admin/index.html` loads Sveltia **unpinned** from a CDN, so upstream
  releases change the admin UI with no change here. Worth pinning (was 0.208.2).
- Three deploy configs coexist: `.github/workflows/deploy.yml` (GitHub Pages),
  `netlify.toml`, and an earlier Cloudflare Pages setup. Only the Pages
  workflow is known to be live. The others are probably dead weight.
- Blog posts link to `/durham/`, `/asheville/`, `/columbia/`, but the real
  routes are `/locations/<slug>/`. Those internal links likely 404 — unverified.

## Conventions

- Work on `claude/build-flexspace-site-dSsmL`; don't push to `master` directly
  (it's protected — pushes are rejected).
- Always run `npm run build` before pushing content or schema changes.
- The sandbox cannot reach `getflexspace.com` (egress blocked), so the live
  site can't be verified from here — say so rather than assuming a deploy
  landed.
