var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/database-adapter.ts
function createDatabaseAdapter() {
  const dbType = process.env.DB_TYPE || "sqlite";
  if (dbType === "postgresql") {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL \u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E");
    }
    return new PostgreSQLAdapter(process.env.DATABASE_URL);
  }
  if (dbType === "mysql") {
    return new MySQLAdapter({
      host: process.env.MYSQL_HOST || "localhost",
      port: parseInt(process.env.MYSQL_PORT || "3306"),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "scheduler"
    });
  }
  const { DatabaseSync } = require("node:sqlite");
  const path = require("path");
  const fs = require("node:fs");
  const dataDir = path.resolve("data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db2 = new DatabaseSync(path.join(dataDir, "scheduler.db"));
  return new SQLiteAdapter(db2);
}
var SQLiteAdapter, PostgreSQLAdapter, MySQLAdapter;
var init_database_adapter = __esm({
  "server/database-adapter.ts"() {
    SQLiteAdapter = class {
      constructor(db2) {
        this.db = db2;
      }
      db;
      prepare(sql) {
        const stmt = this.db.prepare(sql);
        return {
          run: (...params) => {
            const result = stmt.run(...params);
            return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
          },
          get: (...params) => stmt.get(...params),
          all: (...params) => stmt.all(...params)
        };
      }
      exec(sql) {
        this.db.exec(sql);
      }
      close() {
      }
    };
    PostgreSQLAdapter = class {
      constructor(connectionString) {
        this.connectionString = connectionString;
      }
      connectionString;
      client = null;
      async getClient() {
        if (!this.client) {
          const pg = await import("pg");
          this.client = new pg.Pool({ connectionString: this.connectionString });
        }
        return this.client;
      }
      prepare(sql) {
        return {
          run: async (...params) => {
            const client = await this.getClient();
            const pgSql = this.convertPlaceholders(sql, params.length);
            const result = await client.query(pgSql, params);
            return {
              changes: result.rowCount || 0,
              lastInsertRowid: 0
            };
          },
          get: async (...params) => {
            const client = await this.getClient();
            const pgSql = this.convertPlaceholders(sql, params.length);
            const result = await client.query(pgSql, params);
            return result.rows[0];
          },
          all: async (...params) => {
            const client = await this.getClient();
            const pgSql = this.convertPlaceholders(sql, params.length);
            const result = await client.query(pgSql, params);
            return result.rows;
          }
        };
      }
      async exec(sql) {
        const client = await this.getClient();
        const statements = sql.split(";").filter((s) => s.trim());
        for (const stmt of statements) {
          if (stmt.trim()) await client.query(stmt);
        }
      }
      async close() {
        if (this.client) {
          await this.client.end();
          this.client = null;
        }
      }
      convertPlaceholders(sql, paramCount) {
        let index = 0;
        return sql.replace(/\?/g, () => `$${++index}`);
      }
    };
    MySQLAdapter = class {
      constructor(config) {
        this.config = config;
      }
      config;
      pool = null;
      async getPool() {
        if (!this.pool) {
          try {
            const mysql = await import("mysql2/promise");
            this.pool = mysql.createPool(this.config);
          } catch (error) {
            throw new Error("mysql2 package not installed. Run: npm install mysql2");
          }
        }
        return this.pool;
      }
      prepare(sql) {
        return {
          run: async (...params) => {
            const pool = await this.getPool();
            const [result] = await pool.execute(sql, params);
            return {
              changes: result.affectedRows,
              lastInsertRowid: result.insertId
            };
          },
          get: async (...params) => {
            const pool = await this.getPool();
            const [rows] = await pool.execute(sql, params);
            return rows[0];
          },
          all: async (...params) => {
            const pool = await this.getPool();
            const [rows] = await pool.execute(sql, params);
            return rows;
          }
        };
      }
      async exec(sql) {
        const pool = await this.getPool();
        const statements = sql.split(";").filter((s) => s.trim());
        for (const stmt of statements) {
          if (stmt.trim()) await pool.execute(stmt);
        }
      }
      async close() {
        if (this.pool) {
          await this.pool.end();
          this.pool = null;
        }
      }
    };
  }
});

// server/db-cloud.ts
var db_cloud_exports = {};
__export(db_cloud_exports, {
  allocations: () => allocations,
  backfillAuditSnapshots: () => backfillAuditSnapshots,
  db: () => db,
  deleteEntity: () => deleteEntity,
  entities: () => entities,
  initializeDatabase: () => initializeDatabase,
  readAudit: () => readAudit,
  readAudits: () => readAudits,
  restoreSnapshot: () => restoreSnapshot,
  saveEntity: () => saveEntity,
  writeAudit: () => writeAudit
});
async function initializeDatabase() {
  const dbType = process.env.DB_TYPE || "sqlite";
  try {
    if (dbType === "postgresql") {
      await db.exec(postgresSchema);
    } else if (dbType === "mysql") {
      await db.exec(mysqlSchema);
    }
    console.log(`Database initialized: ${dbType}`);
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}
async function entities(kind) {
  const stmt = db.prepare("SELECT payload FROM entities WHERE kind = ? ORDER BY id");
  const rows = await stmt.all(kind);
  return rows.map((r) => {
    const payload = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
    return payload;
  });
}
async function allocations() {
  const stmt = db.prepare(`
    SELECT id, section_id AS sectionId, day, slot, duration,
           room_id AS roomId, week_pattern AS weekPattern, locked
    FROM allocations ORDER BY id
  `);
  const rows = await stmt.all();
  return rows.map((r) => ({
    ...r,
    locked: Boolean(r.locked)
  }));
}
async function saveEntity(kind, payload) {
  const maxIdStmt = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM entities WHERE kind = ?");
  const maxId = await maxIdStmt.get(kind);
  const id = payload.id || Number(maxId.id);
  const value = { ...payload, id };
  const payloadJson = JSON.stringify(value);
  const stmt = db.prepare(`
    INSERT INTO entities (kind, id, payload) VALUES (?, ?, ?)
    ON CONFLICT (kind, id) DO UPDATE SET payload = ?
  `);
  const mysqlStmt = db.prepare(`
    INSERT INTO entities (kind, id, payload) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE payload = ?
  `);
  const finalStmt = process.env.DB_TYPE === "mysql" ? mysqlStmt : stmt;
  await finalStmt.run(kind, id, payloadJson, payloadJson);
  return value;
}
async function deleteEntity(kind, id) {
  const stmt = db.prepare("DELETE FROM entities WHERE kind = ? AND id = ?");
  return await stmt.run(kind, id);
}
async function writeAudit(entry) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (occurred_at, actor_ip, action, resource, summary, before_json, after_json, request_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await stmt.run(
    (/* @__PURE__ */ new Date()).toISOString(),
    entry.actorIp,
    entry.action,
    entry.resource,
    entry.summary,
    entry.before === void 0 ? null : JSON.stringify(entry.before),
    entry.after === void 0 ? null : JSON.stringify(entry.after),
    entry.request === void 0 ? null : JSON.stringify(entry.request)
  );
}
async function readAudits(limit = 200) {
  const stmt = db.prepare(`
    SELECT id, occurred_at AS occurredAt, actor_ip AS actorIp, action, resource, summary,
           before_json AS beforeJson, after_json AS afterJson, request_json AS requestJson
    FROM audit_logs ORDER BY id DESC LIMIT ?
  `);
  return await stmt.all(Math.min(Math.max(limit, 1), 1e3));
}
async function readAudit(id) {
  const stmt = db.prepare(`
    SELECT id, occurred_at AS occurredAt, actor_ip AS actorIp, action, resource, summary,
           before_json AS beforeJson, after_json AS afterJson
    FROM audit_logs WHERE id = ?
  `);
  return await stmt.get(id);
}
async function restoreSnapshot(snapshot) {
  const kinds = [
    { key: "teachers", kind: "teacher" },
    { key: "students", kind: "student" },
    { key: "rooms", kind: "room" },
    { key: "courses", kind: "course" },
    { key: "adminClasses", kind: "adminClass" },
    { key: "concurrentBlocks", kind: "concurrentBlock" },
    { key: "sections", kind: "section" }
  ];
  try {
    for (const { kind } of kinds) {
      await db.prepare("DELETE FROM entities WHERE kind = ?").run(kind);
    }
    await db.exec("DELETE FROM allocations");
    for (const { key, kind } of kinds) {
      const insertStmt = db.prepare("INSERT INTO entities (kind, id, payload) VALUES (?, ?, ?)");
      for (const row of snapshot[key] || []) {
        await insertStmt.run(kind, row.id, JSON.stringify(row));
      }
    }
    const insertAlloc = db.prepare(`
      INSERT INTO allocations (id, section_id, day, slot, duration, room_id, week_pattern, locked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of snapshot.allocations || []) {
      await insertAlloc.run(
        a.id,
        a.sectionId,
        a.day,
        a.slot,
        a.duration,
        a.roomId,
        a.weekPattern || "EVERY_WEEK",
        a.locked ? 1 : 0
      );
    }
  } catch (error) {
    console.error("Restore snapshot error:", error);
    throw error;
  }
}
async function backfillAuditSnapshots(snapshot) {
  const json = JSON.stringify(snapshot);
  const stmt = db.prepare("SELECT id, before_json AS beforeJson FROM audit_logs");
  const rows = await stmt.all();
  for (const row of rows) {
    try {
      const value = JSON.parse(row.beforeJson || "null");
      if (!value?.teachers || !value?.allocations) {
        await db.prepare("UPDATE audit_logs SET before_json = ? WHERE id = ?").run(json, row.id);
      }
    } catch {
      await db.prepare("UPDATE audit_logs SET before_json = ? WHERE id = ?").run(json, row.id);
    }
  }
}
var db, postgresSchema, mysqlSchema;
var init_db_cloud = __esm({
  "server/db-cloud.ts"() {
    init_database_adapter();
    db = createDatabaseAdapter();
    postgresSchema = `
-- \u5B9E\u4F53\u8868 (\u901A\u7528)
CREATE TABLE IF NOT EXISTS entities (
  kind TEXT NOT NULL,
  id INTEGER NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (kind, id)
);

-- \u6392\u8BFE\u5206\u914D\u8868
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

-- \u8BFE\u8868\u7248\u672C\u8868
CREATE TABLE IF NOT EXISTS schedule_versions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- \u5BA1\u8BA1\u65E5\u5FD7\u8868
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

-- \u7D22\u5F15\u4F18\u5316
CREATE INDEX IF NOT EXISTS idx_allocations_section ON allocations(section_id);
CREATE INDEX IF NOT EXISTS idx_allocations_room ON allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred ON audit_logs(occurred_at DESC);
`;
    mysqlSchema = `
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
  }
});

// netlify/functions/api.ts
var api_exports = {};
__export(api_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(api_exports);

// server/api-handler.ts
init_db_cloud();

// server/domain.ts
var activeWeeks = (pattern) => {
  const weeks = Array.from({ length: 20 }, (_, i) => i + 1);
  if (pattern === "ODD_WEEK") return weeks.filter((w) => w % 2 === 1);
  if (pattern === "EVEN_WEEK") return weeks.filter((w) => w % 2 === 0);
  if (pattern === "EVERY_3_WEEKS") return weeks.filter((w) => (w - 1) % 3 === 0);
  if (pattern === "MONTHLY") return weeks.filter((w) => (w - 1) % 4 === 0);
  return weeks;
};
function patternsOverlap(a, b) {
  const right = new Set(activeWeeks(b));
  return activeWeeks(a).some((w) => right.has(w));
}
function overlap(a, b) {
  return a.day === b.day && a.slot < b.slot + b.duration && b.slot < a.slot + a.duration && patternsOverlap(a.weekPattern, b.weekPattern);
}
function validateAllocations(allocations2, sections, rooms, teachers) {
  const conflicts = [];
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  for (const a of allocations2) {
    const section = sectionById.get(a.sectionId);
    const room = roomById.get(a.roomId);
    if (section && room && section.studentIds.length > room.capacity) conflicts.push({ type: "CAPACITY", message: `${section.name}\uFF08${section.studentIds.length}\u4EBA\uFF09\u8D85\u8FC7${room.name}\u5BB9\u91CF\uFF08${room.capacity}\u4EBA\uFF09`, allocationIds: [a.id] });
  }
  for (let i = 0; i < allocations2.length; i++) for (let j = i + 1; j < allocations2.length; j++) {
    const a = allocations2[i], b = allocations2[j];
    if (!overlap(a, b)) continue;
    const sa = sectionById.get(a.sectionId), sb = sectionById.get(b.sectionId);
    if (sa.teacherId === sb.teacherId) conflicts.push({ type: "TEACHER", message: `${teacherById.get(sa.teacherId)?.name}\u540C\u65F6\u627F\u62C5\u201C${sa.name}\u201D\u548C\u201C${sb.name}\u201D`, allocationIds: [a.id, b.id] });
    if (a.roomId === b.roomId) conflicts.push({ type: "ROOM", message: `${roomById.get(a.roomId)?.name}\u88AB\u4E24\u4E2A\u6559\u5B66\u73ED\u540C\u65F6\u4F7F\u7528`, allocationIds: [a.id, b.id] });
    const shared = sa.studentIds.filter((id) => sb.studentIds.includes(id));
    if (shared.length) conflicts.push({ type: "STUDENT", message: `${shared.length}\u540D\u5B66\u751F\u7684\u201C${sa.name}\u201D\u4E0E\u201C${sb.name}\u201D\u51B2\u7A81`, allocationIds: [a.id, b.id] });
  }
  return conflicts;
}
function validateConcurrentBlocks(allocations2, sections, blocks) {
  const conflicts = [];
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  for (const block of blocks) {
    const keysBySection = block.sectionIds.map((id) => new Set(allocations2.filter((a) => a.sectionId === id).map((a) => `${a.day}:${a.slot}:${a.duration}:${a.weekPattern || "EVERY_WEEK"}`)));
    const shared = keysBySection.length ? [...keysBySection[0]].filter((k) => keysBySection.every((set) => set.has(k))) : [];
    if (shared.length < (block.requiredOccurrences || 1)) {
      const names = block.sectionIds.map((id) => sectionById.get(id)?.name).filter(Boolean).join("\u3001");
      conflicts.push({ type: "CONCURRENT", message: `\u540C\u6B65\u5F00\u8BFE\u7EC4\u201C${block.name}\u201D\u5C1A\u672A\u540C\u6B65\uFF1A${names}`, allocationIds: allocations2.filter((a) => block.sectionIds.includes(a.sectionId)).map((a) => a.id) });
    }
  }
  return conflicts;
}

// server/api-handler.ts
if (process.env.NETLIFY || process.env.DB_TYPE) {
  Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports)).then(({ initializeDatabase: initializeDatabase2 }) => {
    initializeDatabase2().catch(console.error);
  });
}
var validSlotSpan = (slot, duration) => duration >= 1 && (slot === 1 && duration === 1 || slot >= 2 && slot <= 6 && slot + duration - 1 <= 6 || slot >= 7 && slot <= 10 && slot + duration - 1 <= 10 || slot === 11 && duration === 1);
var model = async () => ({
  teachers: await entities("teacher"),
  students: await entities("student"),
  rooms: await entities("room"),
  courses: await entities("course"),
  adminClasses: await entities("adminClass"),
  concurrentBlocks: await entities("concurrentBlock"),
  sections: await entities("section"),
  allocations: await allocations()
});
async function cascadeDelete(kind, id, deleted) {
  const sections = await entities("section");
  const removeSection = async (sectionId) => {
    const db2 = (await Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports))).db;
    await db2.prepare("DELETE FROM allocations WHERE section_id = ?").run(sectionId);
    const blocks = await entities("concurrentBlock");
    for (const block of blocks) {
      const sectionIds = block.sectionIds.filter((x) => x !== sectionId);
      if (sectionIds.length < 2) {
        await deleteEntity("concurrentBlock", block.id);
        deleted.push({ kind: "concurrentBlock", id: block.id });
      } else if (sectionIds.length !== block.sectionIds.length) {
        await saveEntity("concurrentBlock", { ...block, sectionIds });
      }
    }
    await deleteEntity("section", sectionId);
    deleted.push({ kind: "section", id: sectionId });
  };
  if (kind === "course") {
    for (const section of sections.filter((s) => s.courseId === id)) {
      await removeSection(section.id);
    }
  }
  if (kind === "section") {
    await removeSection(id);
  }
  if (kind === "teacher") {
    for (const section of sections.filter((s) => s.teacherId === id)) {
      await removeSection(section.id);
    }
    const adminClasses = await entities("adminClass");
    for (const cls of adminClasses.filter((c) => c.homeroomTeacherId === id)) {
      await saveEntity("adminClass", { ...cls, homeroomTeacherId: null });
    }
  }
  if (kind === "adminClass") {
    const students = await entities("student");
    const studentIds = students.filter((s) => s.classId === id).map((s) => s.id);
    for (const section of sections) {
      if (section.studentIds.some((x) => studentIds.includes(x))) {
        await saveEntity("section", {
          ...section,
          studentIds: section.studentIds.filter((x) => !studentIds.includes(x))
        });
      }
    }
    for (const studentId of studentIds) {
      await deleteEntity("student", studentId);
      deleted.push({ kind: "student", id: studentId });
    }
  }
  if (kind === "student") {
    for (const section of sections) {
      if (section.studentIds.includes(id)) {
        await saveEntity("section", {
          ...section,
          studentIds: section.studentIds.filter((x) => x !== id)
        });
      }
    }
  }
  if (kind === "room") {
    const db2 = (await Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports))).db;
    await db2.prepare("DELETE FROM allocations WHERE room_id = ?").run(id);
  }
  if (kind !== "section") {
    await deleteEntity(kind, id);
    deleted.push({ kind, id });
  }
}
var routes = {
  // 健康检查
  "GET /api/health": async () => ({
    status: 200,
    data: { status: "ok", service: "scheduler-api" }
  }),
  // 获取初始数据
  "GET /api/bootstrap": async () => {
    const data = await model();
    const conflicts = [
      ...validateAllocations(data.allocations, data.sections, data.rooms, data.teachers),
      ...validateConcurrentBlocks(data.allocations, data.sections, data.concurrentBlocks)
    ];
    return {
      status: 200,
      data: {
        ...data,
        conflicts,
        term: {
          name: "2026\u20142027\u5B66\u5E74 \u7B2C\u4E00\u5B66\u671F",
          version: "\u521D\u7A3F V1",
          status: "DRAFT"
        }
      }
    };
  },
  // 获取审计日志
  "GET /api/audit-logs": async (ctx) => {
    const limit = Number(ctx.query.limit) || 200;
    return {
      status: 200,
      data: await readAudits(limit)
    };
  },
  // 版本回退
  "POST /api/audit-logs/:id/rollback": async (ctx) => {
    const id = Number(extractPathParam(ctx.path, "audit-logs"));
    const log = await readAudit(id);
    if (!log) {
      return {
        status: 404,
        data: { message: "\u534F\u4F5C\u8BB0\u5F55\u4E0D\u5B58\u5728" }
      };
    }
    const snapshot = JSON.parse(log.beforeJson || "null");
    if (!snapshot?.teachers || !snapshot?.allocations) {
      return {
        status: 409,
        data: { message: "\u8BE5\u8BB0\u5F55\u6CA1\u6709\u53EF\u6062\u590D\u7684\u5B8C\u6574\u5FEB\u7167" }
      };
    }
    await restoreSnapshot(snapshot);
    return {
      status: 200,
      data: {
        ok: true,
        restoredFrom: log.id,
        restoredAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  },
  // 创建排课分配
  "POST /api/allocations": async (ctx) => {
    const data = await model();
    const sectionId = Number(ctx.body.sectionId);
    const roomId = Number(ctx.body.roomId);
    const day = Number(ctx.body.day);
    const slot = Number(ctx.body.slot);
    const duration = Number(ctx.body.duration || 1);
    const weekPattern = String(ctx.body.weekPattern || "EVERY_WEEK");
    const allowedPatterns = ["EVERY_WEEK", "ODD_WEEK", "EVEN_WEEK", "EVERY_3_WEEKS", "MONTHLY"];
    if (!data.sections.some((s) => s.id === sectionId)) {
      return { status: 400, data: { message: "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u6559\u5B66\u73ED" } };
    }
    if (!data.rooms.some((r) => r.id === roomId)) {
      return { status: 400, data: { message: "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u6559\u5BA4" } };
    }
    if (day < 1 || day > 5 || !validSlotSpan(slot, duration)) {
      return { status: 400, data: { message: "\u8BFE\u4F4D\u8D85\u51FA\u6559\u5B66\u65F6\u6BB5\uFF0C\u6216\u8FDE\u5802\u8DE8\u8D8A\u4E86\u5927\u8BFE\u95F4\u3001\u5348\u4F11\u3001\u665A\u95F4\u65F6\u6BB5" } };
    }
    if (!allowedPatterns.includes(weekPattern)) {
      return { status: 400, data: { message: "\u65E0\u6548\u7684\u8BFE\u7A0B\u8F6E\u6B21" } };
    }
    const db2 = (await Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports))).db;
    const maxId = await db2.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM allocations").get();
    const id = Number(maxId.id);
    const candidate = {
      id,
      sectionId,
      day,
      slot,
      duration,
      roomId,
      weekPattern,
      locked: false
    };
    const next = [...data.allocations, candidate];
    const conflicts = [
      ...validateAllocations(next, data.sections, data.rooms, data.teachers),
      ...validateConcurrentBlocks(next, data.sections, data.concurrentBlocks)
    ].filter((c) => c.allocationIds.includes(id));
    if (conflicts.length) {
      return { status: 409, data: { message: "\u65B0\u589E\u8BFE\u4F4D\u672A\u901A\u8FC7\u7EA6\u675F\u6821\u9A8C", conflicts } };
    }
    await db2.prepare(
      "INSERT INTO allocations (id, section_id, day, slot, duration, room_id, week_pattern, locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, sectionId, day, slot, duration, roomId, weekPattern, 0);
    return {
      status: 201,
      data: { allocation: candidate, conflicts: [] }
    };
  },
  // 删除排课分配
  "DELETE /api/allocations/:id": async (ctx) => {
    const id = Number(extractPathParam(ctx.path, "allocations"));
    const db2 = (await Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports))).db;
    const result = await db2.prepare("DELETE FROM allocations WHERE id = ?").run(id);
    return {
      status: 200,
      data: { ok: true, deleted: Number(result.changes) }
    };
  },
  // 移动课位
  "POST /api/allocations/:id/move": async (ctx) => {
    const id = Number(extractPathParam(ctx.path, "allocations"));
    const db2 = (await Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports))).db;
    const current = await db2.prepare("SELECT * FROM allocations WHERE id = ?").get(id);
    if (!current) {
      return { status: 404, data: { message: "\u8BFE\u6B21\u4E0D\u5B58\u5728" } };
    }
    if (current.locked) {
      return { status: 409, data: { message: "\u8BE5\u8BFE\u6B21\u5DF2\u9501\u5B9A\uFF0C\u4E0D\u80FD\u79FB\u52A8" } };
    }
    const allowedPatterns = ["EVERY_WEEK", "ODD_WEEK", "EVEN_WEEK", "EVERY_3_WEEKS", "MONTHLY"];
    const weekPattern = String(ctx.body.weekPattern || current.week_pattern || "EVERY_WEEK");
    if (!allowedPatterns.includes(weekPattern)) {
      return { status: 400, data: { message: "\u65E0\u6548\u7684\u8BFE\u7A0B\u8F6E\u6B21" } };
    }
    const candidate = {
      id,
      sectionId: current.section_id,
      day: Number(ctx.body.day),
      slot: Number(ctx.body.slot),
      duration: current.duration,
      roomId: Number(ctx.body.roomId ?? current.room_id),
      weekPattern,
      locked: false
    };
    if (candidate.day < 1 || candidate.day > 5 || !validSlotSpan(candidate.slot, candidate.duration)) {
      return { status: 400, data: { message: "\u76EE\u6807\u65F6\u95F4\u8D85\u51FA\u6559\u5B66\u65F6\u6BB5\uFF0C\u6216\u8FDE\u5802\u8DE8\u8D8A\u4E86\u5927\u8BFE\u95F4\u3001\u5348\u4F11\u3001\u665A\u95F4\u65F6\u6BB5" } };
    }
    const data = await model();
    const next = data.allocations.map((a) => a.id === id ? candidate : a);
    const conflicts = [
      ...validateAllocations(next, data.sections, data.rooms, data.teachers),
      ...validateConcurrentBlocks(next, data.sections, data.concurrentBlocks)
    ].filter((c) => c.allocationIds.includes(id));
    if (conflicts.length) {
      return { status: 409, data: { message: "\u540E\u7AEF\u6743\u5A01\u6821\u9A8C\u672A\u901A\u8FC7", conflicts } };
    }
    await db2.prepare("UPDATE allocations SET day = ?, slot = ?, room_id = ?, week_pattern = ? WHERE id = ?").run(
      candidate.day,
      candidate.slot,
      candidate.roomId,
      candidate.weekPattern,
      id
    );
    return { status: 200, data: { allocation: candidate, conflicts: [] } };
  },
  // 切换锁定状态
  "POST /api/allocations/:id/toggle-lock": async (ctx) => {
    const id = Number(extractPathParam(ctx.path, "allocations"));
    const db2 = (await Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports))).db;
    await db2.prepare("UPDATE allocations SET locked = CASE locked WHEN 1 THEN 0 ELSE 1 END WHERE id = ?").run(id);
    return { status: 200, data: { ok: true } };
  },
  // 创建版本
  "POST /api/versions": async (ctx) => {
    const data = await model();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const name = ctx.body.name || `\u8BFE\u8868\u5FEB\u7167 ${now.slice(0, 16)}`;
    const db2 = (await Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports))).db;
    const result = await db2.prepare(
      "INSERT INTO schedule_versions (name, status, snapshot, created_at) VALUES (?, ?, ?, ?)"
    ).run(name, "DRAFT", JSON.stringify(data.allocations), now);
    return {
      status: 201,
      data: {
        id: Number(result.lastInsertRowid),
        createdAt: now
      }
    };
  },
  // 获取版本列表
  "GET /api/versions": async () => {
    const db2 = (await Promise.resolve().then(() => (init_db_cloud(), db_cloud_exports))).db;
    const versions = await db2.prepare(
      "SELECT id, name, status, created_at AS createdAt FROM schedule_versions ORDER BY id DESC"
    ).all();
    return { status: 200, data: versions };
  }
};
for (const kind of ["course", "section", "adminClass", "concurrentBlock", "student", "teacher", "room"]) {
  routes[`POST /api/${kind}s`] = async (ctx) => {
    const body = ctx.body || {};
    if (!String(body.name || "").trim() || !["student", "teacher", "room"].includes(kind) && !String(body.code || "").trim()) {
      return { status: 400, data: { message: "\u540D\u79F0\u548C\u4EE3\u7801\u4E0D\u80FD\u4E3A\u7A7A" } };
    }
    if (kind === "room" && (!Number(body.capacity) || Number(body.capacity) < 1)) {
      return { status: 400, data: { message: "\u6559\u5BA4\u5BB9\u91CF\u5FC5\u987B\u5927\u4E8E0" } };
    }
    if (kind === "section" && (!Number(body.courseId) || !Number(body.teacherId))) {
      return { status: 400, data: { message: "\u6559\u5B66\u73ED\u5FC5\u987B\u9009\u62E9\u8BFE\u7A0B\u548C\u6559\u5E08" } };
    }
    if (kind === "concurrentBlock" && (!Array.isArray(body.sectionIds) || body.sectionIds.length < 2)) {
      return { status: 400, data: { message: "\u540C\u6B65\u5F00\u8BFE\u7EC4\u81F3\u5C11\u9700\u8981\u9009\u62E9\u4E24\u4E2A\u6559\u5B66\u73ED" } };
    }
    if (body.code) {
      const existing = await entities(kind);
      const duplicate = existing.find((x) => x.code === body.code && x.id !== body.id);
      if (duplicate) {
        return { status: 409, data: { message: "\u4EE3\u7801\u5DF2\u5B58\u5728" } };
      }
    }
    const result = await saveEntity(kind, body);
    return { status: body.id ? 200 : 201, data: result };
  };
  routes[`DELETE /api/${kind}s/:id`] = async (ctx) => {
    const id = Number(extractPathParam(ctx.path, kind + "s"));
    const deleted = [];
    try {
      await cascadeDelete(kind, id, deleted);
      return { status: 200, data: { ok: true, deleted } };
    } catch (error) {
      return { status: 500, data: { message: "\u5220\u9664\u5931\u8D25", error: String(error) } };
    }
  };
}
for (const kind of ["student", "teacher"]) {
  routes[`POST /api/${kind}s/batch`] = async (ctx) => {
    const records = Array.isArray(ctx.body?.records) ? ctx.body.records : [];
    if (!records.length) {
      return { status: 400, data: { message: "\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u6570\u636E" } };
    }
    const classes = await entities("adminClass");
    const existing = await entities(kind);
    const errors = [];
    const normalized = records.map((raw, index) => {
      const row = index + 2;
      if (!String(raw.name || "").trim()) errors.push(`\u7B2C${row}\u884C\uFF1A\u59D3\u540D\u4E0D\u80FD\u4E3A\u7A7A`);
      if (kind === "student") {
        const cls = classes.find(
          (c) => c.code === raw.classCode || c.name === raw.className || c.name === raw.classCode
        );
        if (!cls) errors.push(`\u7B2C${row}\u884C\uFF1A\u627E\u4E0D\u5230\u884C\u653F\u73ED ${raw.classCode || raw.className || ""}`);
        const studentNo = String(raw.studentNo || "").trim();
        if (studentNo && (existing.some((x) => x.studentNo === studentNo) || records.slice(0, index).some((x) => x.studentNo === studentNo))) {
          errors.push(`\u7B2C${row}\u884C\uFF1A\u5B66\u53F7 ${studentNo} \u5DF2\u5B58\u5728`);
        }
        return {
          studentNo: studentNo || `S${Date.now()}${index}`,
          name: String(raw.name || "").trim(),
          classId: cls?.id || 0,
          grade: cls?.grade || ""
        };
      }
      return {
        name: String(raw.name || "").trim(),
        subject: String(raw.subject || "").trim(),
        phone: String(raw.phone || "").trim()
      };
    });
    if (errors.length) {
      return { status: 400, data: { message: "\u5BFC\u5165\u6821\u9A8C\u672A\u901A\u8FC7", errors } };
    }
    try {
      const saved = await Promise.all(normalized.map((x) => saveEntity(kind, x)));
      return { status: 201, data: { count: saved.length, records: saved } };
    } catch (error) {
      return { status: 500, data: { message: "\u5BFC\u5165\u5931\u8D25", error: String(error) } };
    }
  };
}
routes["POST /api/batch-delete"] = async (ctx) => {
  const kind = String(ctx.body?.kind || "");
  const ids = [...new Set((Array.isArray(ctx.body?.ids) ? ctx.body.ids : []).map(Number).filter(Number.isInteger))];
  if (!["course", "teacher", "student", "room"].includes(kind)) {
    return { status: 400, data: { message: "\u8BE5\u7C7B\u578B\u4E0D\u652F\u6301\u6279\u91CF\u5220\u9664" } };
  }
  if (!ids.length) {
    return { status: 400, data: { message: "\u6CA1\u6709\u9009\u62E9\u8981\u5220\u9664\u7684\u6570\u636E" } };
  }
  const deleted = [];
  const started = Date.now();
  try {
    for (const id of ids) {
      await cascadeDelete(kind, id, deleted);
    }
    return {
      status: 200,
      data: { ok: true, requested: ids.length, deleted: deleted.length, durationMs: Date.now() - started }
    };
  } catch (error) {
    return { status: 500, data: { message: "\u6279\u91CF\u5220\u9664\u5931\u8D25", error: String(error) } };
  }
};
function extractPathParam(path, key) {
  const parts = path.split("/");
  const keyIndex = parts.findIndex((p) => p === key);
  return keyIndex >= 0 && keyIndex + 1 < parts.length ? parts[keyIndex + 1] : "";
}
function getClientIp(headers) {
  return headers["cf-connecting-ip"] || headers["x-forwarded-for"]?.split(",")[0].trim() || headers["x-real-ip"] || "unknown";
}
async function apiHandler(ctx) {
  const { method, path, body, headers, query } = ctx;
  const routeKey = `${method} ${path}`;
  let handler2 = routes[routeKey];
  if (!handler2) {
    for (const [key, value] of Object.entries(routes)) {
      const [keyMethod, keyPath] = key.split(" ");
      if (keyMethod !== method) continue;
      const pattern = keyPath.replace(/:[^/]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(path)) {
        handler2 = value;
        break;
      }
    }
  }
  if (!handler2) {
    return { status: 404, data: { message: "API endpoint not found" } };
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const before = await model();
    let responseBody;
    const actorIp = getClientIp(headers);
    try {
      const result = await handler2(ctx);
      responseBody = result.data;
      if (result.status >= 200 && result.status < 300) {
        const action = path.includes("/rollback") ? "\u7248\u672C\u56DE\u9000" : method === "DELETE" ? "\u5220\u9664" : path.includes("/move") ? "\u79FB\u52A8\u8BFE\u4F4D" : path.includes("/batch") ? "\u6279\u91CF\u64CD\u4F5C" : body?.id ? "\u4FEE\u6539" : "\u65B0\u589E";
        const name = body?.name || responseBody?.name || responseBody?.allocation?.id || "";
        await writeAudit({
          actorIp,
          action,
          resource: path,
          summary: `${action}${name ? `\uFF1A${name}` : ""}`,
          before,
          after: await model(),
          request: body
        });
      }
      return result;
    } catch (error) {
      return { status: 500, data: { message: "Internal Server Error", error: String(error) } };
    }
  }
  return handler2(ctx);
}
if (process.env.NETLIFY || process.env.DB_TYPE) {
  (async () => {
    backfillAuditSnapshots(await model());
  })();
}

// netlify/functions/api.ts
var handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS"
      },
      body: ""
    };
  }
  const method = event.httpMethod;
  const path = event.path || event.rawUrl;
  const body = event.body ? JSON.parse(event.body) : {};
  const headers = event.headers || {};
  const queryStringParameters = event.queryStringParameters || {};
  try {
    const result = await apiHandler({
      method,
      path,
      body,
      headers,
      query: queryStringParameters
    });
    return {
      statusCode: result.status || 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(result.data)
    };
  } catch (error) {
    return {
      statusCode: error.status || 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        message: error.message || "Internal Server Error"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
