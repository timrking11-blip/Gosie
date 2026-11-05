CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  csrf TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX profiles_user_idx ON profiles (user_id);
CREATE TABLE feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL,
  rating INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX feedback_user_profile_idx ON feedback (user_id, profile_id);
