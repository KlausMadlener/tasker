-- ══════════════════════════════════════════════════
-- Task Manager – Supabase Schema
-- Führe dieses Script im Supabase SQL Editor aus
-- ══════════════════════════════════════════════════

-- Kategorien (Spalten im Board)
CREATE TABLE IF NOT EXISTS tm_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prioritäten (Zeilen im Board, mit Farbe)
CREATE TABLE IF NOT EXISTS tm_priorities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  level INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#9ca3af',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tm_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  category_id TEXT REFERENCES tm_categories(id) ON DELETE SET NULL,
  priority_id TEXT REFERENCES tm_priorities(id) ON DELETE SET NULL,
  week INT,
  year INT,
  day INT,
  done BOOLEAN DEFAULT false,
  ics_exported BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wochen-Markierungen (Urlaub etc.)
CREATE TABLE IF NOT EXISTS tm_week_markers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  week INT NOT NULL,
  year INT NOT NULL,
  text TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#bbf7d0',
  from_day INT NOT NULL DEFAULT 1,
  to_day INT NOT NULL DEFAULT 7
);

-- Monatsziele
CREATE TABLE IF NOT EXISTS tm_month_goals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  month INT NOT NULL,
  year INT NOT NULL,
  category_id TEXT REFERENCES tm_categories(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  UNIQUE(month, year, category_id)
);

-- Row Level Security aktivieren
ALTER TABLE tm_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_week_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_month_goals ENABLE ROW LEVEL SECURITY;

-- Policies: Anon-Zugriff erlauben (wie beim WealthTracker)
DROP POLICY IF EXISTS "anon_all" ON tm_categories;
DROP POLICY IF EXISTS "anon_all" ON tm_priorities;
DROP POLICY IF EXISTS "anon_all" ON tm_tasks;
DROP POLICY IF EXISTS "anon_all" ON tm_week_markers;
DROP POLICY IF EXISTS "anon_all" ON tm_month_goals;
CREATE POLICY "anon_all" ON tm_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON tm_priorities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON tm_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON tm_week_markers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON tm_month_goals FOR ALL USING (true) WITH CHECK (true);

-- Standard-Kategorien einfügen
INSERT INTO tm_categories (id, name, sort_order) VALUES
  ('c1', 'Privat', 1),
  ('c2', 'Haus', 2),
  ('c3', 'ALEAS', 3)
ON CONFLICT (id) DO NOTHING;

-- Standard-Prioritäten einfügen
INSERT INTO tm_priorities (id, name, level, color) VALUES
  ('p1', 'Hoch', 1, '#ef4444'),
  ('p2', 'Mittel', 2, '#f59e0b'),
  ('p3', 'Niedrig', 3, '#22c55e')
ON CONFLICT (id) DO NOTHING;
