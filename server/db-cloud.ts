/**
 * 云端数据库接口 - 支持 PostgreSQL/MySQL
 * 基于 database-adapter 适配器模式
 */

import { createDatabaseAdapter, type DatabaseAdapter } from './database-adapter.js';

// 创建数据库连接
const db: DatabaseAdapter = createDatabaseAdapter();

// PostgreSQL 建表语句
const postgresSchema = `
-- 实体表 (通用)
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
  day INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  duration INTEGER NOT NULL DEFAULT 1,
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

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_allocations_section ON allocations(section_id);
CREATE INDEX IF NOT EXISTS idx_allocations_room ON allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred ON audit_logs(occurred_at DESC);
`;

// MySQL 建表语句
const mysqlSchema = `
CREATE TABLE IF NOT EXISTS entities (
  kind VARCHAR(50) NOT NULL,
  id INT NOT NULL,
  payload JSON NOT NULL,
  PRIMARY KEY (kind, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  day INT NOT NULL,
  slot INT NOT NULL,
  duration INT NOT NULL DEFAULT 1,
  room_id INT NOT NULL,
  week_pattern VARCHAR(50) NOT NULL DEFAULT 'EVERY_WEEK',
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX idx_section (section_id),
  INDEX idx_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedule_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  snapshot JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_ip VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  before_json JSON,
  after_json JSON,
  request_json JSON,
  INDEX idx_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

// 初始化数据库
export async function initializeDatabase() {
  const dbType = process.env.DB_TYPE || 'sqlite';

  try {
    if (dbType === 'postgresql') {
      await db.exec(postgresSchema);
    } else if (dbType === 'mysql') {
      await db.exec(mysqlSchema);
    }
    // SQLite 由原 db.ts 处理
    console.log(`Database initialized: ${dbType}`);
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// 数据查询函数
export async function entities<T>(kind: string): Promise<T[]> {
  const stmt = db.prepare('SELECT payload FROM entities WHERE kind = ? ORDER BY id');
  const rows = await stmt.all(kind);
  return rows.map((r: any) => {
    // PostgreSQL 返回 JSONB 对象，MySQL/SQLite 返回字符串
    const payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
    return payload as T;
  });
}

export async function allocations() {
  const stmt = db.prepare(`
    SELECT id, section_id AS sectionId, day, slot, duration,
           room_id AS roomId, week_pattern AS weekPattern, locked
    FROM allocations ORDER BY id
  `);
  const rows = await stmt.all();
  return rows.map((r: any) => ({
    ...r,
    locked: Boolean(r.locked)
  }));
}

export async function saveEntity(kind: string, payload: any) {
  // 获取新 ID
  const maxIdStmt = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM entities WHERE kind = ?');
  const maxId = await maxIdStmt.get(kind);
  const id = payload.id || Number(maxId.id);

  const value = { ...payload, id };
  const payloadJson = JSON.stringify(value);

  const stmt = db.prepare(`
    INSERT INTO entities (kind, id, payload) VALUES (?, ?, ?)
    ON CONFLICT (kind, id) DO UPDATE SET payload = ?
  `);

  // MySQL 语法略有不同
  const mysqlStmt = db.prepare(`
    INSERT INTO entities (kind, id, payload) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE payload = ?
  `);

  const finalStmt = process.env.DB_TYPE === 'mysql' ? mysqlStmt : stmt;
  await finalStmt.run(kind, id, payloadJson, payloadJson);

  return value;
}

export async function deleteEntity(kind: string, id: number) {
  const stmt = db.prepare('DELETE FROM entities WHERE kind = ? AND id = ?');
  return await stmt.run(kind, id);
}

export async function writeAudit(entry: {
  actorIp: string;
  action: string;
  resource: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  request?: unknown;
}) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (occurred_at, actor_ip, action, resource, summary, before_json, after_json, request_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await stmt.run(
    new Date().toISOString(),
    entry.actorIp,
    entry.action,
    entry.resource,
    entry.summary,
    entry.before === undefined ? null : JSON.stringify(entry.before),
    entry.after === undefined ? null : JSON.stringify(entry.after),
    entry.request === undefined ? null : JSON.stringify(entry.request)
  );
}

export async function readAudits(limit: number = 200) {
  const stmt = db.prepare(`
    SELECT id, occurred_at AS occurredAt, actor_ip AS actorIp, action, resource, summary,
           before_json AS beforeJson, after_json AS afterJson, request_json AS requestJson
    FROM audit_logs ORDER BY id DESC LIMIT ?
  `);
  return await stmt.all(Math.min(Math.max(limit, 1), 1000));
}

export async function readAudit(id: number) {
  const stmt = db.prepare(`
    SELECT id, occurred_at AS occurredAt, actor_ip AS actorIp, action, resource, summary,
           before_json AS beforeJson, after_json AS afterJson
    FROM audit_logs WHERE id = ?
  `);
  return await stmt.get(id);
}

export async function restoreSnapshot(snapshot: any) {
  const kinds = [
    { key: 'teachers', kind: 'teacher' },
    { key: 'students', kind: 'student' },
    { key: 'rooms', kind: 'room' },
    { key: 'courses', kind: 'course' },
    { key: 'adminClasses', kind: 'adminClass' },
    { key: 'concurrentBlocks', kind: 'concurrentBlock' },
    { key: 'sections', kind: 'section' }
  ];

  try {
    // 清空现有数据
    for (const { kind } of kinds) {
      await db.prepare('DELETE FROM entities WHERE kind = ?').run(kind);
    }
    await db.exec('DELETE FROM allocations');

    // 恢复快照数据
    for (const { key, kind } of kinds) {
      const insertStmt = db.prepare('INSERT INTO entities (kind, id, payload) VALUES (?, ?, ?)');
      for (const row of snapshot[key] || []) {
        await insertStmt.run(kind, row.id, JSON.stringify(row));
      }
    }

    // 恢复排课分配
    const insertAlloc = db.prepare(`
      INSERT INTO allocations (id, section_id, day, slot, duration, room_id, week_pattern, locked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of snapshot.allocations || []) {
      await insertAlloc.run(
        a.id, a.sectionId, a.day, a.slot, a.duration,
        a.roomId, a.weekPattern || 'EVERY_WEEK', a.locked ? 1 : 0
      );
    }
  } catch (error) {
    console.error('Restore snapshot error:', error);
    throw error;
  }
}

export async function backfillAuditSnapshots(snapshot: unknown) {
  const json = JSON.stringify(snapshot);
  const stmt = db.prepare('SELECT id, before_json AS beforeJson FROM audit_logs');
  const rows = await stmt.all();

  for (const row of rows as any[]) {
    try {
      const value = JSON.parse(row.beforeJson || 'null');
      if (!value?.teachers || !value?.allocations) {
        await db.prepare('UPDATE audit_logs SET before_json = ? WHERE id = ?')
          .run(json, row.id);
      }
    } catch {
      await db.prepare('UPDATE audit_logs SET before_json = ? WHERE id = ?')
        .run(json, row.id);
    }
  }
}

export { db };
