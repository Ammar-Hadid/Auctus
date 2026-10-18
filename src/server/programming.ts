import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Store } from './db/connection';
import type { Exercise,Program,Template,TemplateExercise,Prescription,Assignment } from '../domain/types';
import { trainingWeek } from '../domain/calendar';
import { name,notes,id,templateInput } from '../domain/validation';
import { requireCondition } from './errors';

export class Programming {
 constructor(public store:Store,public clock=Date.now){}
 get sql(){return this.store.sqlite;}
 exercises(){return this.sql.prepare('SELECT * FROM exercise ORDER BY name COLLATE NOCASE').all() as Exercise[];}
 programs(){return this.sql.prepare('SELECT * FROM program ORDER BY created_at').all() as Program[];}
 templates(){return (this.sql.prepare('SELECT * FROM workout_template ORDER BY created_at').all() as Omit<Template,'exercises'>[]).map(t=>({...t,exercises:(this.sql.prepare('SELECT * FROM template_exercise WHERE template_id=? ORDER BY position').all(t.id) as (TemplateExercise & {id:string})[]).map(e=>({...e,sets:this.sql.prepare('SELECT * FROM template_set WHERE template_exercise_id=? ORDER BY position').all(e.id) as Prescription[]}))}));}
 selected(){return (this.sql.prepare('SELECT selected_program_id FROM settings WHERE id=1').get() as {selected_program_id:string|null}|undefined)?.selected_program_id??null;}
 saveExercise(input:unknown){const v=z.object({id:id.optional(),name,details:notes}).parse(input);const key=v.id??randomUUID();if(v.id){requireCondition(this.exercises().some(e=>e.id===v.id),'Exercise not found.',404);this.sql.prepare('UPDATE exercise SET name=?,details=? WHERE id=?').run(v.name,v.details,key);}else this.sql.prepare('INSERT INTO exercise VALUES (?,?,?,NULL,?)').run(key,v.name,v.details,this.clock());return this.exercises().find(e=>e.id===key)!;}
 saveProgram(input:unknown){const v=z.object({id:id.optional(),name,notes}).parse(input);const key=v.id??randomUUID();if(v.id){requireCondition(this.programs().some(p=>p.id===v.id),'Program not found.',404);this.sql.prepare('UPDATE program SET name=?,notes=? WHERE id=?').run(v.name,v.notes,key);}else this.sql.prepare('INSERT INTO program VALUES (?,?,?,NULL,?)').run(key,v.name,v.notes,this.clock());return this.programs().find(p=>p.id===key)!;}
 saveTemplate(input:unknown){const v=templateInput.parse(input);const key=v.id??randomUUID();return this.sql.transaction(()=>{
  requireCondition(this.programs().some(p=>p.id===v.program_id&&!p.archived_at),'Choose an available program.');
  if(v.id){const prior=this.templates().find(t=>t.id===v.id);requireCondition(prior,'Workout not found.',404);requireCondition(prior.version===v.version,'This workout changed. Reload before saving.',409);requireCondition(!prior.archived_at,'Archived workouts cannot be edited.');this.sql.prepare('UPDATE workout_template SET name=?,notes=?,version=version+1 WHERE id=?').run(v.name,v.notes,key);this.sql.prepare('DELETE FROM template_exercise WHERE template_id=?').run(key);}
  else this.sql.prepare('INSERT INTO workout_template VALUES (?,?,?,?,NULL,0,?)').run(key,v.program_id,v.name,v.notes,this.clock());
  v.exercises.forEach((e,position)=>{requireCondition(this.exercises().some(x=>x.id===e.exercise_id),'Exercise not found.');const eid=randomUUID();this.sql.prepare('INSERT INTO template_exercise VALUES (?,?,?,?)').run(eid,key,e.exercise_id,position);e.sets.forEach((s,i)=>this.sql.prepare('INSERT INTO template_set VALUES (?,?,?,?,?,?,?)').run(randomUUID(),eid,i,s.type,s.target_reps,s.target_grams,s.rest_ms));});
  return this.templates().find(t=>t.id===key)!;
 }).immediate();}
 selectProgram(programId:string|null){if(programId!==null)requireCondition(this.programs().some(p=>p.id===programId&&!p.archived_at),'Choose an available program.');this.sql.transaction(()=>{this.sql.prepare('INSERT INTO settings (id,selected_program_id) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET selected_program_id=excluded.selected_program_id').run(programId);this.applySchedule();}).immediate();return {ok:true};}
 applySchedule(){const selected=this.selected();const ids=this.templates().filter(t=>t.program_id===selected&&!t.archived_at).map(t=>t.id);this.sql.prepare('INSERT INTO schedule_event VALUES (?,?,?)').run(randomUUID(),this.clock(),JSON.stringify(ids));return this.availability();}
 archive(kind:'exercise'|'program'|'template',key:string){const table={exercise:'exercise',program:'program',template:'workout_template'}[kind];requireCondition(table,'Unknown archive type.');return this.sql.transaction(()=>{const result=this.sql.prepare(`UPDATE ${table} SET archived_at=? WHERE id=?`).run(this.clock(),key);requireCondition(result.changes,'Record not found.',404);if(kind==='program'&&this.selected()===key)this.selectProgram(null);if(kind==='template')this.applySchedule();return {ok:true};}).immediate();}
 availability(at=this.clock()){
  const week=trainingWeek(at);
  return this.sql.transaction(()=>{
   this.sql.prepare('INSERT OR IGNORE INTO training_week VALUES (?,?,?)').run(week.id,week.start,week.end);
   const events=this.sql.prepare('SELECT template_ids FROM schedule_event WHERE effective_at<? ORDER BY effective_at DESC,rowid DESC LIMIT 1').get(Math.min(at+1,week.end)) as {template_ids:string}|undefined;
   const ids:string[]=events?JSON.parse(events.template_ids):[];
   for(const key of ids){const t=this.sql.prepare('SELECT name FROM workout_template WHERE id=?').get(key) as {name:string}|undefined;if(t)this.sql.prepare('INSERT INTO weekly_assignment VALUES (?,?,?,?,NULL) ON CONFLICT(week_id,template_id) DO UPDATE SET withdrawn_at=NULL').run(randomUUID(),week.id,key,t.name);}
   const assignments=this.sql.prepare('SELECT *,0 AS completed FROM weekly_assignment WHERE week_id=?').all(week.id) as Assignment[];
   for(const a of assignments)if(!ids.includes(a.template_id)&&a.withdrawn_at===null)this.sql.prepare('UPDATE weekly_assignment SET withdrawn_at=? WHERE id=?').run(at,a.id);
   return {week,assignments:this.sql.prepare('SELECT *,0 AS completed FROM weekly_assignment WHERE week_id=? ORDER BY rowid').all(week.id) as Assignment[]};
  }).immediate();
 }
}
