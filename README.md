# AuditFlow

**Account system update:** Supabase email/password auth and PostgreSQL storage now replace the previous ChatGPT/D1 path. Read [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) first. Project credentials and SQL migration must be configured before the workspace can be used. The earlier D1 verification below describes the previous release, not live Supabase verification.

A working early release for collecting website evidence, managing SEO tasks and editing client reports. **This is not yet the complete production-ready, multi-role SaaS in the original brief.** The core workflow is implemented and locally exercised; remaining differences are listed below.

## Stack

React 19, TypeScript, Tailwind 4, shadcn/Radix components, Vinext (Next.js-compatible routing) on Cloudflare Workers, D1 SQLite with Drizzle-generated migrations, platform-managed ChatGPT authentication, and server-generated PDFs using pdf-lib. D1 and managed authentication replace the preferred PostgreSQL and app-owned password stack on this hosting platform.

## Run locally

Requires Node 22.13+ (Node 24 recommended).

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_acoustic_stick.sql
# Apply each later drizzle/*.sql migration in order with the same command.
npm run dev
```

Open the Local URL printed by the server. Local sign-in at `/signin-with-chatgpt?return_to=/` uses the starter's **development-only** account (Seedy). This simulation is absent from production. The local database is under `.wrangler/state`; keep it to preserve local data. Production D1 data is separate and starts empty. No fabricated audits or analytics are seeded.

If Windows npm.cmd resolves incorrectly in this environment, use `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" ci`, and `node scripts/run-framework.mjs dev` / `build`.

## Environment and hosted setup

- `.openai/hosting.json` declares `DB`; the Sites platform provisions the actual D1 database and applies committed migrations.
- Authentication is supplied by trusted platform identity headers. Do not deploy the Worker directly behind an endpoint where arbitrary visitors can set `oai-authenticated-user-*` headers. Keep the hosted Site's identity gateway in front of the application.
- Core workflows require no external API credentials.
- `.env.example` lists optional provider keys. Use `.dev.vars` for Worker secrets in local development and Sites environment secrets for production. Never commit populated environment files.
- `APP_ORIGIN`: exact HTTPS deployment origin, without a trailing slash.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: a Google web OAuth client. Enable Search Console API, Analytics Admin API and Analytics Data API. Register `APP_ORIGIN/api/google/callback` as its authorized redirect URI.
- `TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hex characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Save as a secret. Changing it requires reconnecting stored Google accounts.
- `PAGESPEED_API_KEY`: an enabled PageSpeed Insights API key, saved as a secret.
- OAuth requests read-only scopes, PKCE and expiring, single-use state. Tokens are AES-GCM encrypted before storage. Disconnect removes locally stored credentials; Google account access can additionally be revoked in the Google account's security settings.
- Google integration flows and API collection are implemented but **not live-account verified**: no credentials were available. The UI displays disconnected/configuration states without invented metrics.

## Implemented

- Agency overview, landing page, sign-in/sign-out, agency name and brand color.
- Owner-isolated persistent clients (one website per client in this release), audit history, findings, tasks, reports and UTM campaigns.
- Limited same-origin crawl (5/10/20 pages), persistent checkpoints, progress, cancellation, fresh retries, per-request timeouts, 1.5 MB page cap, conservative robots handling, crawl-delay handling, redirect cap, public DNS validation, and one active audit per owner enforced by a database index.
- Crawl jobs run in background request lifetimes and resume on workspace refresh. **They are not an independent durable queue**: after the browser closes, a checkpoint may wait for the next workspace visit. A 15-minute audit deadline applies.
- Page records: HTTP status, final URL, title, description, headings, canonicals, directives, links, images, word count, text fingerprint, redirect chain and collection date.
- Checks for HTTP errors, redirects, missing/duplicate/length title and description, headings, alt attributes, canonicals, noindex, short-content review suggestions, exact-content candidates, internal links, HTTPS/mixed resources, social metadata, HTML language, and JSON-LD syntax. Sitemap.xml discovery and limited orphan candidates are included; sitemap indexes are not expanded.
- Evidence, explanations, fixes, severity and transparent priority for findings. Priority uses severity and observed affected-page counts; traffic weighting and measured effort are not implemented.
- Transparent crawl score, filtering, URL inspection, CSV export, and previous-crawl comparisons limited to revisited URLs.
- Finding-to-task conversion; status, assignee text, due date, comments and evidence notes.
- Editable, reorderable, hideable report sections with Classic and Editorial templates, live preview, brand color, PDF export, and hashed, revocable 7-day share tokens.
- Google OAuth with encrypted tokens; Search Console property discovery and page/query metrics, GA4 property discovery and organic landing-page sessions/key events, PageSpeed device-specific collection. Raw source metrics and collection timestamps are inspectable.
- Search Console opportunity rule: page/query rows with at least 100 impressions and CTR below 2% in the collected period. These are review suggestions, not ranking promises.
- Saved UTM builder and an optional WebMCP navigation tool using the same UI state.

## Verification

```sh
npx tsc --noEmit
node --experimental-strip-types --test tests/audit.test.ts
# With the local dev server running at localhost:5173:
node tests/e2e.mjs
```

The end-to-end test creates clearly labeled **local QA records**, crawls example.com, verifies persistent task/report edits, downloads a PDF and CSV, checks a shared report, revokes its link, and verifies anonymous API denial. Local QA records are not deployed. Security unit tests exercise URL restrictions, public IPv4 boundaries, robots precedence and evidence generation. Desktop and phone layouts and WebMCP valid/invalid navigation were inspected. A three-page exported PDF was rendered and checked for clipping.

## Release gaps and production requirements

- No app-owned email/password registration or reset. ChatGPT manages identity and account recovery.
- Owner-only workspaces: Admin/Marketer/Client memberships, team invitations, billing, client portal authorization and multiple websites per client remain unimplemented. Task assignees are text, not validated team members.
- The published Site remains private. Share tokens are secure within the application's routes, but the hosting gateway still requires Site access. **External client access requires an explicit hosting/access design; a share token does not bypass the private gateway.** Optional share passwords and configurable expiry are not implemented.
- PDFs are generated server-side using a paginated document renderer, not an HTML browser. Preview and PDF wrapping can differ; standard PDF fonts currently replace unsupported Unicode characters. Logo uploads, screenshots, charts and rich tables are not implemented.
- Independent queue infrastructure, scheduled monthly reports/delivery/review, email, observability, backup/restore operations, load testing and a security review are required before production use at agency scale.
- The crawler uses static HTML parsing, not JavaScript rendering. It limits origins strictly, including redirects. Add the final HTTPS/www URL if the start URL redirects to a different origin. DNS validation checks current public addresses; use an egress proxy with DNS pinning for stronger rebinding protection in an untrusted multi-tenant deployment.
- Thresholds are documented in `lib/audit/checks.ts` (title 15–60 characters, description 70–160, visible words <150) but are not user-configurable yet. Regex-based HTML extraction is intentionally limited and can misinterpret unusual markup.
- Full structured-data validation, complete accessibility auditing, robust near-duplicate detection, link-opportunity semantics, Search Console indexing inspection, historical Google comparisons, declining-click opportunities and automatic Google data injection into reports remain deferred.
- Additional marketer modules (landing-page checklists, content briefs, competitor comparisons, activity logs, grounded AI drafts), screenshots and custom logo assets remain deferred.

## Architecture

`lib/audit/network.ts`: URL/DNS/redirect policy and robots matching. `checks.ts`: pure page checks. `runner.ts`: background checkpoints and scoring. `lib/store.ts`: owner-scoped prepared database queries. `lib/google.ts`: provider credentials and encrypted token lifecycle. `app/api/*`: server authorization and mutations. `app/workspace-views.tsx`: audit/task/report tools. `app/integrations.tsx`: explicit provider consent and collected-data states.

## Latest publishing status

The production build passed. Publishing is blocked because Sites returns `project_not_found` for the existing registered project `appgprj_6ab8e03b99248191b873fa19a7749335` when retrieving the project or renewing its source credential. No successful deployment URL exists. The identity has been preserved; do not recreate the same Site blindly. Restore access to that project before continuing the Sites publication flow.
