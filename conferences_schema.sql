-- ============================================================
-- ADDENDUM: Conference Attendance Tracking
-- Run this in Supabase → SQL Editor after your main schema.sql
-- ============================================================

-- Conferences catalog (e.g. "2024 Regional Convention", "2024 General Convention")
CREATE TABLE IF NOT EXISTS conferences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  conference_type TEXT,              -- 'regional', 'general', 'leadership', 'other'
  year          INT NOT NULL,
  location      TEXT,
  start_date    DATE,
  end_date      DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conferences_year ON conferences (year);

-- Attendance junction — who attended which conference
CREATE TABLE IF NOT EXISTS conference_attendance (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  conference_id  UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  role           TEXT,               -- 'delegate', 'attendee', 'voting delegate', 'presenter', etc.
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, conference_id)
);

CREATE INDEX IF NOT EXISTS idx_conf_att_member     ON conference_attendance (member_id);
CREATE INDEX IF NOT EXISTS idx_conf_att_conference  ON conference_attendance (conference_id);

-- RLS
ALTER TABLE conferences            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_attendance  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_conferences" ON conferences
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all_conf_attendance" ON conference_attendance
  FOR ALL USING (auth.role() = 'authenticated');

-- Convenience view: attendance with names joined
CREATE OR REPLACE VIEW v_conference_attendance AS
SELECT
  ca.id,
  ca.member_id,
  m.first_name || ' ' || m.last_name AS brother_name,
  m.email_primary,
  ca.conference_id,
  c.name        AS conference_name,
  c.conference_type,
  c.year,
  c.location,
  ca.role,
  ca.notes
FROM conference_attendance ca
JOIN members     m ON m.id = ca.member_id
JOIN conferences c ON c.id = ca.conference_id
ORDER BY c.year DESC, c.name;
