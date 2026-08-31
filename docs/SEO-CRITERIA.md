# What makes a blog post rank & read well

This is the research behind SEO Engine's scoring. Every rule below maps to a
check in `src/lib/analysis/checks/` with a tunable threshold in
`src/lib/analysis/config.ts`. Two families of signal matter, and modern search
rewards posts that do well on **both**: technical/on-page SEO *and* the quality
and readability of the writing itself.

## The big picture: what search engines actually reward

Google has said for years that it ranks **helpful, reliable, people-first
content**. Two ideas dominate current guidance:

- **Helpful Content is a permanent, site-wide signal.** Thin or unhelpful
  content anywhere on a site can hold back even your well-optimized pages.
- **E-E-A-T** — Experience, Expertise, Authoritativeness, Trustworthiness.
  Content should show first-hand experience, cite sources, and make clear who
  wrote it and why. This is now approximated algorithmically, not just used by
  human raters.

On-page SEO (titles, headings, keyword placement, internal links, descriptive
URLs) is still the backbone, and **readability / user experience** feeds
engagement metrics that correlate with rankings. SEO Engine scores the things
you control on the page; it can't manufacture backlinks or domain authority.

---

## Readability checks (the writing)

These mirror the widely used Yoast readability analysis. Each is a traffic
light; the category score is a weighted blend.

| Check | Good (green) | Needs work | Why it matters |
|---|---|---|---|
| **Flesch Reading Ease** | ≥ 60 | < 50 | 60+ is "plain English" — comfortable for a general web audience. Driven by sentence length and syllables per word. |
| **Sentence length** | ≤ 25% of sentences over 20 words | > 30% | Long sentences are hard to follow on screens. |
| **Paragraph length** | no paragraph over ~150 words | 2+ long paragraphs | Big blocks of text don't get read; they get skipped. |
| **Subheading distribution** | ≤ 300 words between H2/H3s | long runs with no heading | Subheadings let readers (and Google) scan structure. |
| **Passive voice** | ≤ 10% of sentences | > 15% | Active voice is punchier and clearer. |
| **Transition words** | ≥ 30% of sentences | < 20% | Words like *however*, *therefore*, *for example* signal how ideas connect. |
| **Consecutive sentences** | no 3+ in a row starting the same way | 3+ | Varied openings keep prose from feeling monotonous. |

## SEO checks (the optimization)

| Check | Good (green) | Why it matters |
|---|---|---|
| **Focus keyphrase set** | a keyphrase is chosen | Everything below keys off the term you want to rank for. |
| **Keyphrase in SEO title** | present, ideally near the front | The title is the single strongest on-page relevance signal. |
| **Keyphrase in meta description** | present | Reinforces relevance and improves click-through. |
| **Keyphrase in introduction** | within first ~120 words | Tells readers and crawlers what the post is about immediately. |
| **Keyphrase in a subheading** | in ≥ 1 H2/H3 | Structural reinforcement of the topic. |
| **Keyphrase in URL slug** | slug reflects the keyphrase | A recognized on-page signal; keep slugs short and hyphenated. |
| **Keyphrase in image alt** | ≥ 1 image alt includes it (naturally) | Alt text aids accessibility and image search — don't stuff it. |
| **Keyphrase density** | ~0.5%–3% | Enough to signal relevance, not so much it reads as stuffing (>4% is flagged). |
| **Keyphrase length** | 1–4 words | Focused phrases are easier to rank for than long or single-word terms. |
| **SEO title width** | ≤ ~580px (≈ 50–60 chars) | Titles wider than this get truncated in Google results. |
| **Meta description length** | 120–158 characters | Longer descriptions get cut off in the SERP. |
| **Content length** | ≥ 300 words (600+ better) | Thin content struggles to rank; comprehensive content tends to win. |
| **Image alt coverage** | every image has alt text | Accessibility + image SEO; also a quality signal. |
| **Internal links** | ≥ 1 | Spreads authority and helps users (and crawlers) navigate your site. |
| **Outbound links** | ≥ 1 to a credible source | Linking to authoritative sources supports E-E-A-T. |
| **URL slug quality** | short, hyphenated, few stop words | Clean, readable URLs are a small but real signal. |

## How the score is computed

- Each check is scored `good = 100`, `ok = 55`, `bad = 0`.
- Checks carry weights (e.g. the SEO title and keyphrase-in-title are weighted
  higher than outbound links). See the `weight` field on each check.
- **SEO score** and **Readability score** are the weighted averages of their
  respective checks; **Overall** is the mean of the two.
- Thresholds live in one file (`config.ts`) so you can tune them to your niche —
  a technical blog and a lifestyle blog can reasonably target different reading
  levels.

## What the rules deliberately *don't* cover

Off-page factors — backlinks, domain authority, Core Web Vitals, mobile
performance, crawl/index health — matter enormously but aren't things you edit
inside a draft, so they're out of scope for the per-post optimizer. The AI
layer will still flag when a post reads as thin or low-expertise, which is the
part of "helpful content" you *can* fix in the editor.

## Sources

- [Google Search Central — Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Yoast — How we built the readability analysis](https://yoast.com/content-analysis-methodological-choices-explained/)
- [Yoast — How to use the readability analysis](https://yoast.com/yoast-seo-readability-analysis/)
- [Yoast — Image SEO: alt text and title text](https://yoast.com/image-seo-alt-tag-and-title-tag-optimization/)
- [Verblio — Flesch Reading Ease explained](https://www.verblio.com/blog/flesch-reading-ease)
- [Meta title & description length guidelines (2026)](https://www.wscubetech.com/blog/meta-title-description-length/)
- [Shopify — Keyword density best practices](https://www.shopify.com/blog/keyword-density-seo)
