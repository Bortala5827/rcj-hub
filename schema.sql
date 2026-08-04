-- rcj-hub 友链 D1 表结构
-- 在 Cloudflare 后台 D1 控制台执行，或用：
--   wrangler d1 execute rcj-hub-links --file=./schema.sql --remote
CREATE TABLE IF NOT EXISTS links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  desc        TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending',  -- pending | approved
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_status   ON links(status);
CREATE INDEX IF NOT EXISTS idx_links_created  ON links(created_at);
