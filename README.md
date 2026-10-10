# GetFlexSpace

Marketing and lead-generation site for small-bay flex and warehouse space in
North Carolina and South Carolina, with larger warehouses and retail space alongside
the primary small-bay portfolio.

Live at **https://getflexspace.com**

## Stack

| Piece | What |
|---|---|
| Framework | [Astro](https://astro.build) static site |
| Styling | Tailwind, via `@tailwindcss/vite` |
| CMS | [Sveltia CMS](https://github.com/sveltia/sveltia-cms) at `/admin/`, GitHub backend |
| Live hosting | Cloudflare Pages (`testgithub-14s.pages.dev`), connected to GitHub |
| Secondary mirror | GitHub Pages, via `.github/workflows/deploy.yml` |

## Local development

```bash
npm ci
npm run dev     # local dev server
npm run build   # production build -> dist/
```

**Always run `npm run build` before pushing** content or schema changes. See
"A failed build is a silently stale site" below.
The build first checks the CMS configuration so misplaced page fields cannot
silently ship a broken admin. Property settings belong under Locations; entries
in Pages must each specify a content file and its editable fields.

## Project structure

```
src/
  content/            markdown + frontmatter, typed by content.config.ts (Zod)
    locations/        one file per market — drives the whole location page
    blog/             blog posts
    pages/            homepage, contact, faq
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
pulls its property cards, photos, availability, suite ranges, and property details
**dynamically** from the locations collection. Edit location markdown, not suite
specs in the homepage. `homepageCardTitle` overrides the homepage card heading;
blank or cleared values use `fullName`. `homepageDescription` supplies card copy; `{{suiteRange}}`
in that field uses the current location size range. Homepage FAQ answers can use
`{{suiteRanges}}` to list published small-bay location ranges; `{{smallBayLocations}}` lists those locations. Visible FAQs and JSON-LD use the same data.

The approved homepage design lives in `src/pages/index.astro`, with styles in
`src/styles/homepage.css` and interactions in `src/scripts/homepage.ts`. Its photos
are optimized at build time from CMS-selected images. Warehouse property pages share `PropertyPage.astro`, `property.css`, and
`property.ts`: photo/floor-plan viewer, suite filtering, address-based maps, and
the same tour/waitlist dialog with the location preselected. The optional
`mapEmbedUrl` uses a Google Maps share/embed URL; leave it blank to show an
address-based map. Maps remain responsive and lazy-loaded. Full locations
are waitlist-only even if an individual suite has a stale available flag.
Location FAQ answers support `{{availabilitySummary}}`, `{{suiteRange}}`, and
`{{ceilingHeight}}`; visible answers and FAQ structured data resolve together.

Within each homepage property group, cards and the small-bay hero slideshow share an availability order:
Now Leasing, Coming Soon, then Join the Waitlist, with city names breaking ties.
The location admin exposes all three options; Coming Soon collects waitlist
requests and shows opening-update copy instead of claiming the property is full.

The homepage location photo rotates every seven seconds while at least half of
it is visible. Visitors can pause/play using the compact icon beside the location tabs or
choose a location directly. Hover,
hidden tabs, and open dialogs suspend rotation; keyboard focus and manual
selection pause it until Play is requested. Reduced-motion users start paused.
Photos are decoded before their image, caption, and property link change together.
Public action arrows use `ArrowIcon.astro` SVGs rather than Unicode characters,
which iOS Safari can display as emoji. Property links name the city and space type.
The homepage mobile contact bar stays hidden while the hero is visible, then
appears below the hero and hides again when visitors scroll back to it.
All public pages use `HeaderNew.astro` for consistent logo sizing, navigation
typography, alignment, and responsive breakpoints. Its mobile/tablet hamburger
also offers Request a tour; the hero and content
sections retain their in-page links for browsing locations and leasing questions.

The Locations directory uses the same availability order, with large property cards,
availability and space-type filters, and the shared tour/waitlist dialog. Content
comes from the location records; the directory builds crawlable property links
and an ItemList schema. The retired About page redirects to `/locations/` and is
removed from navigation, the CMS, and the sitemap.

## Publishing

Work on `claude/build-flexspace-site-dSsmL`, build locally, and open a PR to
`master`. Cloudflare's Git integration creates deployments for repository
changes. Its production-branch configuration is managed in the Cloudflare
project, separately from GitHub Actions. The GitHub Pages mirror deploys only
`master`; its workflow builds PRs without publishing them.

CMS edits still land on the development branch. Keep `master` in sync through
PRs. Verify the Cloudflare check and the actual `https://getflexspace.com/` page
after publishing; a successful branch preview or GitHub Pages status alone does
not verify the live domain. The live redesign was verified in October 2026.

## Leasing inquiries

The homepage tour/waitlist pop-out collects location, name, business name or
website, and cell phone. Large call and text links sit beside it on desktop;
compact buttons share a row below the form on mobile. The mobile form fits in
the phone width and scrolls on shorter screens. Mobile readability takes priority
over fitting everything above the fold: homepage body copy is 18px, with larger
links, field labels, and secondary text throughout the public site.
Public contact details still come from
`src/content/pages/contact.md`; notifications go to **jim@rothcapital.com**.

Requests are saved in a private Cloudflare D1 database before success is shown.
This is a request for follow-up, not an automatically booked appointment. A UUID
makes retries safe without duplicate leads. Server validation, a honeypot, and a
five-request/15-minute IP limit protect the endpoint. Only short-lived IP hashes
are stored by that limit.

### Tour request admin

Open `/admin/` and select the **Tour requests** tab. Sign in once using the
content manager; both tabs use that existing Sveltia session. Switching tabs
keeps the CMS mounted, so unfinished content edits are preserved. The older
`/admin/requests/` URL still works and reuses the same session; signed-out users
are directed to the content manager instead of a second token form.

The server verifies repository write access on every inbox request. No additional
token copy, URL token, or public lead file is created. The shared-session adapter
in `src/lib/cms-session.js` reads Sveltia's existing browser user cache; signing
out through the CMS account menu clears the inbox too. Data stays in private D1.
The CMS is pinned to **0.229.0** because the cache format is an internal detail;
verify the adapter and sign-in/sign-out flow before upgrading that version.
The inbox includes status filters, New/Contacted/Tour scheduled/Closed statuses,
phone links, notification status, and a retry button for failed notifications.

### Hosting setup

Cloudflare Pages Functions in `functions/` expose the form and authenticated
admin APIs. `server/tour-requests.js` contains validation, persistence, and email
logic. The static GitHub Pages mirror does not support these functions.

1. Create D1 database `getflexspace-tour-requests` and run
   `migrations/0001_tour_requests.sql` in its console (or Wrangler).
2. Bind that database as **LEADS_DB** in the **production** environment of Pages
   project `testgithub`. Use a separate test database for any preview environment;
   never share production lead data with untrusted preview code.
3. Verify `jim@rothcapital.com` as a Cloudflare Email Routing destination and
   onboard `getflexspace.com` to Email Routing. Deploy the complete worker in
   `notification-worker/` with its `EMAIL` binding restricted to that recipient.
   Its public HTTP handler always returns 404; only the private `notify` RPC
   method sends messages. Bind it to Pages production as service
   **TOUR_NOTIFICATIONS**, then set **TOUR_EMAIL_ENABLED** to **true**.
   A saved request is the source of truth. Email failures remain visible in the
   inbox and can be retried; they do not lose the request.
4. Redeploy after binding/variable changes. Verify one clearly labeled test lead
   in the admin inbox and its notification before treating launch as complete.

Cloudflare sends notifications from `notifications@getflexspace.com` to the fixed
verified destination `jim@rothcapital.com`. Sending to verified destinations is
available on the free plan. No mail API key is stored in this repository. The
notification worker is deployed separately from the Pages/GitHub build; update
it with `wrangler deploy --config notification-worker/wrangler.jsonc` when its
code changes. Its checked-in configuration disables public and preview URLs.

For local backend testing, build the site and run `wrangler pages dev dist` with
a local D1 binding. Apply the migration to that same local database. Leave
`TOUR_EMAIL_ENABLED` unset so tests do not send real email. `npm test` exercises
storage, duplicate retries, failure handling, rate limits, notification retries,
and authorization against an in-memory SQLite database (Node 22.13+).

## Editing content

### Reusable larger warehouse format

High Point is unpublished and retained in the CMS as a reference. A separate
snapshot and reuse instructions are in `templates/locations/`. Copy its section
structure for future larger buildings and replace all property-specific details
before publishing. Unpublished entries are excluded from public pages, cards,
navigation, inquiry choices, and the sitemap.

Content is edited through Sveltia CMS at `/admin/`, which commits straight to
GitHub. It can also be edited by hand in `src/content/`.

### Signing in

The CMS offers **"Sign In Using Access Token"**, with a classic GitHub personal
access token (`repo` scope). That talks directly to the GitHub API and needs no
OAuth server. Sveltia remembers this sign-in and the tour inbox shares it. The
session stops working when the token expires or is revoked. The unsupported
OAuth button is hidden using `auth_methods: [token]`; it previously fell back to
Netlify's unavailable OAuth service because this site has no `base_url`.

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

- `src/pages/admin/index.astro` hosts the combined admin workspace; the CMS
  version is pinned in `src/lib/cms-session.js`. Session cache integration needs
  to be verified when upgrading Sveltia.
- Three deploy configs coexist: `.github/workflows/deploy.yml` (GitHub Pages),
  `netlify.toml`, and the connected Cloudflare Pages project. Cloudflare serves
  the live domain; the Netlify configuration is legacy.
- Blog posts link to `/durham/`, `/asheville/`, `/columbia/`, but the real routes
  are `/locations/<slug>/`. Those internal links likely 404 — unverified.

## Morganton location

408 W Fleming Dr is a normal Locations entry at `src/content/locations/morganton-nc.md`.
It uses the same `PropertyPage.astro` component, availability logic, galleries,
and inquiry form as every other location. Edit it under **Locations → Morganton**
in the CMS. Its public URL is `/locations/morganton-nc/`; `/retail-space/` redirects
there. The former separate retail collection and page have been removed.

The shared location fields include Property Type, Tenant Access, and an optional
Hero Logo. Morganton is retail, with both 1,200 and 2,400 sq ft units available.
Unverified specifications and tenant access direct visitors to leasing. The nine
owner-provided photos remain in `public/images/morganton/`. No floor plans were
provided, and the listing states that clearly. Photos are property-level because
the owner has not identified which photos belong to each available unit size.

## Portfolio groups and draft listings

The shared navigation groups Locations into Small Bay Spaces (Durham, Concord,
Fletcher / Asheville, Columbia), Larger Warehouses (High Point), and
Retail Space (Morganton). The main Locations link opens the directory. On desktop,
hovering over Locations or its arrow opens the submenu; clicking the arrow and
keyboard controls also work. Mobile keeps its tap-to-open menu. Desktop and
mobile use the same grouped data; `navigationOrder` sets the order within
each navigation group. The existing Fletcher URL remains `/locations/asheville-nc/`.

The homepage leads with small-bay cards, followed by larger warehouses. Morganton
Retail joins the main small-bay card section using `homepageGroup: flex` (Homepage
Section in the CMS). This override affects homepage cards only: Morganton stays
under Retail Space in the menu and directory filters, and keeps its retail labels.
Small-bay industrial size claims and the hero slideshow exclude retail.
The directory remains sorted by availability and supports all three type filters.

`published: false` excludes a property from generated pages, navigation, homepage,
directory, related-property links, inquiry options, and sitemap. CMS new entries
default to unpublished; existing records without this field stay published for
backward compatibility. West Asheville / Candler is an unpublished draft with
separate 5,000, 7,000, and 10,000 SF units. Do not enable publication until marketing
and acquisition timing are confirmed. Its `marketingStage: subject-to-acquisition`
shows an ownership/acquisition disclaimer and permits interest inquiries only,
even if someone accidentally marks its location or a suite available.

Concord is 3,400 SF with a half-acre paved storage yard, available at $15/SF base
rent. High Point is 11,700 SF with a 1.3-acre storage yard, coming soon
after renovation and upfit at $8/SF base rent. Market this property as High Point;
Archdale appears only in its postal address and address-based map/directions data.
Rent periods, additional charges,
access, and permitted uses require confirmation. Edit `yard`, `yardNotes`,
`highlights`, and `pricingNote` in the CMS to keep those details consistent.
Every property page includes a permanent canonical URL, a native-share/copy-link
button, and social image metadata for sending directly to prospects.

The seven replacement, owner-provided edited Concord photos are in
`public/images/concord/`; the public address is 101 Corban Ave SW. High Point assets
are in `public/images/high-point/`: the original interior photo shows the building
before renovation; the three supplied PNGs are owner-confirmed proposed-renovation
renderings. `galleryImageTypes` mirrors gallery order and visibly labels renderings
on cards and photo galleries. Social previews prefer an actual property photo.
