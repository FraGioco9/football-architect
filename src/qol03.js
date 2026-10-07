// QOL03: presentation preferences live outside the authoritative career save.
// Do not write preference fields to world / advancedV1 or alter the simulation.
import {ATTRIBUTE_BY_KEY} from './addons/domain/player-attributes.mjs';
const PREFIX='football-architect:qol03:';
export const WIDGETS=['kpis','fixtures','results'];
export const PAGES=['dashboard','club','squad','calendar','league','world','market','training','youth','finance','board','manager','inbox','settings'];
export const DEFAULT_PREFS=Object.freeze({version:1,widgets:[...WIDGETS],hidden:[],tables:{},mailFilter:'all',mailArchived:[],mailNotes:{},rosterAttribute:'ALL',rosterMinimum:1});
export function normalizePrefs(value){
 const p=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const widgets=[...new Set((Array.isArray(p.widgets)?p.widgets:[]).filter(x=>WIDGETS.includes(x)))];
 for(const key of WIDGETS)if(!widgets.includes(key))widgets.push(key);
 const hidden=[...new Set((Array.isArray(p.hidden)?p.hidden:[]).filter(x=>WIDGETS.includes(x)))];
 const tables={};for(const [key,v] of Object.entries(p.tables&&typeof p.tables==='object'?p.tables:{})){
   if(!/^[a-z0-9:-]{1,60}$/i.test(key)||!v||typeof v!=='object')continue;
   tables[key]={query:String(v.query||'').slice(0,100),sort:Number.isInteger(v.sort)&&v.sort>=0&&v.sort<30?v.sort:null,desc:!!v.desc,sort2:Number.isInteger(v.sort2)&&v.sort2>=0&&v.sort2<30?v.sort2:null,page:Number.isInteger(v.page)?Math.max(0,Math.min(v.page,1000)):0};
 }
 const mailNotes={};for(const [id,note] of Object.entries(p.mailNotes&&typeof p.mailNotes==='object'?p.mailNotes:{}).slice(-200)){if(/^[-a-zA-Z0-9_:.]{1,80}$/.test(id))mailNotes[id]=String(note).slice(0,500);}
 return {version:1,widgets,hidden,tables,mailNotes,mailFilter:['all','todo','unread','archived'].includes(p.mailFilter)?p.mailFilter:'all',mailArchived:[...new Set((Array.isArray(p.mailArchived)?p.mailArchived:[]).filter(x=>['string','number'].includes(typeof x)).map(String))].slice(-2000),rosterAttribute:Object.hasOwn(ATTRIBUTE_BY_KEY,p.rosterAttribute)?p.rosterAttribute:'ALL',rosterMinimum:[1,40,50,60,70,80,90].includes(p.rosterMinimum)?p.rosterMinimum:1};
}
export function readPrefs(storage,scope='global'){
 try{return normalizePrefs(JSON.parse(storage.getItem(PREFIX+scope)||'null'));}catch{return normalizePrefs(null);}
}
export function writePrefs(storage,scope,prefs){
 const next=normalizePrefs(prefs);try{storage.setItem(PREFIX+scope,JSON.stringify(next));return true;}catch{return false;}
}
export function moveWidget(prefs,key,direction){
 const out=normalizePrefs(prefs),index=out.widgets.indexOf(key),destination=index+direction;
 if(index>=0&&destination>=0&&destination<out.widgets.length)[out.widgets[index],out.widgets[destination]]=[out.widgets[destination],out.widgets[index]];
 return out;
}
export function dashboardControls(prefs,lang='it'){
 const en=lang==='en',names={kpis:en?'Key indicators':'Indicatori',fixtures:en?'Fixtures and standings':'Calendario e classifica',results:en?'Results and news':'Risultati e notizie'};
 return `<section class="qol03-toolbar" aria-label="${en?'Dashboard layout':'Personalizzazione dashboard'}"><h2>${en?'Your dashboard':'La tua scrivania'}</h2><div class="qol03-widget-controls">${prefs.widgets.map((key,i)=>`<div class="qol03-widget-choice"><label><input data-qol03-widget="${key}" type="checkbox" ${prefs.hidden.includes(key)?'':'checked'}> ${names[key]}</label><button class="btn btn-quiet" type="button" data-action="qol03-widget-up" data-id="${key}" ${i===0?'disabled':''} aria-label="${en?'Move up':'Sposta su'}: ${names[key]}">↑</button><button class="btn btn-quiet" type="button" data-action="qol03-widget-down" data-id="${key}" ${i===prefs.widgets.length-1?'disabled':''} aria-label="${en?'Move down':'Sposta giù'}: ${names[key]}">↓</button></div>`).join('')}</div></section>`;
}
export function filterMails(messages,prefs,requiresInput=()=>false){
 const archived=new Set((prefs.mailArchived||[]).map(String)),filter=prefs.mailFilter||'all';
 return messages.filter(m=>{
  const isArchived=archived.has(String(m.id));
  if(filter==='archived')return isArchived;
  if(isArchived)return false;
  if(filter==='todo')return requiresInput(m);
  if(filter==='unread')return !m.read;
  return true;
 });
}
export function inboxControls(prefs,lang='it',todoCount=0){
 const en=lang==='en',filter=prefs.mailFilter||'all';
 const button=(value,label)=>`<button type="button" class="chip ${filter===value?'chip-active':''}" data-action="qol03-mail-filter" data-value="${value}" aria-pressed="${filter===value}">${label}</button>`;
 return `<div class="inbox-filterbar" role="group" aria-label="${en?'Message filters':'Filtri posta'}"><div class="inbox-filter-primary">${button('all',en?'All':'Tutte')}${button('todo',`${en?'To do':'Da fare'}${todoCount?` (${todoCount})`:''}`)}${button('unread',en?'Unread':'Non lette')}</div>${button('archived',en?'Archive':'Archivio')}</div>`;
}
export function mailActionLabel(kind,lang='it'){const en=lang==='en';return ({transfer:en?'Negotiate':'Tratta',scouting:en?'Scout':'Osserva',board:en?'Review contract':'Esamina rinnovo',match:en?'View match':'Consulta partita',training:en?'Review training':'Consulta allenamento',medical:en?'Review player':'Consulta calciatore',finance:en?'Review finances':'Consulta finanze'})[kind]||(en?'Open related page':'Apri sezione collegata');}
export function mailDestination(kind){if(kind==='transfer')return 'market';if(kind==='training')return 'training';if(kind==='medical')return 'squad';if(kind==='match')return 'calendar';if(kind==='scouting')return 'market';if(kind==='finance')return 'finance';if(kind==='board')return 'board';return 'inbox';}
export 
