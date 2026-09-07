import { db } from "./client";

export type ArticleStatus = "draft" | "in_review" | "published";

export interface ArticleRow {
  id: string;
  authorId: string;
  title: string;
  content: string;
  metaDescription: string;
  focusKeyphrase: string;
  secondaryKeyphrases: string[];
  slug: string;
  tags: string[];
  categories: string[];
  status: ArticleStatus;
  coverImage: string;
  overallScore: number | null;
  wpPostId: number | null;
  wpLink: string | null;
  publishedBy: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Article joined with author + publisher display names (for list views). */
export interface ArticleWithAuthor extends ArticleRow {
  authorName: string | null;
  authorEmail: string;
  publisherName: string | null;
}

export interface ArticleInput {
  title: string;
  content: string;
  metaDescription: string;
  focusKeyphrase: string;
  secondaryKeyphrases: string[];
  slug: string;
  tags: string[];
  categories: string[];
  coverImage?: string;
  overallScore?: number | null;
}

export async function createArticle(
  authorId: string,
  input: ArticleInput,
): Promise<ArticleRow> {
  const rows = await db()<ArticleRow[]>`
    INSERT INTO articles
      (author_id, title, content, meta_description, focus_keyphrase,
       secondary_keyphrases, slug, tags, categories, cover_image, overall_score)
    VALUES
      (${authorId}, ${input.title}, ${input.content}, ${input.metaDescription},
       ${input.focusKeyphrase}, ${input.secondaryKeyphrases}, ${input.slug},
       ${input.tags}, ${input.categories}, ${input.coverImage ?? ""}, ${input.overallScore ?? null})
    RETURNING *`;
  return rows[0];
}

export async function updateArticle(
  id: string,
  input: ArticleInput,
): Promise<ArticleRow> {
  const rows = await db()<ArticleRow[]>`
    UPDATE articles SET
      title = ${input.title},
      content = ${input.content},
      meta_description = ${input.metaDescription},
      focus_keyphrase = ${input.focusKeyphrase},
      secondary_keyphrases = ${input.secondaryKeyphrases},
      slug = ${input.slug},
      tags = ${input.tags},
      categories = ${input.categories},
      cover_image = ${input.coverImage ?? ""},
      overall_score = ${input.overallScore ?? null},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`;
  return rows[0];
}

export async function setArticleStatus(
  id: string,
  status: ArticleStatus,
): Promise<void> {
  await db()`UPDATE articles SET status = ${status}, updated_at = now() WHERE id = ${id}`;
}

/** Mark an article published to WordPress, recording who published it. */
export async function markArticlePublished(
  id: string,
  input: { wpPostId: number; wpLink: string; publishedBy: string | null },
): Promise<void> {
  await db()`
    UPDATE articles SET status = 'published', wp_post_id = ${input.wpPostId},
      wp_link = ${input.wpLink}, published_by = ${input.publishedBy},
      published_at = now(), updated_at = now()
    WHERE id = ${id}`;
}

/** After a WordPress delete, detach the WP id and revert to draft. */
export async function detachWpPost(id: string): Promise<void> {
  await db()`
    UPDATE articles SET wp_post_id = NULL, wp_link = NULL, status = 'draft', updated_at = now()
    WHERE id = ${id}`;
}

/** Find the saved article linked to a WordPress post id, if any. */
export async function getArticleByWpPostId(wpPostId: number): Promise<ArticleRow | null> {
  const rows = await db()<ArticleRow[]>`SELECT * FROM articles WHERE wp_post_id = ${wpPostId} LIMIT 1`;
  return rows[0] ?? null;
}

/** Articles that have been pushed to WordPress (for the management view). */
export async function listPublishedArticles(): Promise<ArticleWithAuthor[]> {
  const sql = db();
  return sql<ArticleWithAuthor[]>`
    SELECT a.*, au.name AS author_name, au.email AS author_email, pu.name AS publisher_name
    FROM articles a
    JOIN users au ON au.id = a.author_id
    LEFT JOIN users pu ON pu.id = a.published_by
    WHERE a.wp_post_id IS NOT NULL
    ORDER BY a.published_at DESC NULLS LAST, a.updated_at DESC`;
}

export async function getArticle(id: string): Promise<ArticleRow | null> {
  const rows = await db()<ArticleRow[]>`SELECT * FROM articles WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function deleteArticle(id: string): Promise<void> {
  await db()`DELETE FROM articles WHERE id = ${id}`;
}

/**
 * List articles visible to a user. Editors/admins see everything; authors see
 * only their own. Optionally filter by status (e.g. the review queue).
 */
export async function listArticles(opts: {
  viewerId: string;
  canSeeAll: boolean;
  status?: ArticleStatus;
}): Promise<ArticleWithAuthor[]> {
  const sql = db();
  return sql<ArticleWithAuthor[]>`
    SELECT a.*, u.name AS author_name, u.email AS author_email, pu.name AS publisher_name
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN users pu ON pu.id = a.published_by
    WHERE ${opts.canSeeAll ? sql`true` : sql`a.author_id = ${opts.viewerId}`}
      ${opts.status ? sql`AND a.status = ${opts.status}` : sql``}
    ORDER BY a.updated_at DESC`;
}
