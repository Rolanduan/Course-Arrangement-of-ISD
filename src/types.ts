export type Teacher={id:number;name:string;subject:string;phone?:string}; export type Room={id:number;name:string;capacity:number;type:string};
export type Course={id:number;code:string;name:string;system:string;credits:number;defaultWeeklyHours:number;gradeRange:string;description:string};
export type AdministrativeClass={id:number;code:string;name:string;grade:string;track:string;homeroomTeacherId:number|null};
export type ConcurrentBlock={id:number;code:string;name:string;sectionIds:number[];requiredOccurrences:number;description:string};
export type Section={id:number;courseId:number;code:string;name:string;system:string;teacherId:number;studentIds:number[];weeklyHours:number;capacity:number;color:string};
export type WeekPattern='EVERY_WEEK'|'ODD_WEEK'|'EVEN_WEEK'|'EVERY_3_WEEKS'|'MONTHLY';
export type Allocation={id:number;sectionId:number;day:number;slot:number;duration:number;roomId:number;weekPattern:WeekPattern;locked:boolean};
export type Conflict={type:string;message:string;allocationIds:number[]};
export type Data={teachers:Teacher[];students:{id:number;studentNo:string;name:string;grade:string;classId:number}[];rooms:Room[];courses:Course[];adminClasses:AdministrativeClass[];concurrentBlocks:ConcurrentBlock[];sections:Section[];allocations:Allocation[];conflicts:Conflict[];term:{name:string;version:string;status:string}};
