import type { Pause,Rest,WorkoutDetail } from './types';
export function elapsed(start:number,end:number,pauses:Pause[]){return Math.max(0,end-start-pauses.reduce((total,p)=>total+Math.max(0,Math.min(end,p.ended_at??end)-Math.max(start,p.started_at)),0));}
export function activeDuration(workout:WorkoutDetail,now:number){return elapsed(workout.started_at,workout.ended_at??now,workout.pauses);}
export function restDuration(rest:Rest,pauses:Pause[],now:number){return elapsed(rest.started_at,rest.ended_at??now,pauses);}
export function durationLabel(ms:number){const seconds=Math.floor(Math.max(0,ms)/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
