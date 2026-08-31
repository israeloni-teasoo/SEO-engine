-- SEO Engine — multi-user schema (PostgreSQL / Neon).
-- Apply with: npm run db:setup   (see scripts/db-setup.mjs)

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text UNIQUE NOT NULL,
  name           text,
  password_hash  text,                    -- null for SSO-only accounts
  role           text NOT NULL DEFAULT 'author'
                   CHECK (role IN ('admin', 'editor', 'author')),
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'disabled')),
  image          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Single-row table for org-wide settings (shared WordPress connection, etc.).
CREATE TABLE IF NOT EXISTS app_settings (
  id                          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  wordpress_url               text,
  wordpress_username          text,
  wordpress_app_password_enc  text,        -- AES-256-GCM encrypted
  linkedin_org_id             text,
  site_domain                 text,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Per-user LinkedIn OAuth tokens (encrypted at rest).
CREATE TABLE IF NOT EXISTS linkedin_connections (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token_enc  text NOT NULL,
  expires_at        timestamptz,
  li_sub            text,
  li_name           text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Articles with an approval workflow.
CREATE TABLE IF NOT EXISTS articles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 text NOT NULL DEFAULT '',
  content               text NOT NULL DEFAULT '',
  meta_description      text NOT NULL DEFAULT '',
  focus_keyphrase       text NOT NULL DEFAULT '',
  secondary_keyphrases  text[] NOT NULL DEFAULT '{}',
  slug                  text NOT NULL DEFAULT '',
  tags                  text[] NOT NULL DEFAULT '{}',
  categories            text[] NOT NULL DEFAULT '{}',
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'in_review', 'published')),
  overall_score         int,
  wp_post_id            int,
  wp_link               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_author_idx ON articles (author_id);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles (status);
