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
Property contact cards use full-width call/text rows with SVG icons and the phone
number inside the call action. The intro's Now leasing dot gives two gentle halo
pulses (under five seconds) and stays static for reduced-motion users.
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

The shared tour/waitlist pop-out collects location, ideal unit size, name, business
name or website, and cell phone. Location and size share one row on desktop and
mobile. A specific suite CTA replaces the ideal-size selector with a read-only
**Unit** field showing the chosen size (and unit number when recorded). Changing
location or opening a general CTA restores the size selector. Exact-space
requests save the suite selection without a redundant size range; notification
emails and the inbox show the chosen space instead. General requests use sizes of 500–1,000, 1,000–1,500, 1,500–2,000, and 2,000+ sq ft. The selected
size is saved in the private request record, displayed in the admin, and included
in notification emails. Emails also include the property street address, city,
state, and ZIP when recorded, plus the selected suite name/size and unit number
when known. Suite-card buttons carry the specific selection; changing location
or opening a general CTA clears it. General inquiries explicitly say no space
was selected. A property with one listed space identifies it as the only listing,
not as an explicit visitor selection. Add actual unit identifiers under
**Locations → Suites → Unit / Suite Number** in the CMS; blank unit numbers and
missing ZIP codes are explained in the notification instead of guessed. Older forms and requests without a size remain valid. Large call and text links sit beside it on desktop;
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

Share `https://getflexspace.com/?waitlist=1` to open the general waitlist. Use a
published property slug, such as `?waitlist=asheville-nc`, to preselect it. A
property page also accepts `?waitlist=1` to preselect that property. Selecting a
location while the waitlist is open updates the browser URL, ready to copy; only
the property slug and an optional selected-space key are added, never personal form details. Closing removes the
waitlist parameter. Unpublished or unknown locations are never preselected.

### Tour request admin

Open `/admin/` for username/password sign-in to both content and the private
**Tour requests** inbox. Existing Sveltia GitHub sessions still work; the
**Owner sign-in with GitHub** link is the recovery/bootstrap route.

The **Accounts** tab is restricted server-side to account owners and the verified
`jimkittridge` GitHub owner. Create one Editor account per person/AI: editors can
publish CMS content and manage all tour/waitlist requests, but cannot create
accounts or modify website code, workflows, admin configuration, or other repos.
Owner accounts can also manage access. Password reset and Disable access revoke
all of that account's sessions immediately. Account activity records sign-ins,
account changes, and the file paths in content commits (not lead contact details).

Passwords are **server-generated 256-bit random secrets**, shown once. Store/share
them through a password manager. They are hashed with SHA-256 like high-entropy
API keys; human-chosen passwords are intentionally not accepted. Do not add a
custom-password field without a suitable password KDF and migration. There is no
public registration or emailed reset flow: an owner generates a replacement.

Actual sessions use host-only Secure, HttpOnly, SameSite=Strict cookies, expire
in 12 hours, and are hashed in D1. Sveltia's pinned user-cache format carries a
CSRF marker which is useless without the cookie. The server checks the account
and session on each request. Both the workspace Sign out button and Sveltia's
account-menu Sign Out revoke the cookie-backed session. Password accounts use a
restricted same-origin GitHub gateway; the GitHub credential never reaches the
browser. Legacy owner GitHub sessions still use the existing direct API adapter.

The CMS remains pinned to **0.229.0**. Verify the gateway read/save/upload flows,
cache adapter, and both sign-out paths before upgrading. The inbox includes
status filters, New/Contacted/Tour scheduled/Closed statuses, phone links,
notification status, and a retry button for failed notifications.

#### One-time standard-login setup

1. Apply `migrations/0004_admin_accounts.sql` to production `LEADS_DB`. This only
   creates account/session/rate-limit/audit tables; existing leads are unchanged.
2. Create a **fine-grained GitHub personal access token**, limited to the
   `jimkittridge/GetFlexSpace` repository with **Contents: Read and write** and
   the required read-only metadata access. Store it as an encrypted production
   Pages secret named **CMS_GITHUB_TOKEN**, then redeploy. Do not use the owner's
   broad personal token or put any token in the repo. Optional Checks/Deployments
   read access enables Sveltia's deployment-status display, not content editing.
3. At `/admin/?login=github`, sign in as the GitHub owner. Open **Accounts** and
   create your own Owner login, then separate Editor logins for AI tools. Save
   each generated password immediately; it cannot be retrieved later.
4. Verify a new login, a content save, the inbox, and revocation before sharing
   accounts. Do not grant live agents access by reusing a local fixture account.

Without the secret, password accounts can still access the inbox; the Content
panel explains the missing connection, and the owner GitHub route still works.
Use a separate D1 database and repository credential for any trusted preview.
Never bind production lead data or credentials to untrusted preview code.

The gateway permits markdown in the configured CMS content collections, ordinary
PNG/JPEG/WebP/GIF uploads under `public/images`, and PDFs under `public/documents`.
It rejects executable uploads (including SVG/HTML), arbitrary API calls and
branches, scripted URLs, and executable markup. Markdown rendering is sanitized
and JSON-LD escapes `<` to keep content from becoming script. Current AVIF upload
support is deliberately disabled for password accounts pending an image-pipeline
security upgrade. Existing SVG brand assets remain readable and usable.

### Hosting setup

Cloudflare Pages Functions in `functions/` expose the form and authenticated
admin APIs. `server/tour-requests.js` contains validation, persistence, and email
logic. The static GitHub Pages mirror does not support these functions.

1. Create D1 database `getflexspace-tour-requests` and run
   `migrations/0001_tour_requests.sql`, `migrations/0002_ideal_unit_size.sql`, and
   `migrations/0003_inquiry_property_context.sql` in order in its console (or
   Wrangler). On an existing database, apply only unapplied migrations **before**
   deploying the corresponding code. These additions preserve existing requests.
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

The build and test scripts generate a server-only inquiry catalog from published
CMS location records. It emits a plain JavaScript module for compatibility with
Cloudflare’s hosted Pages Functions compiler. The API resolves location/suite identifiers against that
catalog, ignoring client-provided address or unit text. Each new lead saves a
snapshot of its address and space details in `property_context`, so a retry
does not silently use later listing edits. Legacy leads without a snapshot use
the current address with an explicit note; their original unit selection was not
captured and cannot be reconstructed. Run `npm run build` before a standalone
Cloudflare Functions compile so the generated catalog exists.

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

Use the standard login at `/admin/`. Owners manage individual logins under
**Accounts**; see the setup and credential handling notes above. The GitHub
recovery option keeps `auth_methods: [token]` and the original direct connection.
There is no need to share a GitHub token with an AI account.

The historical `oauth-proxy/` is unused and has no CSRF state/domain allowlist.
It is not part of standard sign-in and should not be deployed for this flow.

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

## Hickory larger warehouse

1108 9th Ave NE is published at `/locations/hickory-nc/` using the saved larger
warehouse format. Edit **Locations → Hickory** in the CMS. The owner's October 11,
2026 details supply the 9,000 SF warehouse / 1,260 SF office split, ceiling-height
areas, fenced paved yard, parking, and prospective business uses. The supplied
Commercial First brochure provides the photos, floor plan, postal address,
and $6,000/month NNN asking rent. Electrical service, HVAC, tenant-access hours,
and lease length are unconfirmed and direct visitors to leasing.

Photos and the floor plan are in `public/images/hickory/`; the unchanged brochure
is `public/documents/hickory-1108-9th-avenue-brochure.pdf`. Source:
https://www.commercialfirst.net/documents/957/Kittridge_Jim-_LSG_1_LLC_9th_Avenue.pdf
High Point stays unpublished, and its reusable reference remains intact.
