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
 return {version:1,widgets,hidden,tables,mailNotes,mailFilter:['all','unread','archived'].includes(p.mailFilter)?p.mailFilter:'all',mailArchived:[...new Set((Array.isArray(p.mailArchived)?p.mailArchived:[]).filter(x=>['string','number'].includes(typeof x)).map(String))].slice(-2000),rosterAttribute:Object.hasOwn(ATTRIBUTE_BY_KEY,p.rosterAttribute)?p.rosterAttribute:'ALL',rosterMinimum:[1,40,50,60,70,80,90].includes(p.rosterMinimum)?p.rosterMinimum:1};
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
export function filterMails(messages,prefs){return messages.filter(m=>prefs.mailFilter==='archived'?prefs.mailArchived.includes(String(m.id)):prefs.mailFilter==='unread'?!m.read&&!prefs.mailArchived.includes(String(m.id)):!prefs.mailArchived.includes(String(m.id)));}
export function inboxControls(prefs,lang='it'){
 const en=lang==='en';return `<div class="qol03-toolbar"><label for="qol03-mail-filter">${en?'Messages':'Messaggi'}</label><select id="qol03-mail-filter" aria-label="${en?'Message filter':'Filtro posta'}">${[['all',en?'Inbox':'Ricevuti'],['unread',en?'Unread':'Non letti'],['archived',en?'Archived':'Archivio']].map(([val,label])=>`<option value="${val}" ${prefs.mailFilter===val?'selected':''}>${label}</option>`).join('')}</select></div>`;
}
export function mailActionLabel(kind,lang='it'){const en=lang==='en';return ({transfer:en?'Negotiate':'Tratta',scouting:en?'Scout':'Osserva',board:en?'Review contract':'Esamina rinnovo',match:en?'View match':'Consulta partita',training:en?'Review training':'Consulta allenamento',medical:en?'Review player':'Consulta calciatore',finance:en?'Review finances':'Consulta finanze'})[kind]||(en?'Open related page':'Apri sezione collegata');}
export function mailDestination(kind){if(kind==='transfer')return 'market';if(kind==='training')return 'training';if(kind==='medical')return 'squad';if(kind==='match')return 'calendar';if(kind==='scouting')return 'market';if(kind==='finance')return 'finance';if(kind==='board')return 'board';return 'inbox';}
export function tableCompare(a,b){
 const parse=s=>String(s??'').trim().replace(/\s+/g,' '),num=s=>{const cleaned=parse(s).replace(/[^\d,.+\-]/g,'');const n=Number(cleaned.replace(/\./g,'').replace(',','.'));return cleaned&&Number.isFinite(n)?n:null;};
 const an=num(a),bn=num(b);if(an!==null&&bn!==null)return an-bn;
 return parse(a).localeCompare(parse(b),undefined,{numeric:true,sensitivity:'base'});
}
// A stable, light-weight DOM enhancement: never re-render a focused search field.
export function applyTableView(table,pref){
 const body=table.tBodies[0];if(!body)return 0;
 const rows=[...body.rows];if(!rows.length)return 0;
 rows.forEach((row,i)=>{if(row.dataset.qol03Original===undefined)row.dataset.qol03Original=String(i);});
 const searchable=String(pref?.query||'').toLocaleLowerCase();
 let sorted=rows.map(row=>({row,i:Number(row.dataset.qol03Original)}));
 if(pref?.sort===null)sorted.sort((a,b)=>a.i-b.i);
 if(pref?.sort!==null&&Number.isInteger(pref?.sort))sorted.sort((a,b)=>{
  const comp=tableCompare(a.row.cells[pref.sort]?.textContent,b.row.cells[pref.sort]?.textContent);
  const secondary=pref.sort2!==null&&Number.isInteger(pref.sort2)?tableCompare(a.row.cells[pref.sort2]?.textContent,b.row.cells[pref.sort2]?.textContent):0;
  return (pref.desc?-comp:comp)||secondary||(a.i-b.i);
 });
 let visible=0;const page=Math.max(0,Number(pref?.page)||0),pageSize=20;
 for(const {row} of sorted){body.appendChild(row);const match=!searchable||row.textContent.toLocaleLowerCase().includes(searchable);row.dataset.qol03Match=match?'true':'false';if(match)visible++;}
 const safePage=Math.min(page,Math.max(0,Math.ceil(visible/pageSize)-1));let seen=0;
 for(const {row} of sorted){const match=row.dataset.qol03Match==='true';row.hidden=!match||(seen<safePage*pageSize||seen>=(safePage+1)*pageSize);if(match)seen++;}
 for(const [i,head] of [...table.querySelectorAll('thead th')].entries())head.setAttribute('aria-sort',i===pref?.sort?(pref.desc?'descending':'ascending'):'none');
 return {visible,page:safePage,pages:Math.max(1,Math.ceil(visible/pageSize))};
}
