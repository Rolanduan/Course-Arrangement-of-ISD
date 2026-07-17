/**
 * API 处理器 - 统一处理所有 API 请求
 * 兼容 Express 和 Netlify Functions
 */

import {
  entities,
  allocations,
  saveEntity,
  deleteEntity,
  writeAudit,
  readAudits,
  readAudit,
  backfillAuditSnapshots,
  restoreSnapshot
} from './db-cloud.js';

import {
  validateAllocations,
  validateConcurrentBlocks,
  type Course,
  type Section,
  type Room,
  type Teacher,
  type AdministrativeClass,
  type ConcurrentBlock
} from './domain.js';

// 初始化数据库
if (process.env.NETLIFY || process.env.DB_TYPE) {
  import('./db-cloud.js').then(({ initializeDatabase }) => {
    initializeDatabase().catch(console.error);
  });
}

const validSlotSpan = (slot: number, duration: number) =>
  duration >= 1 &&
  ((slot === 1 && duration === 1) ||
    (slot >= 2 && slot <= 6 && slot + duration - 1 <= 6) ||
    (slot >= 7 && slot <= 10 && slot + duration - 1 <= 10) ||
    (slot === 11 && duration === 1));

const model = async () => ({
  teachers: await entities<Teacher>('teacher'),
  students: await entities<any>('student'),
  rooms: await entities<Room>('room'),
  courses: await entities<Course>('course'),
  adminClasses: await entities<AdministrativeClass>('adminClass'),
  concurrentBlocks: await entities<ConcurrentBlock>('concurrentBlock'),
  sections: await entities<Section>('section'),
  allocations: await allocations()
});

type DeletableKind = 'course' | 'section' | 'adminClass' | 'concurrentBlock' | 'student' | 'teacher' | 'room';

interface RequestContext {
  method: string;
  path: string;
  body: any;
  headers: Record<string, string>;
  query: Record<string, string>;
}

interface ResponseContext {
  status: number;
  data: any;
}

// 级联删除函数
async function cascadeDelete(
  kind: DeletableKind,
  id: number,
  deleted: { kind: string; id: number }[]
): Promise<void> {
  const sections = await entities<Section>('section');

  const removeSection = async (sectionId: number) => {
    const db = (await import('./db-cloud.js')).db;
    await db.prepare('DELETE FROM allocations WHERE section_id = ?').run(sectionId);

    const blocks = await entities<any>('concurrentBlock');
    for (const block of blocks) {
      const sectionIds = block.sectionIds.filter((x: number) => x !== sectionId);
      if (sectionIds.length < 2) {
        await deleteEntity('concurrentBlock', block.id);
        deleted.push({ kind: 'concurrentBlock', id: block.id });
      } else if (sectionIds.length !== block.sectionIds.length) {
        await saveEntity('concurrentBlock', { ...block, sectionIds });
      }
    }
    await deleteEntity('section', sectionId);
    deleted.push({ kind: 'section', id: sectionId });
  };

  if (kind === 'course') {
    for (const section of sections.filter(s => s.courseId === id)) {
      await removeSection(section.id);
    }
  }

  if (kind === 'section') {
    await removeSection(id);
  }

  if (kind === 'teacher') {
    for (const section of sections.filter(s => s.teacherId === id)) {
      await removeSection(section.id);
    }
    const adminClasses = await entities<any>('adminClass');
    for (const cls of adminClasses.filter(c => c.homeroomTeacherId === id)) {
      await saveEntity('adminClass', { ...cls, homeroomTeacherId: null });
    }
  }

  if (kind === 'adminClass') {
    const students = await entities<any>('student');
    const studentIds = students.filter(s => s.classId === id).map(s => s.id);

    for (const section of sections) {
      if (section.studentIds.some((x: number) => studentIds.includes(x))) {
        await saveEntity('section', {
          ...section,
          studentIds: section.studentIds.filter((x: number) => !studentIds.includes(x))
        });
      }
    }

    for (const studentId of studentIds) {
      await deleteEntity('student', studentId);
      deleted.push({ kind: 'student', id: studentId });
    }
  }

  if (kind === 'student') {
    for (const section of sections) {
      if (section.studentIds.includes(id)) {
        await saveEntity('section', {
          ...section,
          studentIds: section.studentIds.filter((x: number) => x !== id)
        });
      }
    }
  }

  if (kind === 'room') {
    const db = (await import('./db-cloud.js')).db;
    await db.prepare('DELETE FROM allocations WHERE room_id = ?').run(id);
  }

  if (kind !== 'section') {
    await deleteEntity(kind, id);
    deleted.push({ kind, id });
  }
}

// 路由处理器
const routes: Record<string, (ctx: RequestContext) => Promise<ResponseContext>> = {
  // 健康检查
  'GET /api/health': async () => ({
    status: 200,
    data: { status: 'ok', service: 'scheduler-api' }
  }),

  // 获取初始数据
  'GET /api/bootstrap': async () => {
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
          name: '2026—2027学年 第一学期',
          version: '初稿 V1',
          status: 'DRAFT'
        }
      }
    };
  },

  // 获取审计日志
  'GET /api/audit-logs': async (ctx) => {
    const limit = Number(ctx.query.limit) || 200;
    return {
      status: 200,
      data: await readAudits(limit)
    };
  },

  // 版本回退
  'POST /api/audit-logs/:id/rollback': async (ctx) => {
    const id = Number(extractPathParam(ctx.path, 'audit-logs'));
    const log = await readAudit(id);

    if (!log) {
      return {
        status: 404,
        data: { message: '协作记录不存在' }
      };
    }

    const snapshot = JSON.parse(log.beforeJson || 'null');
    if (!snapshot?.teachers || !snapshot?.allocations) {
      return {
        status: 409,
        data: { message: '该记录没有可恢复的完整快照' }
      };
    }

    await restoreSnapshot(snapshot);
    return {
      status: 200,
      data: {
        ok: true,
        restoredFrom: log.id,
        restoredAt: new Date().toISOString()
      }
    };
  },

  // 创建排课分配
  'POST /api/allocations': async (ctx) => {
    const data = await model();
    const sectionId = Number(ctx.body.sectionId);
    const roomId = Number(ctx.body.roomId);
    const day = Number(ctx.body.day);
    const slot = Number(ctx.body.slot);
    const duration = Number(ctx.body.duration || 1);
    const weekPattern = String(ctx.body.weekPattern || 'EVERY_WEEK');

    const allowedPatterns = ['EVERY_WEEK', 'ODD_WEEK', 'EVEN_WEEK', 'EVERY_3_WEEKS', 'MONTHLY'];

    if (!data.sections.some(s => s.id === sectionId)) {
      return { status: 400, data: { message: '请选择有效的教学班' } };
    }
    if (!data.rooms.some(r => r.id === roomId)) {
      return { status: 400, data: { message: '请选择有效的教室' } };
    }
    if (day < 1 || day > 5 || !validSlotSpan(slot, duration)) {
      return { status: 400, data: { message: '课位超出教学时段，或连堂跨越了大课间、午休、晚间时段' } };
    }
    if (!allowedPatterns.includes(weekPattern)) {
      return { status: 400, data: { message: '无效的课程轮次' } };
    }

    // 获取新 ID
    const db = (await import('./db-cloud.js')).db;
    const maxId = await db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM allocations').get();
    const id = Number((maxId as any).id);

    const candidate = {
      id,
      sectionId,
      day,
      slot,
      duration,
      roomId,
      weekPattern: weekPattern as any,
      locked: false
    };

    const next = [...data.allocations, candidate];
    const conflicts = [
      ...validateAllocations(next, data.sections, data.rooms, data.teachers),
      ...validateConcurrentBlocks(next, data.sections, data.concurrentBlocks)
    ].filter(c => c.allocationIds.includes(id));

    if (conflicts.length) {
      return { status: 409, data: { message: '新增课位未通过约束校验', conflicts } };
    }

    await db.prepare(
      'INSERT INTO allocations (id, section_id, day, slot, duration, room_id, week_pattern, locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, sectionId, day, slot, duration, roomId, weekPattern, 0);

    return {
      status: 201,
      data: { allocation: candidate, conflicts: [] }
    };
  },

  // 删除排课分配
  'DELETE /api/allocations/:id': async (ctx) => {
    const id = Number(extractPathParam(ctx.path, 'allocations'));
    const db = (await import('./db-cloud.js')).db;
    const result = await db.prepare('DELETE FROM allocations WHERE id = ?').run(id);
    return {
      status: 200,
      data: { ok: true, deleted: Number(result.changes) }
    };
  },

  // 移动课位
  'POST /api/allocations/:id/move': async (ctx) => {
    const id = Number(extractPathParam(ctx.path, 'allocations'));
    const db = (await import('./db-cloud.js')).db;

    const current = await db.prepare('SELECT * FROM allocations WHERE id = ?').get(id);
    if (!current) {
      return { status: 404, data: { message: '课次不存在' } };
    }
    if (current.locked) {
      return { status: 409, data: { message: '该课次已锁定，不能移动' } };
    }

    const allowedPatterns = ['EVERY_WEEK', 'ODD_WEEK', 'EVEN_WEEK', 'EVERY_3_WEEKS', 'MONTHLY'];
    const weekPattern = String(ctx.body.weekPattern || current.week_pattern || 'EVERY_WEEK');

    if (!allowedPatterns.includes(weekPattern)) {
      return { status: 400, data: { message: '无效的课程轮次' } };
    }

    const candidate = {
      id,
      sectionId: current.section_id,
      day: Number(ctx.body.day),
      slot: Number(ctx.body.slot),
      duration: current.duration,
      roomId: Number(ctx.body.roomId ?? current.room_id),
      weekPattern: weekPattern as any,
      locked: false
    };

    if (candidate.day < 1 || candidate.day > 5 || !validSlotSpan(candidate.slot, candidate.duration)) {
      return { status: 400, data: { message: '目标时间超出教学时段，或连堂跨越了大课间、午休、晚间时段' } };
    }

    const data = await model();
    const next = data.allocations.map(a => (a.id === id ? candidate : a));
    const conflicts = [
      ...validateAllocations(next, data.sections, data.rooms, data.teachers),
      ...validateConcurrentBlocks(next, data.sections, data.concurrentBlocks)
    ].filter(c => c.allocationIds.includes(id));

    if (conflicts.length) {
      return { status: 409, data: { message: '后端权威校验未通过', conflicts } };
    }

    await db.prepare('UPDATE allocations SET day = ?, slot = ?, room_id = ?, week_pattern = ? WHERE id = ?').run(
      candidate.day,
      candidate.slot,
      candidate.roomId,
      candidate.weekPattern,
      id
    );

    return { status: 200, data: { allocation: candidate, conflicts: [] } };
  },

  // 切换锁定状态
  'POST /api/allocations/:id/toggle-lock': async (ctx) => {
    const id = Number(extractPathParam(ctx.path, 'allocations'));
    const db = (await import('./db-cloud.js')).db;
    await db.prepare('UPDATE allocations SET locked = CASE locked WHEN 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
    return { status: 200, data: { ok: true } };
  },

  // 创建版本
  'POST /api/versions': async (ctx) => {
    const data = await model();
    const now = new Date().toISOString();
    const name = ctx.body.name || `课表快照 ${now.slice(0, 16)}`;

    const db = (await import('./db-cloud.js')).db;
    const result = await db.prepare(
      'INSERT INTO schedule_versions (name, status, snapshot, created_at) VALUES (?, ?, ?, ?)'
    ).run(name, 'DRAFT', JSON.stringify(data.allocations), now);

    return {
      status: 201,
      data: {
        id: Number(result.lastInsertRowid),
        createdAt: now
      }
    };
  },

  // 获取版本列表
  'GET /api/versions': async () => {
    const db = (await import('./db-cloud.js')).db;
    const versions = await db.prepare(
      'SELECT id, name, status, created_at AS createdAt FROM schedule_versions ORDER BY id DESC'
    ).all();
    return { status: 200, data: versions };
  }
};

// 通用 CRUD 路由
for (const kind of ['course', 'section', 'adminClass', 'concurrentBlock', 'student', 'teacher', 'room'] as const) {
  // 创建/更新
  routes[`POST /api/${kind}s`] = async (ctx) => {
    const body = ctx.body || {};

    if (!String(body.name || '').trim() || (!['student', 'teacher', 'room'].includes(kind) && !String(body.code || '').trim())) {
      return { status: 400, data: { message: '名称和代码不能为空' } };
    }
    if (kind === 'room' && (!Number(body.capacity) || Number(body.capacity) < 1)) {
      return { status: 400, data: { message: '教室容量必须大于0' } };
    }
    if (kind === 'section' && (!Number(body.courseId) || !Number(body.teacherId))) {
      return { status: 400, data: { message: '教学班必须选择课程和教师' } };
    }
    if (kind === 'concurrentBlock' && (!Array.isArray(body.sectionIds) || body.sectionIds.length < 2)) {
      return { status: 400, data: { message: '同步开课组至少需要选择两个教学班' } };
    }

    if (body.code) {
      const existing = await entities<any>(kind);
      const duplicate = existing.find(x => x.code === body.code && x.id !== body.id);
      if (duplicate) {
        return { status: 409, data: { message: '代码已存在' } };
      }
    }

    const result = await saveEntity(kind, body);
    return { status: body.id ? 200 : 201, data: result };
  };

  // 删除
  routes[`DELETE /api/${kind}s/:id`] = async (ctx) => {
    const id = Number(extractPathParam(ctx.path, kind + 's'));
    const deleted: { kind: string; id: number }[] = [];

    try {
      await cascadeDelete(kind as DeletableKind, id, deleted);
      return { status: 200, data: { ok: true, deleted } };
    } catch (error) {
      return { status: 500, data: { message: '删除失败', error: String(error) } };
    }
  };
}

// 批量导入 (学生/教师)
for (const kind of ['student', 'teacher'] as const) {
  routes[`POST /api/${kind}s/batch`] = async (ctx) => {
    const records = Array.isArray(ctx.body?.records) ? ctx.body.records : [];
    if (!records.length) {
      return { status: 400, data: { message: '没有可导入的数据' } };
    }

    const classes = await entities<any>('adminClass');
    const existing = await entities<any>(kind);
    const errors: string[] = [];

    const normalized = records.map((raw: any, index: number) => {
      const row = index + 2;
      if (!String(raw.name || '').trim()) errors.push(`第${row}行：姓名不能为空`);

      if (kind === 'student') {
        const cls = classes.find(
          (c: any) => c.code === raw.classCode || c.name === raw.className || c.name === raw.classCode
        );
        if (!cls) errors.push(`第${row}行：找不到行政班 ${raw.classCode || raw.className || ''}`);

        const studentNo = String(raw.studentNo || '').trim();
        if (
          studentNo &&
          (existing.some((x: any) => x.studentNo === studentNo) ||
            records.slice(0, index).some((x: any) => x.studentNo === studentNo))
        ) {
          errors.push(`第${row}行：学号 ${studentNo} 已存在`);
        }

        return {
          studentNo: studentNo || `S${Date.now()}${index}`,
          name: String(raw.name || '').trim(),
          classId: cls?.id || 0,
          grade: cls?.grade || ''
        };
      }

      return {
        name: String(raw.name || '').trim(),
        subject: String(raw.subject || '').trim(),
        phone: String(raw.phone || '').trim()
      };
    });

    if (errors.length) {
      return { status: 400, data: { message: '导入校验未通过', errors } };
    }

    try {
      const saved = await Promise.all(normalized.map((x: any) => saveEntity(kind, x)));
      return { status: 201, data: { count: saved.length, records: saved } };
    } catch (error) {
      return { status: 500, data: { message: '导入失败', error: String(error) } };
    }
  };
}

// 批量删除
routes['POST /api/batch-delete'] = async (ctx) => {
  const kind = String(ctx.body?.kind || '') as DeletableKind;
  const ids = [...new Set<number>((Array.isArray(ctx.body?.ids) ? ctx.body.ids : []).map(Number).filter(Number.isInteger))];

  if (!['course', 'teacher', 'student', 'room'].includes(kind)) {
    return { status: 400, data: { message: '该类型不支持批量删除' } };
  }
  if (!ids.length) {
    return { status: 400, data: { message: '没有选择要删除的数据' } };
  }

  const deleted: { kind: string; id: number }[] = [];
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
    return { status: 500, data: { message: '批量删除失败', error: String(error) } };
  }
};

// 辅助函数：从路径中提取参数
function extractPathParam(path: string, key: string): string {
  const parts = path.split('/');
  const keyIndex = parts.findIndex(p => p === key);
  return keyIndex >= 0 && keyIndex + 1 < parts.length ? parts[keyIndex + 1] : '';
}

// 获取客户端 IP
function getClientIp(headers: Record<string, string>): string {
  return (
    headers['cf-connecting-ip'] ||
    headers['x-forwarded-for']?.split(',')[0].trim() ||
    headers['x-real-ip'] ||
    'unknown'
  );
}

// 主 API 处理器
export async function apiHandler(ctx: RequestContext): Promise<ResponseContext> {
  const { method, path, body, headers, query } = ctx;

  // 构建路由键
  const routeKey = `${method} ${path}`;

  // 查找匹配的路由
  let handler = routes[routeKey as keyof typeof routes];

  // 如果没有精确匹配，尝试参数化路由
  if (!handler) {
    for (const [key, value] of Object.entries(routes)) {
      const [keyMethod, keyPath] = key.split(' ');
      if (keyMethod !== method) continue;

      // 将路由模式转换为正则表达式
      const pattern = keyPath.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(path)) {
        handler = value;
        break;
      }
    }
  }

  if (!handler) {
    return { status: 404, data: { message: 'API endpoint not found' } };
  }

  // 写入审计日志（对于写操作）
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const before = await model();
    let responseBody: any;
    const actorIp = getClientIp(headers);

    try {
      const result = await handler(ctx);
      responseBody = result.data;

      if (result.status >= 200 && result.status < 300) {
        const action = path.includes('/rollback')
          ? '版本回退'
          : method === 'DELETE'
            ? '删除'
            : path.includes('/move')
              ? '移动课位'
              : path.includes('/batch')
                ? '批量操作'
                : body?.id
                  ? '修改'
                  : '新增';

        const name = body?.name || responseBody?.name || responseBody?.allocation?.id || '';
        await writeAudit({
          actorIp,
          action,
          resource: path,
          summary: `${action}${name ? `：${name}` : ''}`,
          before,
          after: await model(),
          request: body
        });
      }

      return result;
    } catch (error: any) {
      return { status: 500, data: { message: 'Internal Server Error', error: String(error) } };
    }
  }

  return handler(ctx);
}

// 初始化
if (process.env.NETLIFY || process.env.DB_TYPE) {
  (async () => {
    backfillAuditSnapshots(await model());
  })();
}
