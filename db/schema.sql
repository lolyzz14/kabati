-- Kabati database. Safe to run many times: every statement only creates what is missing.

CREATE TABLE IF NOT EXISTS shops (
  id            SERIAL PRIMARY KEY,
  ig_user_id    TEXT UNIQUE,
  username      TEXT UNIQUE NOT NULL,
  name          TEXT,
  code          TEXT,                       -- 2-3 letters used in item codes, e.g. MQ
  next_number   INTEGER NOT NULL DEFAULT 1, -- next Kabati item number
  access_token  TEXT,
  token_expires TIMESTAMPTZ,
  account_type  TEXT,
  followers     INTEGER,
  photo_url     TEXT,
  ig_since      TEXT,
  location      TEXT,                       -- full address, free text
  area          TEXT,                       -- short area for filtering, e.g. "Sawa Mall"
  hours         TEXT,
  delivery      JSONB NOT NULL DEFAULT '[]', -- [[title, details], ...]
  order_ig      BOOLEAN NOT NULL DEFAULT TRUE,
  order_wa      BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp      TEXT,
  has_stall     BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | active | paused
  is_sample     BOOLEAN NOT NULL DEFAULT FALSE,
  onboarded     BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  sync_cursor   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id            SERIAL PRIMARY KEY,
  shop_id       INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  ig_media_id   TEXT,
  piece_index   INTEGER NOT NULL DEFAULT 0,
  code          TEXT NOT NULL,
  seller_code   TEXT,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'other', -- dress | top | bottom | outer | shoes | bag | home | other
  subtype       TEXT,
  gender        TEXT NOT NULL DEFAULT 'w',     -- w | m | u
  size_value    TEXT,                          -- normalised: "10", "L", or NULL for one-size
  size_label    TEXT,
  price         INTEGER,
  condition     TEXT,
  fabric        TEXT,
  measurements  JSONB NOT NULL DEFAULT '[]',
  photos        JSONB NOT NULL DEFAULT '[]',
  hashes        JSONB NOT NULL DEFAULT '[]',
  is_video      BOOLEAN NOT NULL DEFAULT FALSE,
  permalink     TEXT,
  caption       TEXT,
  posted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'live',  -- live | sold | hidden | check
  quality       TEXT,                          -- ok | low
  sold_at       TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ig_media_id, piece_index)
);
CREATE INDEX IF NOT EXISTS listings_feed ON listings (status, posted_at DESC);
CREATE INDEX IF NOT EXISTS listings_shop ON listings (shop_id, status);

CREATE TABLE IF NOT EXISTS checks (
  id         SERIAL PRIMARY KEY,
  shop_id    INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,          -- details | same | price
  question   TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reactions (
  buyer      TEXT NOT NULL,          -- device id + person, e.g. "d_ab12:me"
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,          -- want | size | price | missed
  buyer_size TEXT,
  offer      INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer, listing_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id         SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  shop_id    INTEGER REFERENCES shops(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS links (
  code        TEXT PRIMARY KEY,
  shop_id     INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  listing_ids JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at  TIMESTAMPTZ,
  claimed_by  TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  link_code  TEXT REFERENCES links(code),
  shop_id    INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  buyer      TEXT NOT NULL,
  person     TEXT,
  items      JSONB NOT NULL,
  total      INTEGER NOT NULL DEFAULT 0,
  method     TEXT,
  status     TEXT NOT NULL DEFAULT 'paid', -- paid | packing | onway | ready | delivered | done | issue
  details    JSONB,
  log        JSONB NOT NULL DEFAULT '{}',
  issue      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_buyer ON orders (buyer);

CREATE TABLE IF NOT EXISTS reports (
  id         SERIAL PRIMARY KEY,
  shop_id    INTEGER REFERENCES shops(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB
);

CREATE TABLE IF NOT EXISTS seen_media (
  ig_media_id TEXT PRIMARY KEY,
  shop_id     INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  caption     TEXT,
  result      TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
