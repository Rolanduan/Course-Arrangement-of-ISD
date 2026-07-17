import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs'; import path from 'node:path';

const dataDir = path.resolve('data'); fs.mkdirSync(dataDir, { recursive: true });
export const db = new DatabaseSync(path.join(dataDir, 'scheduler.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS entities(kind TEXT NOT NULL, id INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(kind,id));
CREATE TABLE IF NOT EXISTS allocations(id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL, day INTEGER NOT NULL, slot INTEGER NOT NULL, duration INTEGER NOT NULL, room_id INTEGER NOT NULL, locked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS schedule_versions(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, actor_ip TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL, summary TEXT NOT NULL, before_json TEXT, after_json TEXT, request_json TEXT);
`);
const allocationColumns=db.prepare('PRAGMA table_info(allocations)').all() as {name:string}[];
if(!allocationColumns.some(c=>c.name==='week_pattern')) db.exec("ALTER TABLE allocations ADD COLUMN week_pattern TEXT NOT NULL DEFAULT 'EVERY_WEEK'");

const seed: Record<string, unknown[]> = {
  adminClass: [
    {id:1,code:'G7',name:'G7',grade:'G7',track:'初中'}, {id:2,code:'G8',name:'G8',grade:'G8',track:'初中'},
    {id:3,code:'G9',name:'G9',grade:'G9',track:'初中'}, {id:4,code:'26-SACE',name:'26SACE',grade:'G10',track:'SACE'},
    {id:5,code:'25-SACE',name:'25SACE',grade:'G11',track:'SACE'}, {id:6,code:'24-SACE',name:'24SACE',grade:'G12',track:'SACE'},
    {id:7,code:'25-JPKR',name:'25日韩',grade:'G11',track:'日韩'}, {id:8,code:'24-JPKR',name:'24日韩',grade:'G12',track:'日韩'}
  ],
  concurrentBlock: [],
  course: [
    {id:1,code:'AP-CALC-AB',name:'AP 微积分 AB',system:'AP',credits:1,defaultWeeklyHours:4,gradeRange:'G10—G12',description:'大学先修微积分课程'},
    {id:2,code:'SACE-EAL',name:'SACE EAL',system:'SACE',credits:1,defaultWeeklyHours:3,gradeRange:'G10—G12',description:'英语附加语言课程'},
    {id:3,code:'AP-PHY-1',name:'AP Physics 1',system:'AP',credits:1,defaultWeeklyHours:4,gradeRange:'G10—G12',description:'含实验要求的物理课程'},
    {id:4,code:'FORCE-RES',name:'原力学院研究课',system:'原力学院',credits:1,defaultWeeklyHours:2,gradeRange:'G9—G12',description:'跨学科研究与项目课程'}
  ],
  teacher: [{id:1,name:'张雪峰',subject:'数学'},{id:2,name:'Emily Chen',subject:'英语'},{id:3,name:'王晨',subject:'物理'},{id:4,name:'李嘉怡',subject:'研究与项目'}],
  room: [{id:1,name:'A301',capacity:24,type:'普通教室'},{id:2,name:'物理实验室',capacity:20,type:'实验室'},{id:3,name:'研讨室 B2',capacity:16,type:'研讨室'},{id:4,name:'机房 C1',capacity:30,type:'机房'}],
  student: Array.from({length:32},(_,i)=>({id:i+1,name:`学生${String(i+1).padStart(2,'0')}`,grade:i<12?'G10':i<23?'G11':'G12'})),
  section: [
    {id:1,courseId:1,code:'AP-CALC-A',name:'AP 微积分 AB · A班',system:'AP',teacherId:1,studentIds:[1,2,3,4,5,6,7,8,9,10,11,12],weeklyHours:4,capacity:24,color:'#4f46e5'},
    {id:2,courseId:2,code:'SACE-EAL-2',name:'SACE EAL · Level 2',system:'SACE',teacherId:2,studentIds:[3,4,13,14,15,16,17,18,19,20,21],weeklyHours:3,capacity:20,color:'#0f9f7f'},
    {id:3,courseId:3,code:'AP-PHY-1',name:'AP Physics 1',system:'AP',teacherId:3,studentIds:[1,2,13,14,22,23,24,25,26,27,28,29,30],weeklyHours:4,capacity:20,color:'#e8792e'},
    {id:4,courseId:4,code:'FORCE-RES',name:'原力学院研究课',system:'原力学院',teacherId:4,studentIds:[5,6,7,15,16,22,23,31,32],weeklyHours:2,capacity:16,color:'#d94678'}
  ]
};
const insertEntity=db.prepare('INSERT INTO entities(kind,id,payload) VALUES(?,?,?)');
for(const [kind,rows] of Object.entries(seed)) {
  const count = db.prepare('SELECT COUNT(*) count FROM entities WHERE kind=?').get(kind) as {count:number};
  if (!count.count) for(const row of rows as any[]) insertEntity.run(kind,row.id,JSON.stringify(row));
}
for (const section of entities<any>('section')) if (!section.courseId || !section.capacity) {
  const upgraded={...section,courseId:section.id,capacity:Math.max(16,section.studentIds.length)};
  db.prepare('UPDATE entities SET payload=? WHERE kind=? AND id=?').run(JSON.stringify(upgraded),'section',section.id);
}
const classCycle=[1,2,3,4,4,5,5,6,7,8];
for (const student of entities<any>('student')) if (!student.classId) {
  const classId=classCycle[(student.id-1)%classCycle.length]; const admin=entities<any>('adminClass').find(c=>c.id===classId);
  db.prepare('UPDATE entities SET payload=? WHERE kind=? AND id=?').run(JSON.stringify({...student,classId,grade:admin?.grade||student.grade}),'student',student.id);
}
for (const teacher of entities<any>('teacher')) if (teacher.employeeNo!==undefined) {
  const {employeeNo:_removed,...cleanTeacher}=teacher;
  db.prepare('UPDATE entities SET payload=? WHERE kind=? AND id=?').run(JSON.stringify({...cleanTeacher,phone:cleanTeacher.phone||''}),'teacher',teacher.id);
}
for (const student of entities<any>('student')) if (!student.studentNo) {
  db.prepare('UPDATE entities SET payload=? WHERE kind=? AND id=?').run(JSON.stringify({...student,studentNo:`S${String(student.id).padStart(4,'0')}`}),'student',student.id);
}
for (const admin of entities<any>('adminClass')) if (admin.homeroomTeacherId===undefined) {
  db.prepare('UPDATE entities SET payload=? WHERE kind=? AND id=?').run(JSON.stringify({...admin,homeroomTeacherId:((admin.id-1)%4)+1}),'adminClass',admin.id);
}
const systemNames:Record<string,string>={AP:'AP课程',SACE:'SACE课程','A-Level':'Alevel课程',Alevel:'Alevel课程','原力学院':'原力学院研习课程','校本课程':'初中课程'};
for (const kind of ['course','section']) for (const item of entities<any>(kind)) if (systemNames[item.system]) {
  db.prepare('UPDATE entities SET payload=? WHERE kind=? AND id=?').run(JSON.stringify({...item,system:systemNames[item.system]}),kind,item.id);
}
const allocationCount = db.prepare('SELECT COUNT(*) count FROM allocations').get() as {count:number};
if (allocationCount.count < 9) {
  db.exec('DELETE FROM allocations');
  const insert=db.prepare('INSERT INTO allocations(id,section_id,day,slot,duration,room_id,locked) VALUES(?,?,?,?,?,?,?)');
  [[1,1,1,1,1,1,0],[2,1,3,3,2,1,0],[3,1,5,2,1,1,1],[4,2,1,3,1,3,0],[5,2,3,1,1,3,0],[6,2,5,4,1,3,0],[7,3,2,2,2,2,0],[8,3,4,2,2,2,0],[9,4,3,6,2,4,0]].forEach(x=>insert.run(...x));
}
const rhythmMigration=db.prepare("SELECT COUNT(*) count FROM entities WHERE kind='systemMigration' AND id=1").get() as {count:number};
if(!rhythmMigration.count){
  db.exec('UPDATE allocations SET slot=CASE WHEN slot<=4 THEN slot+1 ELSE slot+2 END');
  insertEntity.run('systemMigration',1,JSON.stringify({id:1,name:'international-rhythm-2026',appliedAt:new Date().toISOString()}));
}
export function entities<T>(kind:string):T[]{ return (db.prepare('SELECT payload FROM entities WHERE kind=? ORDER BY id').all(kind) as {payload:string}[]).map(r=>JSON.parse(r.payload)); }
export function allocations(){ return (db.prepare('SELECT id,section_id sectionId,day,slot,duration,room_id roomId,week_pattern weekPattern,locked FROM allocations ORDER BY id').all() as any[]).map(r=>({...r,locked:Boolean(r.locked)})); }
export function saveEntity(kind:string,payload:any){ const id=payload.id||Number((db.prepare('SELECT COALESCE(MAX(id),0)+1 id FROM entities WHERE kind=?').get(kind) as any).id); const value={...payload,id}; db.prepare('INSERT INTO entities(kind,id,payload) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload').run(kind,id,JSON.stringify(value)); return value; }
export function deleteEntity(kind:string,id:number){ return db.prepare('DELETE FROM entities WHERE kind=? AND id=?').run(kind,id); }
export function writeAudit(entry:{actorIp:string;action:string;resource:string;summary:string;before?:unknown;after?:unknown;request?:unknown}){db.prepare('INSERT INTO audit_logs(occurred_at,actor_ip,action,resource,summary,before_json,after_json,request_json) VALUES(?,?,?,?,?,?,?,?)').run(new Date().toISOString(),entry.actorIp,entry.action,entry.resource,entry.summary,entry.before===undefined?null:JSON.stringify(entry.before),entry.after===undefined?null:JSON.stringify(entry.after),entry.request===undefined?null:JSON.stringify(entry.request));}
export function readAudits(limit=200){return db.prepare('SELECT id,occurred_at occurredAt,actor_ip actorIp,action,resource,summary,before_json beforeJson,after_json afterJson,request_json requestJson FROM audit_logs ORDER BY id DESC LIMIT ?').all(Math.min(Math.max(limit,1),1000));}
export function readAudit(id:number){return db.prepare('SELECT id,occurred_at occurredAt,actor_ip actorIp,action,resource,summary,before_json beforeJson,after_json afterJson FROM audit_logs WHERE id=?').get(id) as any;}
export function backfillAuditSnapshots(snapshot:unknown){const json=JSON.stringify(snapshot);for(const row of db.prepare('SELECT id,before_json beforeJson FROM audit_logs').all() as any[]){try{const value=JSON.parse(row.beforeJson||'null');if(!value?.teachers||!value?.allocations)db.prepare('UPDATE audit_logs SET before_json=? WHERE id=?').run(json,row.id);}catch{db.prepare('UPDATE audit_logs SET before_json=? WHERE id=?').run(json,row.id);}}}
export function restoreSnapshot(snapshot:any){
  const kinds:{key:string;kind:string}[]=[{key:'teachers',kind:'teacher'},{key:'students',kind:'student'},{key:'rooms',kind:'room'},{key:'courses',kind:'course'},{key:'adminClasses',kind:'adminClass'},{key:'concurrentBlocks',kind:'concurrentBlock'},{key:'sections',kind:'section'}];
  db.exec('BEGIN');try{
    for(const {key,kind} of kinds){db.prepare('DELETE FROM entities WHERE kind=?').run(kind);for(const row of snapshot[key]||[])db.prepare('INSERT INTO entities(kind,id,payload) VALUES(?,?,?)').run(kind,row.id,JSON.stringify(row));}
    db.exec('DELETE FROM allocations');const insert=db.prepare('INSERT INTO allocations(id,section_id,day,slot,duration,room_id,week_pattern,locked) VALUES(?,?,?,?,?,?,?,?)');for(const a of snapshot.allocations||[])insert.run(a.id,a.sectionId,a.day,a.slot,a.duration,a.roomId,a.weekPattern||'EVERY_WEEK',a.locked?1:0);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
