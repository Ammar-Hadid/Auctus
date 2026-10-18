'use client';
import { useState } from 'react';
import { LayoutDashboard,Dumbbell,Layers,History,Settings as SettingsIcon,ArrowUpRight } from 'lucide-react';
import type { State } from '@/domain/types';
import { useModel } from './use-model';
import { ActiveWorkout } from './workout/active-workout';
import { Dashboard } from './dashboard';
import { Library } from './programming/library';
import { Programs } from './programming/programs';
import { Settings } from './settings';
const nav=[{id:'dashboard',label:'Overview',icon:LayoutDashboard},{id:'programs',label:'Programs',icon:Layers},{id:'library',label:'Library',icon:Dumbbell},{id:'history',label:'History',icon:History}];
export function App({initial}:{initial:State}){
 const model=useModel(initial);const [view,setView]=useState('dashboard');
 const navigate=(v:string)=>{setView(v);window.scrollTo({top:0,behavior:'instant'});};
 return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={()=>navigate('dashboard')}>AUCTUS<span>/</span></button><p className="brand-caption">A little stronger, every day.</p><nav aria-label="Main navigation">{nav.map(n=><button key={n.id} className={view===n.id?'nav-item selected':'nav-item'} onClick={()=>navigate(n.id)}><n.icon size={19}/>{n.label}</button>)}</nav><div className="sidebar-bottom"><div className="private-label"><span/>Your private training space</div><button className={view==='settings'?'nav-item selected':'nav-item'} onClick={()=>navigate('settings')}><SettingsIcon size={19}/>Settings</button></div></aside><div className="app-content"><header className="topbar"><span>TRAINING JOURNAL <span className="muted">/</span> {view.toUpperCase()}</span><button className="small ghost" onClick={()=>navigate('settings')} aria-label="Account settings">Personal<ArrowUpRight size={14}/></button></header><main>
 {model.offline&&<div className="notice" role="status">Offline · Changes cannot be confirmed saved. Reconnect to continue.</div>}
 {model.error&&<div className="error" role="alert">{model.error} <a href="/login" target="_blank" rel="noreferrer">Sign in</a></div>}
 {model.pending&&!model.busy&&<div className="notice stack"><p>One action has an unconfirmed result. Retrying the same request cannot save it twice.</p><div className="row"><button onClick={model.retry}>Retry save</button><button onClick={model.discard}>Discard local request & refresh</button></div></div>}
 <fieldset disabled={model.busy} className="app-fields" aria-busy={model.busy}>
 {view==='dashboard'&&<Dashboard state={model.state} send={model.send} navigate={navigate}/>}
 {view==='library'&&<Library exercises={model.state.exercises} send={model.send} onProgress={()=>navigate('history')}/>}
 {view==='programs'&&<Programs state={model.state} send={model.send}/>}
 {view==='workout'&&model.state.activeWorkout&&<ActiveWorkout state={model.state} send={model.send} finished={()=>navigate('dashboard')}/>}
 {view==='settings'&&<Settings/>}
 </fieldset>{model.busy&&<div className="save-indicator" role="status">Saving to your journal…</div>}
 </main><footer className="app-footer">AUCTUS <span>Consistency compounds.</span></footer></div><nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(n=><button key={n.id} className={view===n.id?'selected':''} onClick={()=>navigate(n.id)}><n.icon size={20}/><span>{n.label}</span></button>)}</nav></div>;
}
