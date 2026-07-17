export type WeekPattern = 'EVERY_WEEK'|'ODD_WEEK'|'EVEN_WEEK'|'EVERY_3_WEEKS'|'MONTHLY';
export type Allocation = { id: number; sectionId: number; day: number; slot: number; duration: number; roomId: number; weekPattern: WeekPattern; locked: boolean };
export type Course = { id: number; code: string; name: string; system: string; credits: number; defaultWeeklyHours: number; gradeRange: string; description: string };
export type AdministrativeClass = { id: number; code: string; name: string; grade: string; track: string; homeroomTeacherId: number|null };
export type ConcurrentBlock = { id: number; code: string; name: string; sectionIds: number[]; requiredOccurrences: number; description: string };
export type Section = { id: number; courseId: number; code: string; name: string; system: string; teacherId: number; studentIds: number[]; weeklyHours: number; capacity: number; color: string };
export type Room = { id: number; name: string; capacity: number; type: string };
export type Teacher = { id: number; name: string; subject: string; phone?: string };

export type Conflict = { type: 'TEACHER'|'STUDENT'|'ROOM'|'CAPACITY'; message: string; allocationIds: number[] };

const activeWeeks=(pattern?:WeekPattern)=>{const weeks=Array.from({length:20},(_,i)=>i+1);if(pattern==='ODD_WEEK')return weeks.filter(w=>w%2===1);if(pattern==='EVEN_WEEK')return weeks.filter(w=>w%2===0);if(pattern==='EVERY_3_WEEKS')return weeks.filter(w=>(w-1)%3===0);if(pattern==='MONTHLY')return weeks.filter(w=>(w-1)%4===0);return weeks;};
export function patternsOverlap(a?:WeekPattern,b?:WeekPattern){const right=new Set(activeWeeks(b));return activeWeeks(a).some(w=>right.has(w));}
export function overlap(a: Allocation, b: Allocation) {
  return a.day === b.day && a.slot < b.slot + b.duration && b.slot < a.slot + a.duration && patternsOverlap(a.weekPattern,b.weekPattern);
}

export function validateAllocations(allocations: Allocation[], sections: Section[], rooms: Room[], teachers: Teacher[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const sectionById = new Map(sections.map(s => [s.id, s]));
  const roomById = new Map(rooms.map(r => [r.id, r]));
  const teacherById = new Map(teachers.map(t => [t.id, t]));
  for (const a of allocations) {
    const section = sectionById.get(a.sectionId)!;
    const room = roomById.get(a.roomId)!;
    if (section && room && section.studentIds.length > room.capacity) conflicts.push({ type: 'CAPACITY', message: `${section.name}（${section.studentIds.length}人）超过${room.name}容量（${room.capacity}人）`, allocationIds: [a.id] });
  }
  for (let i = 0; i < allocations.length; i++) for (let j = i + 1; j < allocations.length; j++) {
    const a = allocations[i], b = allocations[j]; if (!overlap(a, b)) continue;
    const sa = sectionById.get(a.sectionId)!, sb = sectionById.get(b.sectionId)!;
    if (sa.teacherId === sb.teacherId) conflicts.push({ type: 'TEACHER', message: `${teacherById.get(sa.teacherId)?.name}同时承担“${sa.name}”和“${sb.name}”`, allocationIds: [a.id,b.id] });
    if (a.roomId === b.roomId) conflicts.push({ type: 'ROOM', message: `${roomById.get(a.roomId)?.name}被两个教学班同时使用`, allocationIds: [a.id,b.id] });
    const shared = sa.studentIds.filter(id => sb.studentIds.includes(id));
    if (shared.length) conflicts.push({ type: 'STUDENT', message: `${shared.length}名学生的“${sa.name}”与“${sb.name}”冲突`, allocationIds: [a.id,b.id] });
  }
  return conflicts;
}

export function validateConcurrentBlocks(allocations: Allocation[], sections: Section[], blocks: ConcurrentBlock[]): Conflict[] {
  const conflicts: Conflict[]=[]; const sectionById=new Map(sections.map(s=>[s.id,s]));
  for(const block of blocks){
    const keysBySection=block.sectionIds.map(id=>new Set(allocations.filter(a=>a.sectionId===id).map(a=>`${a.day}:${a.slot}:${a.duration}:${a.weekPattern||'EVERY_WEEK'}`)));
    const shared=keysBySection.length?[...keysBySection[0]].filter(k=>keysBySection.every(set=>set.has(k))):[];
    if(shared.length<(block.requiredOccurrences||1)){
      const names=block.sectionIds.map(id=>sectionById.get(id)?.name).filter(Boolean).join('、');
      conflicts.push({type:'CONCURRENT' as any,message:`同步开课组“${block.name}”尚未同步：${names}`,allocationIds:allocations.filter(a=>block.sectionIds.includes(a.sectionId)).map(a=>a.id)});
    }
  }
  return conflicts;
}
