# 🔍 SEO Engine — Blog Post Optimizer

A self-hosted web app that scores your blog posts for **SEO** and **readability**
before they go out, suggests fixes, can **auto-fix** them with AI, and publishes
the finished post straight to **WordPress** — a free alternative to the paid
SEO plugins, working from one place across the posts you also share on LinkedIn.

It combines two engines:

1. **A deterministic rule engine** (Yoast/Google-style checks) that gives you an
   instant, explainable score with a green/orange/red breakdown — no API key,
   no cost, fully offline.
2. **An AI layer (Claude)** that reads the draft plus the rule results and either
   suggests prioritized, concrete edits, rewrites the post in one click, or
   generates missing image alt text and a LinkedIn post.

Then it publishes to **WordPress** over the REST API (with SEO meta, tags &
categories) and cross-posts to **LinkedIn**, so a post that's "good to go" never
has to leave the tool.

---

## What it checks

25+ checks across on-page SEO and readability — keyphrase placement (title, meta,
intro, subheadings, slug, image alt), secondary/"search" keyphrases, keyphrase
density, SERP title-width in pixels, meta-description length, content length,
internal/outbound links, image alt coverage, tags & category, Flesch reading
ease, sentence & paragraph length, subheading distribution, passive voice,
transition words, and more.

**The full criteria, thresholds, and the research/sources behind them are in
[`docs/SEO-CRITERIA.md`](docs/SEO-CRITERIA.md).**

## Features

- **Live SEO + readability score** with a green/orange/red checklist.
- **Focus keyphrase, secondary keyphrases, tags, and category** all analyzed.
- **AI suggestions** and **one-click auto-fix** (rewrites the body, meta, title,
  slug, and proposes tags/category/secondary keyphrases).
- **AI alt-text generation** for images that are missing it (uses Claude vision
  for public image URLs).
- **Publish to WordPress** with SEO meta written into **Yoast, Rank Math, or All
  in One SEO** (via the bundled bridge plugin), plus auto-created tags/categories.
- **LinkedIn**: connect via OAuth, generate a native post from the article, and
  publish to your profile or company page.
- **Instant indexing** via IndexNow on publish (Bing/Yandex/etc.).

**New here? Read [`docs/SETUP.md`](docs/SETUP.md) — it lists exactly what to
provide (keys, plugin, LinkedIn app) and how to deploy to Vercel + a custom
domain.**

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure (optional — the analyzer works without any keys)
cp .env.example .env
#   - add ANTHROPIC_API_KEY to enable AI suggestions & auto-fix
#   - add WORDPRESS_* to pre-fill publishing credentials

# 3. Run
npm run dev
# open http://localhost:3000
```

The rule-based analysis and scoring run with **no configuration**. AI features
and WordPress publishing activate when you add the relevant credentials (in
`.env` or directly in the UI).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app in development |
| `npm run build` / `npm start` | Production build & serve |
| `npm test` | Run the engine's unit tests (Vitest) |
| `npm run typecheck` | Type-check without emitting |

---

## Using it

1. Paste or write your post (Markdown **or** the HTML from the WordPress editor).
2. Fill in the SEO title, focus keyphrase, slug, and meta description.
3. Watch the **live score** and the traffic-light checklist update as you type.
4. Click **Get AI suggestions** for prioritized, specific advice, or
   **✨ Auto-fix with AI** to get a rewritten version — you review a before/after
   score and the list of changes, then apply or discard.
5. Click **Publish to WordPress** → test the connection → save as draft or publish.

### Connecting WordPress

SEO Engine authenticates with **Application Passwords** (built into WordPress
5.6+), so you never share your real login:

1. In WordPress: **Users → Profile → Application Passwords**.
2. Add a name (e.g. "SEO Engine") and copy the generated password.
3. In the publish dialog (or `.env`), enter your **site URL**, **username**, and
   that **application password**.

The post is created via `POST /wp-json/wp/v2/posts` with tags and categories
(created by name automatically).

> **SEO meta needs the bridge plugin.** Yoast, Rank Math, and All in One SEO all
> hide their fields from the REST API by default. Install the bundled
> [`wordpress-plugin/seo-engine-bridge.php`](wordpress-plugin/seo-engine-bridge.php)
> (a one-file mu-plugin) and the SEO title, meta description, focus keyphrase, and
> secondary keyphrases are written into whichever plugin you use. Full steps in
> [`docs/SETUP.md`](docs/SETUP.md).

---

## Architecture

```
src/
  lib/
    analysis/        # the rule engine — pure, deterministic, tested
      config.ts      #   all thresholds in one place (tune to your niche)
      text-stats.ts  #   syllables, Flesch, passive voice, transitions
      parse.ts       #   Markdown/HTML -> structured document
      checks/
        readability.ts
        seo.ts
      index.ts       #   analyze() orchestrator + scoring
    ai/              # Claude integration
      suggest.ts     #   prioritized suggestions
      autofix.ts     #   one-click rewrite (streamed)
      alt-text.ts    #   vision-based image alt-text generation
      linkedin-post.ts #  adapt an article into a LinkedIn post
    wordpress/       # WordPress REST client (Application Passwords, meta, terms)
    linkedin/        # LinkedIn OAuth + Posts API client
    indexing/        # IndexNow submission
  app/
    page.tsx         # the editor + live score UI + LinkedIn panel
    api/             # thin API routes over the libs
wordpress-plugin/
  seo-engine-bridge.php  # companion mu-plugin: maps SEO meta to Yoast/RankMath/AIOSEO
```

The rule engine is intentionally framework-free — you can import `analyze()`
into a CLI, a cron job, or a CI check without pulling in Next.js.

---

## Roadmap / extending

- **Featured image upload.** Upload and attach a featured image during publish.
- **Scheduling.** Queue posts for a future publish date (WordPress `future`
  status is already supported by the client).
- **Company-page posting.** Works once your LinkedIn app's Community Management
  API access is approved (see `docs/SETUP.md`).
- **Batch mode.** Run `analyze()` over a folder of drafts in CI and fail the
  build on low scores.

Tune any threshold in `src/lib/analysis/config.ts`; add a check by dropping a
function into `checks/` and pushing its result — the score and UI pick it up
automatically.
