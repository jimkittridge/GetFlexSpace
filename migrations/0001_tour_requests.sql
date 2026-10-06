CREATE TABLE IF NOT EXISTS tour_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  business TEXT NOT NULL,
  cell_phone TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('tour', 'waitlist')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'tour_scheduled', 'closed')),
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sending', 'sent', 'failed')),
  email_attempts INTEGER NOT NULL DEFAULT 0,
  email_attempted_at TEXT,
  email_sent_at TEXT
);
CREATE INDEX IF NOT EXISTS tour_requests_created ON tour_requests(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS tour_requests_status ON tour_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS tour_request_limits (
  bucket_key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
