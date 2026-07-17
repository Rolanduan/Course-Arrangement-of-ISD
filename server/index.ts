import express from 'express'; import cors from 'cors';
import { db, entities, allocations, saveEntity, deleteEntity, writeAudit, readAudits, readAudit, backfillAuditSnapshots, restoreSnapshot } from './db.js'; import { validateAllocations, validateConcurrentBlocks, type Course, type Section, type Room, type Teacher, type AdministrativeClass, type ConcurrentBlock } from './domain.js';
const app=express(); app.use(cors()); app.use(express.json());
const validSlotSpan=(slot:number,duration:number)=>duration>=1&&((slot===1&&duration===1)||(slot>=2&&slot<=6&&slot+duration-1<=6)||(slot>=7&&slot<=10&&slot+duration-1<=10)||(slot===11&&duration===1));
const model=()=>({teachers:entities<Teacher>('teacher'),students:entities<any>('student'),rooms:entities<Room>('room'),courses:entities<Course>('course'),adminClasses:entities<AdministrativeClass>('adminClass'),concurrentBlocks:entities<ConcurrentBlock>('concurrentBlock'),sections:entities<Section>('section'),allocations:allocations()});
backfillAuditSnapshots(model());
app.use('/api',(req,res,next)=>{
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
  const before=model();
  let responseBody:any;const send=res.json.bind(res);res.json=(body:any)=>{responseBody=body;return send(body)};
  res.on('finish',()=>{if(res.statusCode>=400)return;const action=req.path.includes('/rollback')?'版本回退':req.method==='DELETE'?'删除':req.path.includes('/move')?'移动课位':req.path.includes('/batch')?'批量操作':req.body?.id?'修改':'新增';const name=req.body?.name||responseBody?.name||responseBody?.allocation?.id||'';writeAudit({actorIp:String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown'),action,resource:req.path,summary:`${action}${name?`：${name}`:''}`,before,after:model(),request:req.body});});
  next();
});
app.get('/api/audit-logs',(req,res)=>res.json(readAudits(Number(req.query.limit)||200)));
app.post('/api/audit-logs/:id/rollback',(req,res)=>{const log=readAudit(Number(req.params.id));if(!log)return res.status(404).json({message:'协作记录不存在'});const snapshot=JSON.parse(log.beforeJson||'null');if(!snapshot?.teachers||!snapshot?.allocations)return res.status(409).json({message:'该记录没有可恢复的完整快照'});restoreSnapshot(snapshot);res.json({ok:true,restoredFrom:log.id,restoredAt:new Date().toISOString()});});
app.get('/api/bootstrap',(_req,res)=>{ const data=model(); const conflicts=[...validateAllocations(data.allocations,data.sections,data.rooms,data.teachers),...validateConcurrentBlocks(data.allocations,data.sections,data.concurrentBlocks)]; res.json({...data,conflicts,term:{name:'2026—2027学年 第一学期',version:'初稿 V1',status:'DRAFT'}}); });
app.get('/api/health',(_req,res)=>res.json({status:'ok',service:'scheduler-api'}));
app.post('/api/allocations',(req,res)=>{
  const data=model(), sectionId=Number(req.body.sectionId), roomId=Number(req.body.roomId), day=Number(req.body.day), slot=Number(req.body.slot), duration=Number(req.body.duration||1), weekPattern=String(req.body.weekPattern||'EVERY_WEEK');
  const allowedPatterns=['EVERY_WEEK','ODD_WEEK','EVEN_WEEK','EVERY_3_WEEKS','MONTHLY'];
  if(!data.sections.some(s=>s.id===sectionId)) return res.status(400).json({message:'请选择有效的教学班'});
  if(!data.rooms.some(r=>r.id===roomId)) return res.status(400).json({message:'请选择有效的教室'});
  if(day<1||day>5||!validSlotSpan(slot,duration)) return res.status(400).json({message:'课位超出教学时段，或连堂跨越了大课间、午休、晚间时段'});
  if(!allowedPatterns.includes(weekPattern)) return res.status(400).json({message:'无效的课程轮次'});
  const id=Number((db.prepare('SELECT COALESCE(MAX(id),0)+1 id FROM allocations').get() as any).id), candidate={id,sectionId,day,slot,duration,roomId,weekPattern:weekPattern as any,locked:false};
  const next=[...data.allocations,candidate], conflicts=[...validateAllocations(next,data.sections,data.rooms,data.teachers),...validateConcurrentBlocks(next,data.sections,data.concurrentBlocks)].filter(c=>c.allocationIds.includes(id));
  if(conflicts.length) return res.status(409).json({message:'新增课位未通过约束校验',conflicts});
  db.prepare('INSERT INTO allocations(id,section_id,day,slot,duration,room_id,week_pattern,locked) VALUES(?,?,?,?,?,?,?,0)').run(id,sectionId,day,slot,duration,roomId,weekPattern);
  res.status(201).json({allocation:candidate,conflicts:[]});
});
app.delete('/api/allocations/:id',(req,res)=>{const result=db.prepare('DELETE FROM allocations WHERE id=?').run(Number(req.params.id));res.json({ok:true,deleted:Number(result.changes)});});
type DeletableKind='course'|'section'|'adminClass'|'concurrentBlock'|'student'|'teacher'|'room';
function cascadeDelete(kind:DeletableKind,id:number,deleted:{kind:string;id:number}[]){
  const removeSection=(sectionId:number)=>{db.prepare('DELETE FROM allocations WHERE section_id=?').run(sectionId);for(const block of entities<any>('concurrentBlock')){const sectionIds=block.sectionIds.filter((x:number)=>x!==sectionId);if(sectionIds.length<2){deleteEntity('concurrentBlock',block.id);deleted.push({kind:'concurrentBlock',id:block.id});}else if(sectionIds.length!==block.sectionIds.length)saveEntity('concurrentBlock',{...block,sectionIds});}deleteEntity('section',sectionId);deleted.push({kind:'section',id:sectionId});};
  if(kind==='course')for(const section of entities<Section>('section').filter(s=>s.courseId===id))removeSection(section.id);
  if(kind==='section')removeSection(id);
  if(kind==='teacher'){for(const section of entities<Section>('section').filter(s=>s.teacherId===id))removeSection(section.id);for(const cls of entities<any>('adminClass').filter(c=>c.homeroomTeacherId===id))saveEntity('adminClass',{...cls,homeroomTeacherId:null});}
  if(kind==='adminClass'){const studentIds=entities<any>('student').filter(s=>s.classId===id).map(s=>s.id);for(const section of entities<Section>('section'))if(section.studentIds.some(x=>studentIds.includes(x)))saveEntity('section',{...section,studentIds:section.studentIds.filter(x=>!studentIds.includes(x))});for(const studentId of studentIds){deleteEntity('student',studentId);deleted.push({kind:'student',id:studentId});}}
  if(kind==='student')for(const section of entities<Section>('section'))if(section.studentIds.includes(id))saveEntity('section',{...section,studentIds:section.studentIds.filter(x=>x!==id)});
  if(kind==='room')db.prepare('DELETE FROM allocations WHERE room_id=?').run(id);
  if(kind!=='section'){deleteEntity(kind,id);deleted.push({kind,id});}
}
app.post('/api/batch-delete',(req,res)=>{const kind=String(req.body?.kind||'') as DeletableKind, ids:number[]=[...new Set<number>((Array.isArray(req.body?.ids)?req.body.ids:[]).map(Number).filter(Number.isInteger))];if(!['course','teacher','student','room'].includes(kind))return res.status(400).json({message:'该类型不支持批量删除'});if(!ids.length)return res.status(400).json({message:'没有选择要删除的数据'});const deleted:{kind:string;id:number}[]=[];const started=Date.now();db.exec('BEGIN');try{for(const id of ids)cascadeDelete(kind,id,deleted);db.exec('COMMIT');res.json({ok:true,requested:ids.length,deleted:deleted.length,durationMs:Date.now()-started});}catch(error){db.exec('ROLLBACK');throw error;}});
for (const kind of ['course','section','adminClass','concurrentBlock','student','teacher','room'] as const) {
  app.post(`/api/${kind}s`,(req,res)=>{
    const body=req.body||{}; if(!String(body.name||'').trim()||(!['student','teacher','room'].includes(kind)&&!String(body.code||'').trim())) return res.status(400).json({message:'名称和代码不能为空'});
    if(kind==='room'&&(!Number(body.capacity)||Number(body.capacity)<1)) return res.status(400).json({message:'教室容量必须大于0'});
    if(kind==='section'&&(!Number(body.courseId)||!Number(body.teacherId))) return res.status(400).json({message:'教学班必须选择课程和教师'});
    if(kind==='concurrentBlock'&&(!Array.isArray(body.sectionIds)||body.sectionIds.length<2)) return res.status(400).json({message:'同步开课组至少需要选择两个教学班'});
    const duplicate=body.code&&entities<any>(kind).find(x=>x.code===body.code&&x.id!==body.id); if(duplicate) return res.status(409).json({message:'代码已存在'});
    res.status(body.id?200:201).json(saveEntity(kind,body));
  });
  app.delete(`/api/${kind}s/:id`,(req,res)=>{
    const id=Number(req.params.id), deleted:{kind:string;id:number}[]=[];db.exec('BEGIN');try{cascadeDelete(kind,id,deleted);db.exec('COMMIT');res.json({ok:true,deleted});}catch(error){db.exec('ROLLBACK');throw error;}
  });
}
for(const kind of ['student','teacher'] as const) app.post(`/api/${kind}s/batch`,(req,res)=>{
  const records=Array.isArray(req.body?.records)?req.body.records:[]; if(!records.length) return res.status(400).json({message:'没有可导入的数据'});
  const classes=entities<any>('adminClass'); const existing=entities<any>(kind); const errors:string[]=[];
  const normalized=records.map((raw:any,index:number)=>{
    const row=index+2; if(!String(raw.name||'').trim()) errors.push(`第${row}行：姓名不能为空`);
    if(kind==='student'){
      const cls=classes.find(c=>c.code===raw.classCode||c.name===raw.className||c.name===raw.classCode); if(!cls) errors.push(`第${row}行：找不到行政班 ${raw.classCode||raw.className||''}`);
      const studentNo=String(raw.studentNo||'').trim(); if(studentNo&&(existing.some(x=>x.studentNo===studentNo)||records.slice(0,index).some((x:any)=>x.studentNo===studentNo))) errors.push(`第${row}行：学号 ${studentNo} 已存在`);
      return {studentNo:studentNo||`S${Date.now()}${index}`,name:String(raw.name||'').trim(),classId:cls?.id||0,grade:cls?.grade||''};
    }
    return {name:String(raw.name||'').trim(),subject:String(raw.subject||'').trim(),phone:String(raw.phone||'').trim()};
  });
  if(errors.length) return res.status(400).json({message:'导入校验未通过',errors});
  db.exec('BEGIN'); try{const saved=normalized.map((x:any)=>saveEntity(kind,x));db.exec('COMMIT');res.status(201).json({count:saved.length,records:saved});}catch(error){db.exec('ROLLBACK');throw error;}
});
app.post('/api/allocations/:id/move',(req,res)=>{
  const id=Number(req.params.id), current=db.prepare('SELECT * FROM allocations WHERE id=?').get(id) as any; if(!current) return res.status(404).json({message:'课次不存在'});
  if(current.locked) return res.status(409).json({message:'该课次已锁定，不能移动'});
  const allowedPatterns=['EVERY_WEEK','ODD_WEEK','EVEN_WEEK','EVERY_3_WEEKS','MONTHLY']; const weekPattern=String(req.body.weekPattern||current.week_pattern||'EVERY_WEEK');
  if(!allowedPatterns.includes(weekPattern)) return res.status(400).json({message:'无效的课程轮次'});
  const candidate={id,sectionId:current.section_id,day:Number(req.body.day),slot:Number(req.body.slot),duration:current.duration,roomId:Number(req.body.roomId??current.room_id),weekPattern:weekPattern as any,locked:false};
  if(candidate.day<1||candidate.day>5||!validSlotSpan(candidate.slot,candidate.duration)) return res.status(400).json({message:'目标时间超出教学时段，或连堂跨越了大课间、午休、晚间时段'});
  const data=model(), next=data.allocations.map(a=>a.id===id?candidate:a), conflicts=[...validateAllocations(next,data.sections,data.rooms,data.teachers),...validateConcurrentBlocks(next,data.sections,data.concurrentBlocks)].filter(c=>c.allocationIds.includes(id));
  if(conflicts.length) return res.status(409).json({message:'后端权威校验未通过',conflicts});
  db.prepare('UPDATE allocations SET day=?,slot=?,room_id=?,week_pattern=? WHERE id=?').run(candidate.day,candidate.slot,candidate.roomId,candidate.weekPattern,id); res.json({allocation:candidate,conflicts:[]});
});
app.post('/api/allocations/:id/toggle-lock',(req,res)=>{ const id=Number(req.params.id); db.prepare('UPDATE allocations SET locked=CASE locked WHEN 1 THEN 0 ELSE 1 END WHERE id=?').run(id); res.json({ok:true}); });
app.post('/api/versions',(req,res)=>{ const data=model(), now=new Date().toISOString(); const result=db.prepare('INSERT INTO schedule_versions(name,status,snapshot,created_at) VALUES(?,?,?,?)').run(req.body.name||`课表快照 ${now.slice(0,16)}`,'DRAFT',JSON.stringify(data.allocations),now); res.status(201).json({id:Number(result.lastInsertRowid),createdAt:now}); });
app.get('/api/versions',(_req,res)=>res.json(db.prepare('SELECT id,name,status,created_at createdAt FROM schedule_versions ORDER BY id DESC').all()));
app.listen(3100,'0.0.0.0',()=>console.log('Scheduler API: http://0.0.0.0:3100'));
