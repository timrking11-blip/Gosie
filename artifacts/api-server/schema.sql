-- Gosie pilot schema. Apply to development/test databases explicitly with
-- apply-schema.js; production schema changes are applied by Replit Publish.
CREATE TABLE IF NOT EXISTS gosie_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  pilot_notice_version TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gosie_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES gosie_users(id) ON DELETE CASCADE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((is_demo AND user_id IS NULL) OR (NOT is_demo AND user_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS gosie_sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES gosie_users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gosie_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES gosie_users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES gosie_profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('saved', 'dismissed', 'rating')),
  rating SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, profile_id, item_id, action),
  CHECK (
    (action = 'rating' AND rating BETWEEN 1 AND 5) OR
    (action IN ('saved', 'dismissed') AND rating IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS gosie_week_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES gosie_users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES gosie_profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  time_label TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  company TEXT,
  domain TEXT NOT NULL DEFAULT 'personal' CHECK (domain IN ('professional', 'personal')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  source_type TEXT NOT NULL DEFAULT 'user-entered' CHECK (source_type IN ('user-entered', 'fictional-demo')),
  carried_from_id TEXT REFERENCES gosie_week_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gosie_auth_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL CHECK (hits >= 0)
);

ALTER TABLE gosie_week_items ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'user-entered'
  CHECK (source_type IN ('user-entered', 'fictional-demo'));

CREATE INDEX IF NOT EXISTS gosie_sessions_user_idx ON gosie_sessions(user_id);
CREATE INDEX IF NOT EXISTS gosie_profiles_user_idx ON gosie_profiles(user_id);
CREATE INDEX IF NOT EXISTS gosie_feedback_profile_idx ON gosie_feedback(user_id, profile_id);
CREATE INDEX IF NOT EXISTS gosie_week_items_profile_day_idx ON gosie_week_items(user_id, profile_id, day);

-- No role means approved-feed access only. Operator authorization is separate
-- from community moderation and can only be bootstrapped by controlled DB admin.
CREATE TABLE IF NOT EXISTS gosie_community_roles (
  user_id TEXT NOT NULL REFERENCES gosie_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('contributor','restaurant-owner','moderator')),
  restaurant_name TEXT,
  PRIMARY KEY (user_id, role),
  CHECK (role <> 'restaurant-owner' OR (restaurant_name IS NOT NULL AND length(trim(restaurant_name)) BETWEEN 1 AND 80))
);
-- Expand existing grants without replacing restaurant-owner identities.
-- Explicit development/test schema application only; never startup DDL.
BEGIN;
ALTER TABLE gosie_community_roles ADD COLUMN IF NOT EXISTS organization_name TEXT;
ALTER TABLE gosie_community_roles DROP CONSTRAINT IF EXISTS gosie_community_roles_role_check;
ALTER TABLE gosie_community_roles ADD CONSTRAINT gosie_community_roles_role_check
  CHECK (role IN ('contributor','restaurant-owner','venue','municipality','nonprofit','moderator'));
ALTER TABLE gosie_community_roles DROP CONSTRAINT IF EXISTS gosie_community_roles_organization_check;
ALTER TABLE gosie_community_roles ADD CONSTRAINT gosie_community_roles_organization_check
  CHECK (role NOT IN ('venue','municipality','nonprofit') OR
    (organization_name IS NOT NULL AND length(trim(organization_name)) BETWEEN 1 AND 80));
COMMIT;
ALTER TABLE gosie_community_roles ADD COLUMN IF NOT EXISTS access_version TEXT NOT NULL DEFAULT 'legacy';
CREATE TABLE IF NOT EXISTS gosie_community_operators (
  user_id TEXT PRIMARY KEY REFERENCES gosie_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS gosie_organization_access_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES gosie_users(id) ON DELETE CASCADE,
  reviewed_by TEXT REFERENCES gosie_users(id) ON DELETE SET NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('restaurant-owner','venue','municipality','nonprofit')),
  public_identity TEXT NOT NULL CHECK (length(trim(public_identity)) BETWEEN 1 AND 80),
  action TEXT NOT NULL CHECK (action IN ('grant','revoke')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS gosie_community_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES gosie_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('event','gem')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  attribution TEXT NOT NULL,
  source_url TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES gosie_users(id) ON DELETE SET NULL,
  CHECK ((kind='gem' AND starts_at IS NULL AND ends_at IS NULL)
    OR (kind='event' AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at>starts_at))
);
CREATE TABLE IF NOT EXISTS gosie_community_comments (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES gosie_community_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES gosie_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attribution TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES gosie_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS gosie_community_items_feed_idx ON gosie_community_items(status, ends_at);
CREATE INDEX IF NOT EXISTS gosie_community_items_owner_idx ON gosie_community_items(user_id);
CREATE INDEX IF NOT EXISTS gosie_community_comments_item_idx ON gosie_community_comments(item_id, status);

-- Curated public-source leads are distinct from user submissions and demo
-- recommendations. Drafts/withdrawals remain private to moderators.
CREATE TABLE IF NOT EXISTS gosie_week_ahead_discoveries (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','withdrawn')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT REFERENCES gosie_users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES gosie_users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES gosie_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  withdrawn_by TEXT REFERENCES gosie_users(id) ON DELETE SET NULL,
  withdrawn_at TIMESTAMPTZ,
  CHECK (jsonb_typeof(payload) = 'object'),
  CHECK ((status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
      OR (status <> 'approved' AND approved_by IS NULL AND approved_at IS NULL)),
  CHECK ((status = 'withdrawn' AND withdrawn_by IS NOT NULL AND withdrawn_at IS NOT NULL)
      OR (status <> 'withdrawn' AND withdrawn_by IS NULL AND withdrawn_at IS NULL))
);
CREATE INDEX IF NOT EXISTS gosie_week_ahead_discoveries_public_idx
  ON gosie_week_ahead_discoveries(status, updated_at DESC);
CREATE TABLE IF NOT EXISTS gosie_week_ahead_discovery_history (
  id BIGSERIAL PRIMARY KEY,
  discovery_id TEXT NOT NULL REFERENCES gosie_week_ahead_discoveries(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES gosie_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created','edited','approved','withdrawn')),
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(snapshot) = 'object')
);
CREATE INDEX IF NOT EXISTS gosie_week_ahead_discovery_history_idx
  ON gosie_week_ahead_discovery_history(discovery_id, created_at DESC);

-- Nullable for pre-existing decisions; never fabricate a historical reason.
-- Only private contributor/moderator responses may expose these fields.
ALTER TABLE gosie_community_items ADD COLUMN IF NOT EXISTS decision_reason TEXT
  CHECK (decision_reason IS NULL OR length(trim(decision_reason)) BETWEEN 10 AND 1000);
ALTER TABLE gosie_community_comments ADD COLUMN IF NOT EXISTS decision_reason TEXT
  CHECK (decision_reason IS NULL OR length(trim(decision_reason)) BETWEEN 10 AND 1000);

-- Attribution is historical, not proof of current organization permission.
-- NULL denotes legacy unknown provenance; new individual posts say individual.
ALTER TABLE gosie_community_items ADD COLUMN IF NOT EXISTS organization_role TEXT;
ALTER TABLE gosie_community_items ADD COLUMN IF NOT EXISTS organization_access_version TEXT;
ALTER TABLE gosie_community_comments ADD COLUMN IF NOT EXISTS organization_role TEXT;
ALTER TABLE gosie_community_comments ADD COLUMN IF NOT EXISTS organization_access_version TEXT;
ALTER TABLE gosie_organization_access_reviews ADD COLUMN IF NOT EXISTS access_version TEXT;

CREATE TABLE IF NOT EXISTS gosie_organization_content_reviews (
  id TEXT PRIMARY KEY,
  revocation_id TEXT NOT NULL REFERENCES gosie_organization_access_reviews(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES gosie_community_items(id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES gosie_community_comments(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('retain','hide','dismiss')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  before_status TEXT NOT NULL CHECK (before_status IN ('pending','approved')),
  before_decision_reason TEXT,
  reviewed_by TEXT REFERENCES gosie_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((item_id IS NULL) <> (comment_id IS NULL)),
  UNIQUE (revocation_id, item_id),
  UNIQUE (revocation_id, comment_id)
);
