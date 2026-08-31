import type { AnalysisInput, CheckResult, ParsedContent } from "../types";
import { THRESHOLDS, SLUG_STOP_WORDS } from "../config";
import { countPhraseOccurrences, tokenizeWords } from "../text-stats";

/** Rough SERP pixel width of a title at Google's ~20px Arial rendering. */
export function estimateTitleWidthPx(title: string): number {
  // Per-character average widths (px). Narrow glyphs get less, wide glyphs more.
  const narrow = new Set([..."ijlt.,;:'!|/\\"]);
  const wide = new Set([..."mwMW@%"]);
  let px = 0;
  for (const ch of title) {
    if (narrow.has(ch)) px += 4;
    else if (wide.has(ch)) px += 14;
    else if (ch === " ") px += 5;
    else if (ch >= "A" && ch <= "Z") px += 12;
    else px += 9;
  }
  return Math.round(px);
}

const has = (haystack: string, needle: string) =>
  needle.trim().length > 0 &&
  countPhraseOccurrences(haystack, needle) > 0;

export function seoChecks(
  input: AnalysisInput,
  parsed: ParsedContent,
): CheckResult[] {
  const checks: CheckResult[] = [];
  const keyphrase = (input.focusKeyphrase ?? "").trim();
  const hasKeyphrase = keyphrase.length > 0;

  // 0. Focus keyphrase set -----------------------------------------------------
  if (!hasKeyphrase) {
    checks.push({
      id: "keyphrase-set",
      category: "seo",
      label: "Focus keyphrase",
      weight: 2,
      aiFixable: true,
      status: "bad",
      message:
        "No focus keyphrase set. Pick the term you want to rank for so keyphrase checks can run.",
    });
  }

  // --- Keyphrase placement checks (only meaningful with a keyphrase) ----------
  const kp = keyphrase;

  pushPlacement(checks, {
    id: "keyphrase-in-title",
    label: "Keyphrase in SEO title",
    weight: 2,
    present: hasKeyphrase && has(input.title ?? "", kp),
    hasKeyphrase,
    okMsg: "The focus keyphrase appears in the SEO title.",
    badMsg: "Add the focus keyphrase to the SEO title, ideally near the front.",
  });

  pushPlacement(checks, {
    id: "keyphrase-in-meta",
    label: "Keyphrase in meta description",
    weight: 1,
    present: hasKeyphrase && has(input.metaDescription ?? "", kp),
    hasKeyphrase,
    okMsg: "The focus keyphrase appears in the meta description.",
    badMsg: "Work the focus keyphrase into the meta description.",
  });

  const firstWindow = parsed.words
    .slice(0, THRESHOLDS.keyphraseFirstParagraphWindow)
    .join(" ");
  pushPlacement(checks, {
    id: "keyphrase-in-intro",
    label: "Keyphrase in introduction",
    weight: 1.5,
    present: hasKeyphrase && has(firstWindow, kp),
    hasKeyphrase,
    okMsg: "The focus keyphrase appears early in the content.",
    badMsg: `Use the focus keyphrase within the first ${THRESHOLDS.keyphraseFirstParagraphWindow} words.`,
  });

  const subheadingText = parsed.headings
    .filter((h) => h.level >= 2)
    .map((h) => h.text)
    .join("  •  ");
  pushPlacement(checks, {
    id: "keyphrase-in-subheading",
    label: "Keyphrase in a subheading",
    weight: 1,
    present: hasKeyphrase && has(subheadingText, kp),
    hasKeyphrase,
    okMsg: "The focus keyphrase appears in at least one subheading.",
    badMsg: "Add the focus keyphrase to at least one H2/H3 subheading.",
  });

  const altText = parsed.images.map((i) => i.alt).join(" ");
  pushPlacement(checks, {
    id: "keyphrase-in-image-alt",
    label: "Keyphrase in image alt text",
    weight: 0.5,
    present: hasKeyphrase && parsed.images.length > 0 && has(altText, kp),
    hasKeyphrase,
    okMsg: "An image alt attribute includes the focus keyphrase.",
    badMsg:
      parsed.images.length === 0
        ? "No images found. Add a relevant image with the keyphrase in its alt text."
        : "Include the focus keyphrase in at least one image's alt text.",
  });

  const slug = (input.slug ?? "").trim();
  pushPlacement(checks, {
    id: "keyphrase-in-slug",
    label: "Keyphrase in URL slug",
    weight: 1,
    present:
      hasKeyphrase &&
      slug.length > 0 &&
      slugContainsKeyphrase(slug, kp),
    hasKeyphrase,
    okMsg: "The URL slug reflects the focus keyphrase.",
    badMsg: slug
      ? "Include the focus keyphrase words in the URL slug."
      : "Set a URL slug that includes the focus keyphrase.",
  });

  // Keyphrase density ----------------------------------------------------------
  if (hasKeyphrase) {
    const { min, max, hardMax } = THRESHOLDS.keyphraseDensity;
    const occ = countPhraseOccurrences(parsed.text, kp);
    const density = parsed.words.length ? occ / parsed.words.length : 0;
    let status: CheckResult["status"];
    let message: string;
    if (density > hardMax) {
      status = "bad";
      message = `Keyphrase density is ${(density * 100).toFixed(1)}% (${occ}×) — that reads as keyword stuffing. Reduce it.`;
    } else if (density >= min && density <= max) {
      status = "good";
      message = `Keyphrase density is ${(density * 100).toFixed(1)}% (${occ}×) — in the healthy range.`;
    } else if (density > max) {
      status = "ok";
      message = `Keyphrase density is ${(density * 100).toFixed(1)}% (${occ}×) — a touch high. Ease off slightly.`;
    } else {
      status = occ === 0 ? "bad" : "ok";
      message = `Keyphrase density is ${(density * 100).toFixed(1)}% (${occ}×) — too low. Use the keyphrase (and variants) a few more times.`;
    }
    checks.push({
      id: "keyphrase-density",
      category: "seo",
      label: "Keyphrase density",
      weight: 1.5,
      aiFixable: true,
      status,
      message,
    });

    // Keyphrase length ---------------------------------------------------------
    const kpWords = tokenizeWords(kp).length;
    const { minWords, maxWords } = THRESHOLDS.keyphraseLength;
    const lenStatus =
      kpWords >= minWords && kpWords <= maxWords ? "good" : "ok";
    checks.push({
      id: "keyphrase-length",
      category: "seo",
      label: "Keyphrase length",
      weight: 0.5,
      aiFixable: false,
      status: lenStatus,
      message:
        lenStatus === "good"
          ? `Keyphrase is ${kpWords} word(s) — a good, focused length.`
          : `Keyphrase is ${kpWords} words. Aim for ${minWords}-${maxWords} words for a focused target.`,
    });
  }

  // SEO title width ------------------------------------------------------------
  {
    const width = estimateTitleWidthPx(input.title ?? "");
    const { min, good, hardMax } = THRESHOLDS.titleWidthPx;
    let status: CheckResult["status"];
    let message: string;
    if (width === 0) {
      status = "bad";
      message = "No SEO title set. Add a compelling, keyword-rich title.";
    } else if (width > hardMax) {
      status = "bad";
      message = `The title is ~${width}px wide and will be truncated in search results (keep under ${good}px).`;
    } else if (width < min) {
      status = "ok";
      message = `The title is only ~${width}px wide. You have room to make it more descriptive.`;
    } else if (width <= good) {
      status = "good";
      message = `The title width (~${width}px) fits nicely in search results.`;
    } else {
      status = "ok";
      message = `The title (~${width}px) is near the truncation limit. Trim a few characters to be safe.`;
    }
    checks.push({
      id: "title-width",
      category: "seo",
      label: "SEO title width",
      weight: 1.5,
      aiFixable: true,
      status,
      message,
    });
  }

  // Meta description length ----------------------------------------------------
  {
    const len = (input.metaDescription ?? "").trim().length;
    const { min, max, hardMax } = THRESHOLDS.metaDescription;
    let status: CheckResult["status"];
    let message: string;
    if (len === 0) {
      status = "bad";
      message = "No meta description. Write a 120-158 character summary that invites the click.";
    } else if (len < min) {
      status = "ok";
      message = `Meta description is ${len} chars — a bit short. Aim for ${min}-${max}.`;
    } else if (len <= max) {
      status = "good";
      message = `Meta description length (${len} chars) is ideal.`;
    } else if (len <= hardMax) {
      status = "ok";
      message = `Meta description is ${len} chars — close to being truncated. Trim toward ${max}.`;
    } else {
      status = "bad";
      message = `Meta description is ${len} chars and will be cut off. Keep it under ${max}.`;
    }
    checks.push({
      id: "meta-description-length",
      category: "seo",
      label: "Meta description length",
      weight: 1,
      aiFixable: true,
      status,
      message,
    });
  }

  // Content length -------------------------------------------------------------
  {
    const { min, good, excellent } = THRESHOLDS.wordCount;
    const wc = parsed.wordCount;
    let status: CheckResult["status"];
    let message: string;
    if (wc >= good) {
      status = "good";
      message =
        wc >= excellent
          ? `${wc} words — comprehensive, long-form content.`
          : `${wc} words — a solid length for ranking.`;
    } else if (wc >= min) {
      status = "ok";
      message = `${wc} words clears the ${min}-word minimum, but ${good}+ tends to rank better.`;
    } else {
      status = "bad";
      message = `${wc} words is thin. Aim for at least ${min}, ideally ${good}+.`;
    }
    checks.push({
      id: "content-length",
      category: "seo",
      label: "Content length",
      weight: 1.5,
      aiFixable: true,
      status,
      message,
    });
  }

  // Image alt coverage ---------------------------------------------------------
  {
    const imgs = parsed.images;
    const missing = imgs.filter((i) => !i.alt).length;
    let status: CheckResult["status"];
    let message: string;
    if (imgs.length === 0) {
      status = "ok";
      message = "No images. A relevant image or two improves engagement and image search traffic.";
    } else if (missing === 0) {
      status = "good";
      message = "All images have descriptive alt text.";
    } else {
      status = missing === imgs.length ? "bad" : "ok";
      message = `${missing} of ${imgs.length} images are missing alt text. Describe each image for accessibility and SEO.`;
    }
    checks.push({
      id: "image-alt",
      category: "seo",
      label: "Image alt text",
      weight: 1,
      aiFixable: true,
      status,
      message,
    });
  }

  // Internal links -------------------------------------------------------------
  {
    const internal = parsed.links.filter((l) => l.internal).length;
    const status = internal >= 1 ? "good" : "bad";
    checks.push({
      id: "internal-links",
      category: "seo",
      label: "Internal links",
      weight: 1,
      aiFixable: false,
      status,
      message:
        status === "good"
          ? `${internal} internal link(s) help spread authority across your site.`
          : "Add at least one internal link to a related post on your site.",
    });
  }

  // Outbound links -------------------------------------------------------------
  {
    const outbound = parsed.links.filter((l) => !l.internal).length;
    const status = outbound >= 1 ? "good" : "ok";
    checks.push({
      id: "outbound-links",
      category: "seo",
      label: "Outbound links",
      weight: 0.5,
      aiFixable: false,
      status,
      message:
        status === "good"
          ? `${outbound} outbound link(s) to sources build trust.`
          : "Consider linking to an authoritative external source to support your claims.",
    });
  }

  // Slug quality ---------------------------------------------------------------
  {
    const s = slug;
    const { maxChars, maxStopWords } = THRESHOLDS.slug;
    if (!s) {
      checks.push({
        id: "slug-quality",
        category: "seo",
        label: "URL slug",
        weight: 0.5,
        aiFixable: true,
        status: "ok",
        message: "No slug set. A short, hyphenated, keyword-focused slug is recommended.",
      });
    } else {
      const parts = s.split("-").filter(Boolean);
      const stopWordCount = parts.filter((p) => SLUG_STOP_WORDS.has(p)).length;
      const tooLong = s.length > maxChars;
      const status =
        !tooLong && stopWordCount <= maxStopWords ? "good" : "ok";
      checks.push({
        id: "slug-quality",
        category: "seo",
        label: "URL slug",
        weight: 0.5,
        aiFixable: true,
        status,
        message:
          status === "good"
            ? "The slug is short and clean."
            : `Tidy the slug: ${tooLong ? `it's ${s.length} chars (keep under ${maxChars})` : ""}${tooLong && stopWordCount > maxStopWords ? "; " : ""}${stopWordCount > maxStopWords ? `it has ${stopWordCount} stop words` : ""}.`,
      });
    }
  }

  // Secondary / search keyphrases ---------------------------------------------
  {
    const secondary = (input.secondaryKeyphrases ?? [])
      .map((k) => k.trim())
      .filter(Boolean);
    if (secondary.length > 0) {
      const missing = secondary.filter(
        (k) => countPhraseOccurrences(parsed.text, k) === 0,
      );
      let status: CheckResult["status"];
      let message: string;
      if (missing.length === 0) {
        status = "good";
        message = `All ${secondary.length} secondary keyphrase(s) appear in the content.`;
      } else if (missing.length < secondary.length) {
        status = "ok";
        message = `Some secondary keyphrases are missing from the body: ${missing.join(", ")}.`;
      } else {
        status = "bad";
        message = `None of your secondary keyphrases appear in the content: ${missing.join(", ")}.`;
      }
      checks.push({
        id: "secondary-keyphrases",
        category: "seo",
        label: "Secondary keyphrases",
        weight: 1,
        aiFixable: true,
        status,
        message,
      });
    }
  }

  // Tags -----------------------------------------------------------------------
  {
    const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
    const { min, max } = THRESHOLDS.tags;
    let status: CheckResult["status"];
    let message: string;
    if (tags.length === 0) {
      status = "ok";
      message = `No tags set. Add ${min}-${max} focused tags to group related posts.`;
    } else if (tags.length > max) {
      status = "ok";
      message = `${tags.length} tags is a lot — too many creates thin tag pages. Keep it to ${min}-${max}.`;
    } else {
      status = "good";
      message = `${tags.length} tag(s) — a focused set.`;
    }
    checks.push({
      id: "tags",
      category: "seo",
      label: "Tags",
      weight: 0.5,
      aiFixable: true,
      status,
      message,
    });
  }

  // Category -------------------------------------------------------------------
  {
    const cats = (input.categories ?? []).map((c) => c.trim()).filter(Boolean);
    const { min, max } = THRESHOLDS.categories;
    let status: CheckResult["status"];
    let message: string;
    if (cats.length < min) {
      status = "bad";
      message = "No category selected. Assign the post to a primary category.";
    } else if (cats.length > max) {
      status = "ok";
      message = `${cats.length} categories — consider narrowing to a primary one plus tags.`;
    } else {
      status = "good";
      message = `Filed under ${cats.join(", ")}.`;
    }
    checks.push({
      id: "category",
      category: "seo",
      label: "Category",
      weight: 0.5,
      aiFixable: true,
      status,
      message,
    });
  }

  return checks;
}

interface PlacementArgs {
  id: string;
  label: string;
  weight: number;
  present: boolean;
  hasKeyphrase: boolean;
  okMsg: string;
  badMsg: string;
}

function pushPlacement(checks: CheckResult[], a: PlacementArgs) {
  checks.push({
    id: a.id,
    category: "seo",
    label: a.label,
    weight: a.weight,
    aiFixable: true,
    status: !a.hasKeyphrase ? "bad" : a.present ? "good" : "bad",
    message: !a.hasKeyphrase
      ? "Set a focus keyphrase to run this check."
      : a.present
        ? a.okMsg
        : a.badMsg,
  });
}

function slugContainsKeyphrase(slug: string, keyphrase: string): boolean {
  const slugWords = new Set(slug.toLowerCase().split(/[-_/]+/).filter(Boolean));
  const kpWords = tokenizeWords(keyphrase);
  if (kpWords.length === 0) return false;
  // Consider it a match if the majority of keyphrase words appear in the slug.
  const hits = kpWords.filter((w) => slugWords.has(w)).length;
  return hits / kpWords.length >= 0.6;
}
