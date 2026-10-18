import { describe,it,expect } from 'vitest';
import { openDatabase } from '../src/server/db/connection';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import { editHistory } from '../src/server/history';
import { summarize,estimatedMax } from '../src/domain/metrics';

describe('historical corrections and metrics',()=>{
 it('recalculates volume and records after edits, rolls invalid timing back and never creates live rest',()=>{
  const store=openDatabase(':memory:');let now=Date.parse('2026-10-18T12:00Z');const clock=()=>now;const p=new Programming(store,clock);const e=p.saveExercise({name:'Row'});const program=p.saveProgram({name:'A'});p.saveTemplate({program_id:program.id,name:'A',exercises:[{exercise_id:e.id,sets:[{type:'normal',target_grams:10000,target_reps:10,rest_ms:60000}]}]});p.selectProgram(program.id);const s=new Sessions(store,clock);let w=s.start(p.availability().assignments[0].id,false);const ex=w.exercises[0],set=ex.sets[0];
  const act=(action:string,extra:Record<string,unknown>={})=>{w=s.act({workout_id:w.id,version:w.version,action,...extra});};
  act('exercise.start',{id:ex.id});act('set.start',{id:set.id});now+=10000;act('set.complete',{id:set.id,actual_reps:10,actual_grams:10000});now+=60000;act('exercise.complete',{id:ex.id});act('workout.complete');
  expect(summarize([w]).volume).toBe(100);
  editHistory(store,{workout_id:w.id,version:w.version,kind:'set',id:set.id,status:'completed',actual_reps:8,actual_grams:20000,type:'normal',started_at:set.started_at??w.started_at,ended_at:w.started_at+10000,notes:'Corrected'});
  w=s.get(w.id);expect(summarize([w]).volume).toBe(160);expect(w.rests).toHaveLength(1);expect(w.rests[0].ended_at).not.toBeNull();
  expect(()=>editHistory(store,{workout_id:w.id,version:w.version,kind:'set',id:set.id,status:'completed',actual_reps:8,actual_grams:20000,type:'normal',started_at:w.started_at-1,ended_at:w.started_at+10000,notes:''})).toThrow();expect(s.get(w.id).version).toBe(w.version);
  p.saveExercise({id:e.id,name:'Renamed row'});p.archive('exercise',e.id);expect(s.get(w.id).exercises[0].name).toBe('Row');store.sqlite.close();
 });
 it('labels estimated one-rep max and restricts the estimate range',()=>{expect(estimatedMax(100,1)).toBe(100);expect(estimatedMax(100,10)).toBeCloseTo(133.33,2);expect(estimatedMax(100,11)).toBeNull();expect(estimatedMax(0,8)).toBeNull();});
});
