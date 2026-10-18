CREATE TABLE push_keys (id INTEGER PRIMARY KEY CHECK(id=1), public_key TEXT NOT NULL, private_key TEXT NOT NULL);
CREATE TABLE push_subscription (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  subscription TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE push_delivery (
  subscription_id TEXT NOT NULL REFERENCES push_subscription(id) ON DELETE CASCADE,
  rest_id TEXT NOT NULL REFERENCES rest_period(id) ON DELETE CASCADE,
  extension_ms INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  PRIMARY KEY(subscription_id, rest_id, extension_ms)
);
