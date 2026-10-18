import type { Store } from './db/connection';
import type { State } from '../domain/types';
import { Programming } from './programming';
import { Sessions } from './sessions';
import { summarize } from '../domain/metrics';
import { trainingWeek } from '../domain/calendar';
export function readState(store:Store,now=Date.now()):State{
 const p=new Programming(store,()=>now);const {week,assignments}=p.availability();const all=new Sessions(store).all();
 const mapping=store.sqlite.prepare('SELECT id,week_id FROM weekly_assignment').all() as {id:string;week_id:string}[];
 const weekFor=(id:string)=>mapping.find(a=>a.id===id)?.week_id;
 const previousWeek=trainingWeek(week.start-1);
 return {serverNow:now,exercises:p.exercises(),programs:p.programs(),templates:p.templates(),selectedProgramId:p.selected(),week,assignments:assignments.map(a=>({...a,completed:all.filter(w=>w.assignment_id===a.id&&w.status==='completed').length})),activeWorkout:all.find(w=>w.status==='active'||w.status==='paused')??null,history:all.filter(w=>w.status==='completed'||w.status==='abandoned'),current:summarize(all.filter(w=>weekFor(w.assignment_id)===week.id)),previous:summarize(all.filter(w=>weekFor(w.assignment_id)===previousWeek.id))};
}
