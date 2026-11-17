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

-- Roles are operator-assigned; there is deliberately no HTTP self-enrollment
-- or role-management endpoint. No role means approved-feed access only.
CREATE TABLE IF NOT EXISTS gosie_community_roles (
  user_id TEXT NOT NULL REFERENCES gosie_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('contributor','restaurant-owner','moderator')),
  restaurant_name TEXT,
  PRIMARY KEY (user_id, role),
  CHECK (role <> 'restaurant-owner' OR (restaurant_name IS NOT NULL AND length(trim(restaurant_name)) BETWEEN 1 AND 80))
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
