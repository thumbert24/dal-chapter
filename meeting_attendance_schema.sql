-- ============================================================
-- ADDENDUM: Meeting Attendance (Executive Board + Chapter Meetings)
-- Run this in Supabase → SQL Editor after your main schema.sql
-- ============================================================
-- Note: your original schema.sql already created a `meeting_attendance`
-- table. This addendum is safe to run even if that table exists —
-- it only adds what's missing.

-- Ensure meeting_attendance table exists with the right shape
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  meeting_date  DATE NOT NULL,
  meeting_type  TEXT NOT NULL DEFAULT 'regular', -- 'regular' | 'special' | 'emergency' | 'executive' | 'retreat'
  present       BOOLEAN NOT NULL DEFAULT FALSE,
  excused       BOOLEAN NOT NULL DEFAULT FALSE,
  late          BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, meeting_date, meeting_type)
);

CREATE INDEX IF NOT EXISTS idx_mtg_att_member ON meeting_attendance (member_id);
CREATE INDEX IF NOT EXISTS idx_mtg_att_date   ON meeting_attendance (meeting_date);
CREATE INDEX IF NOT EXISTS idx_mtg_att_type   ON meeting_attendance (meeting_type);

-- A catalog of meetings (so you can create a meeting once, then mark attendance for it)
CREATE TABLE IF NOT EXISTS meetings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_date  DATE NOT NULL,
  meeting_type  TEXT NOT NULL DEFAULT 'regular', -- 'regular' | 'executive' | 'special' | 'emergency' | 'retreat'
  title         TEXT,                 -- optional label e.g. "June Chapter Meeting"
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_date, meeting_type)
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings (meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings (meeting_type);

-- RLS
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_meeting_attendance"        ON meeting_attendance;
DROP POLICY IF EXISTS "officer_read_meeting_attendance"     ON meeting_attendance;
DROP POLICY IF EXISTS "member_read_own_meeting_attendance"  ON meeting_attendance;

CREATE POLICY "auth_all_meeting_attendance" ON meeting_attendance
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all_meetings" ON meetings
  FOR ALL USING (auth.role() = 'authenticated');

-- Convenience view: attendance rate per member, split by meeting type
CREATE OR REPLACE VIEW v_attendance_summary AS
SELECT
  m.id                                AS member_id,
  m.first_name || ' ' || m.last_name  AS full_name,
  ma.meeting_type,
  COUNT(*)                            AS total_meetings,
  COUNT(*) FILTER (WHERE ma.present)  AS attended,
  COUNT(*) FILTER (WHERE ma.excused)  AS excused,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ma.present) / NULLIF(COUNT(*), 0), 1
  )                                   AS attendance_pct
FROM meeting_attendance ma
JOIN members m ON m.id = ma.member_id
GROUP BY m.id, m.first_name, m.last_name, ma.meeting_type;
