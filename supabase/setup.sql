-- Supabase 排课系统数据库表结构

-- 实体表（通用）
CREATE TABLE IF NOT EXISTS entities (
  kind TEXT NOT NULL,
  id INTEGER NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (kind, id)
);

-- 排课分配表
CREATE TABLE IF NOT EXISTS allocations (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 5),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 11),
  duration INTEGER NOT NULL DEFAULT 1 CHECK (duration >= 1),
  room_id INTEGER NOT NULL,
  week_pattern TEXT NOT NULL DEFAULT 'EVERY_WEEK',
  locked BOOLEAN NOT NULL DEFAULT FALSE
);

-- 课表版本表
CREATE TABLE IF NOT EXISTS schedule_versions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_ip TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  request_json JSONB
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_allocations_section ON allocations(section_id);
CREATE INDEX IF NOT EXISTS idx_allocations_room ON allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_allocations_day_slot ON allocations(day, slot);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred ON audit_logs(occurred_at DESC);

-- 启用 Row Level Security
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（简化版，生产环境需要更严格的权限）
CREATE POLICY "All access for entities" ON entities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "All access for allocations" ON allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "All access for schedule_versions" ON schedule_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "All access for audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
