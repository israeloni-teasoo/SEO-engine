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
  createdAt: Date;
  updatedAt: Date;
}

/** Article joined with its author's display name (for list views). */
export interface ArticleWithAuthor extends ArticleRow {
  authorName: string | null;
  authorEmail: string;
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
  published?: { wpPostId: number; wpLink: string },
): Promise<void> {
  if (published) {
    await db()`
      UPDATE articles SET status = ${status}, wp_post_id = ${published.wpPostId},
        wp_link = ${published.wpLink}, updated_at = now()
      WHERE id = ${id}`;
  } else {
    await db()`UPDATE articles SET status = ${status}, updated_at = now() WHERE id = ${id}`;
  }
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
    SELECT a.*, u.name AS author_name, u.email AS author_email
    FROM articles a
    JOIN users u ON u.id = a.author_id
    WHERE ${opts.canSeeAll ? sql`true` : sql`a.author_id = ${opts.viewerId}`}
      ${opts.status ? sql`AND a.status = ${opts.status}` : sql``}
    ORDER BY a.updated_at DESC`;
}
