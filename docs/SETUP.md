# Setup & provisioning guide

Everything you need to gather and configure, in order. Each section says exactly
what **you** provide and where it goes.

---

## 1. Claude AI (required for AI features)

Powers suggestions, auto-fix, alt-text generation, and LinkedIn drafting.

- **You provide:** an API key from <https://console.anthropic.com/>.
- **Where:** `ANTHROPIC_API_KEY` env var.

The rule-based score/checklist works without this; only the AI buttons need it.

---

## 2. Deploying to Vercel + your custom domain

1. Push this repo to GitHub and **Import** it in Vercel — it auto-detects Next.js.
2. In **Project → Settings → Environment Variables**, add the variables from
   `.env.example` you plan to use (at minimum `ANTHROPIC_API_KEY`).
3. In **Project → Settings → Domains**, add your company domain (e.g.
   `seo.yourcompany.com`) and point the DNS record Vercel shows you (a CNAME to
   `cname.vercel-dns.com`, or the A record for an apex domain).
4. Redeploy. Your app is now at `https://seo.yourcompany.com`.

**Function timeouts:** the auto-fix route is configured for up to 300s
(`vercel.json`). Durations above 60s require the **Vercel Pro** plan; on Hobby,
lower `maxDuration` to 60 or expect long rewrites to time out.

> The app itself has no database — it's stateless. LinkedIn tokens are stored in
> an httpOnly cookie in the editor's browser, so nothing sensitive is persisted
> server-side.

---

## 3. WordPress publishing

### a. Application Password (required to publish)

- **You provide:** your site URL, WordPress username, and an Application Password
  from **WP Admin → Users → Profile → Application Passwords**.
- **Where:** enter them in the Publish dialog, or set `WORDPRESS_URL`,
  `WORDPRESS_USERNAME`, `WORDPRESS_APP_PASSWORD` as env defaults.

### b. SEO Engine Bridge plugin (required for SEO meta fields)

Yoast, Rank Math, and All in One SEO all **hide their fields from the REST API by
default**, so a normal publish can't set the SEO title, meta description, or
focus keyphrase. The bundled companion plugin fixes that and maps our neutral
fields onto whichever plugin you use.

1. Copy [`wordpress-plugin/seo-engine-bridge.php`](../wordpress-plugin/seo-engine-bridge.php)
   to `wp-content/mu-plugins/` on your site (create the folder if needed) — it
   loads automatically as a must-use plugin. (Or drop it in `wp-content/plugins/`
   and activate it under **Plugins**.)
2. That's it. On publish, the app sends neutral `seo_engine_*` meta and the plugin
   writes them into Yoast / Rank Math / AIOSEO. The app auto-detects the plugin via
   `GET /wp-json/seo-engine/v1/status`.

**Tags & categories** are created automatically by name — no setup needed.

---

## 4. LinkedIn integration

Posting to LinkedIn requires your own LinkedIn developer app.

1. Create an app at <https://www.linkedin.com/developers/apps> (associate it with
   your company page).
2. Under **Products**, request:
   - **Sign In with LinkedIn using OpenID Connect** (to identify the member).
   - **Share on LinkedIn** — grants `w_member_social` for posting to a personal
     profile. Usually available immediately.
   - **Community Management API** — grants `w_organization_social` for posting to
     your **company page**. This one requires LinkedIn's review (typically 2–4
     weeks).
3. Under **Auth**, add the **Authorized redirect URL**:
   `https://seo.yourcompany.com/api/linkedin/callback` (must match exactly).
4. **You provide:**
   - `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (from the Auth tab).
   - `LINKEDIN_REDIRECT_URI` (the URL above; optional — defaults to
     `<origin>/api/linkedin/callback`).
   - `LINKEDIN_SCOPES` — keep the default `openid profile w_member_social` until
     the Community Management API is approved, then add `w_organization_social`.
   - `LINKEDIN_ORG_ID` — your company page's numeric ID (only needed to post to
     the page). Find it in the page URL or via the org lookup API.

Personal-profile posting works as soon as **Share on LinkedIn** is granted;
company-page posting lights up once the org product is approved.

---

## 5. Indexing — do you need it?

**Short answer: partly, and it's mostly handled for you.**

- **Sitemaps (Google + everyone):** your SEO plugin (Yoast/Rank Math/AIOSEO)
  already generates an XML sitemap at e.g. `/sitemap_index.xml`. Submit it once in
  **Google Search Console** and **Bing Webmaster Tools**. New posts appear in the
  sitemap automatically — this is the primary path for Google, which does **not**
  support IndexNow.
- **IndexNow (Bing, Yandex, Naver, Seznam, Yep — and Bing powers ChatGPT search):**
  this app can ping IndexNow the moment you publish, so those engines learn about
  the URL in minutes instead of waiting for a crawl.

To enable IndexNow:

1. Generate a random hex key (8–128 chars). Set it as `INDEXNOW_KEY`.
2. Host a text file at your **blog's** root whose name and contents are the key,
   e.g. `https://blog.yourcompany.com/<key>.txt` containing just `<key>`. (This
   file must live on the WordPress site being indexed, not on the Vercel app.)
3. Tick "Notify search engines via IndexNow" in the Publish dialog. On a public
   publish, the app submits the new URL.

> IndexNow doesn't *guarantee* indexing — it just tells engines to look now.
> Google indexing still depends on sitemaps, internal links, and content quality.
> (Google's own Indexing API is officially limited to job-posting/livestream
> pages, so it isn't wired in here.)

---

## 6. Staff accounts (multi-user mode)

By default the app is single-user (no login). To let your staff sign in with
roles and an approval workflow, set **both** `AUTH_SECRET` and `DATABASE_URL`.
With only one set, the app stays single-user (this prevents accidental lockout).

### a. Database (Neon)

1. Create a free Postgres database at <https://neon.tech> and copy its connection
   string into `DATABASE_URL`.
2. Apply the schema once: `DATABASE_URL=... npm run db:setup` (locally), or run it
   against your production DB. It creates the `users`, `articles`,
   `app_settings`, and `linkedin_connections` tables.

### b. Secrets

- `AUTH_SECRET` — signs the session cookie. Generate with `openssl rand -hex 32`.
- `ENCRYPTION_KEY` — encrypts stored credentials (the shared WordPress app
  password, LinkedIn tokens). Generate with `openssl rand -hex 32`. **Don't lose
  it** — rotating it makes existing stored secrets unreadable.

### c. First admin & sign-in

- The **first account created becomes an admin**. You can also list admin emails
  in `ADMIN_EMAILS` (comma-separated) so those users are admins on first sign-in.
- Optionally restrict who can register with `ALLOWED_EMAIL_DOMAIN` (e.g.
  `teasoo.com`), so only company emails can create accounts.
- **Google sign-in** (optional): create OAuth credentials at Google Cloud →
  APIs & Services → Credentials, add
  `https://your-domain/api/auth/google/callback` as an authorized redirect URI,
  and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Both Google and
  email/password work side by side.

### d. Roles & workflow

| Role | Can do |
|---|---|
| **Admin** | Everything: manage users & their roles, set the shared WordPress connection and company LinkedIn ID, write, and publish. |
| **Editor** | Write, review the queue, and publish directly to WordPress. |
| **Author** | Write and **submit for review**; an editor/admin approves & publishes. |

Manage people under **Admin → Team members** (promote/demote, disable accounts).

### e. Shared WordPress vs. per-user LinkedIn

- **WordPress is shared:** an admin sets the company blog connection once under
  **Admin → Shared WordPress connection**. All publishers use it (the app
  password is encrypted at rest). Individual staff never enter WordPress
  credentials.
- **LinkedIn is per-user:** each staff member clicks **Connect LinkedIn** in the
  Distribute panel and authorizes their own account; their token is stored
  encrypted against their user. Company-page posting uses the shared
  `LINKEDIN_ORG_ID` and each connected user's authorization.

> Same article, both places: the editor holds one article. "Post to LinkedIn"
> can **AI-adapt** it into a native post or post the **article as-is**
> (headline + summary) — your choice, from the same draft.

---

## Quick checklist

| Feature | You provide | Required? |
|---|---|---|
| Live score & checklist | nothing | works out of the box |
| AI suggestions / auto-fix / alt text | `ANTHROPIC_API_KEY` | for AI features |
| Publish to WordPress | site URL + username + App Password | to publish |
| SEO meta on publish | install the Bridge plugin | for Yoast/RankMath/AIOSEO meta |
| Instant indexing | `INDEXNOW_KEY` + hosted key file | optional |
| Post to LinkedIn profile | LinkedIn app + `w_member_social` | to post |
| Post to LinkedIn company page | + `w_organization_social` (reviewed) + `LINKEDIN_ORG_ID` | to post to page |
| **Staff accounts + roles** | `DATABASE_URL` + `AUTH_SECRET` + `ENCRYPTION_KEY` (+ Google optional) | for multi-user |
