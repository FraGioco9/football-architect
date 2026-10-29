import routeRegistry from '../assets/routes-registry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import model from '../assets/world-calendar-model.js';
import {isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const runtime=()=>{
  assert.ok(existsSync(new URL('../assets/world-calendar.js',import.meta.url)),'CAL-IMP-02 calendar runtime required');
  return read('assets/world-calendar.js');
};
function element(){
  const n={dataset:{},attrs:{},children:[],events:{},textContent:'',hidden:false,disabled:false,tabIndex:0,
    setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]},
    addEventListener(k,fn){this.events[k]=fn},emit(k,extra={}){this.events[k]?.({target:this,preventDefault(){},...extra})},
    focus(){this.focused=true},append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=nodes},classList:{toggle(){}}};
  return n;
}
function boot({mobile=false,saved=null,blocked=false}={}){
  const source=read('calendar/index.html').match(/<script data-calendar-bootstrap>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source,'Calendar initial view must be resolved before CSS');
  const root={dataset:{}};
  const location={href:'http://localhost/calendar',pathname:'/calendar',search:''};
  const history={state:null,replaceState(_state,_title,url){location.href=String(url);location.search=new URL(location.href).search}};
  const createElement=()=>({dataset:{},textContent:''});
  runInNewContext(source,{URL,URLSearchParams,location,history,document:{documentElement:root,createElement,head:{append(){}}},window:{matchMedia:()=>({matches:mobile})},
    sessionStorage:{getItem(){if(blocked)throw Error('blocked');return null}}});
  return root;
}
function setup(options={}){
  const root=boot(options);root.lang='en';let observer;
  const names=['world-calendar','calendar-season','calendar-week','calendar-previous','calendar-next','calendar-week-label','calendar-selected','calendar-plan-label','calendar-note','calendar-key','calendar-controls','calendar-days'];
  if(options.details)names.push('calendar-details','calendar-details-heading','calendar-details-content','calendar-filter','calendar-division');
  const fields=new Map(names.map(id=>[id,element()]));
  fields.get('calendar-note').textContent='Season structure only. No live fixtures or results are available.';
  const rows=Array.from({length:8},(_,i)=>({...element(),dataset:{week:String(i+1)}}));
  const days=Array.from({length:56},(_,i)=>{
    const b=element();b.dataset.calendarDay=String(i+1);
    const kind=element();b.querySelector=s=>s==='.calendar-day-kind'?kind:null;
    return b;
  });
  fields.get('world-calendar').querySelectorAll=s=>s==='[data-calendar-day]'?days:rows;
  let saved;
  const window={faRoutesRegistry:routeRegistry,faWorldCalendarModel:model,addEventListener(){},dispatchEvent(){},faDevPreviewMode:true};
  const document={documentElement:root,getElementById:id=>fields.get(id),createElement:tag=>({...element(),tagName:tag})};
  runInNewContext(runtime(),{URL,URLSearchParams,location:{href:'http://localhost/calendar?season=1&calendarView=season',pathname:'/calendar',search:'?season=1&calendarView=season'},history:{state:null,replaceState(){},pushState(){}},window,document,sessionStorage:{setItem(k,v){if(options.blocked)throw Error('blocked');saved={k,v}}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},MutationObserver:class{constructor(fn){observer=fn}observe(){}}});
  return {window,root,fields,days,rows,language(lang){root.lang=lang;observer()},saved:()=>saved};
}

test('CAL-IMP-02 generates 56 selectable days in eight weeks with international labels above national',()=>{
  const html=read('calendar/index.html');
  assert.equal((html.match(/data-calendar-day="\d+"/g)||[]).length,56);
  assert.equal((html.match(/class="calendar-week-row"/g)||[]).length,8);
  assert.match(html,/data-calendar-day="16"[\s\S]*?I01[\s\S]*?N04/);
  assert.match(html,/data-calendar-day="53"[\s\S]*?F[\s\S]*?N32/);
  assert.match(html,/data-calendar-day="54"[\s\S]*?F[\s\S]*?N33/);
  assert.match(html,/data-calendar-day="56"/);
  assert.ok(html.indexOf('data-calendar-bootstrap')<html.indexOf('/assets/app.css'));
  assert.ok(html.indexOf('/assets/world-calendar-model.js')<html.indexOf('/assets/world-calendar.js'));
  for(const page of ['dashboard/index.html','settings/index.html','competitions/it-1/index.html'])assert.doesNotMatch(read(page),/world-calendar\.js|data-calendar-day=/);
  for(const file of ['assets/world-calendar.js','assets/world-calendar-model.js']){
    assert.equal(isAllowlistedPublicPath(file),true);assert.ok(planPublicFiles().includes(file));
  }
  assert.equal(isAllowlistedPublicPath('assets/world-calendar-private.js'),false);
});

test('CAL-IMP-02 defaults desktop to Season and mobile to Week, restores valid UI state and ignores corrupt state',()=>{
  assert.equal(boot().dataset.calendarView,'season');
  assert.equal(boot({mobile:true}).dataset.calendarView,'week');
  for(const saved of ['bad JSON','null','[]',JSON.stringify({version:1,day:57,view:'week'}),JSON.stringify({version:1,day:1,view:'stats'})]){
    const root=boot({mobile:true,saved});assert.equal(root.dataset.calendarDay,'1');assert.equal(root.dataset.calendarView,'week');
  }
  const root=boot({mobile:true,saved:JSON.stringify({version:1,day:16,view:'season'})});
  assert.equal(root.dataset.calendarView,'week');assert.equal(root.dataset.calendarDay,'1');assert.equal(root.dataset.calendarWeek,'1');
  assert.equal(boot({blocked:true}).dataset.calendarView,'season');
});

test('CAL-IMP-02 all day selections and view switches preserve QA-06 data and only persist UI state',()=>{
  const {window,fields,days,root,saved}=setup(),before=JSON.stringify(model.createSeason(1));
  for(let day=1;day<=56;day++){
    days[day-1].emit('click');
    assert.equal(window.faWorldCalendar.getSelection().day,day);
    assert.equal(days.filter(b=>b.attrs['aria-pressed']==='true').length,0);
    assert.equal(days[day-1].tabIndex,0);
    fields.get('calendar-week').emit('click');
    assert.equal(window.faWorldCalendar.getSelection().day,day);
    assert.equal(root.dataset.calendarWeek,String(Math.ceil(day/7)));
    fields.get('calendar-season').emit('click');
    assert.equal(window.faWorldCalendar.getSelection().day,day);
  }
  assert.equal(before,JSON.stringify(model.createSeason(1)));
  assert.equal(saved(),undefined,'Calendar view is no longer persisted');
  assert.equal(Object.isFrozen(window.faWorldCalendar.getSelection()),true);
});

test('CAL-IMP-02 keyboard and week boundaries stay in 1–56 and carry the selected weekday',()=>{
  const {fields,days,window}=setup({mobile:true});
  const selected=()=>window.faWorldCalendar.getSelection().day;
  assert.equal(fields.get('calendar-previous').disabled,true);
  fields.get('calendar-next').emit('click');assert.equal(selected(),8);
  days[7].emit('keydown',{key:'ArrowDown'});assert.equal(selected(),9);
  days[8].emit('keydown',{key:'End',ctrlKey:true});assert.equal(selected(),56);
  assert.equal(days[55].focused,true);assert.equal(fields.get('calendar-next').disabled,true);
  days[55].emit('keydown',{key:'ArrowRight'});assert.equal(selected(),56);
  days[55].emit('keydown',{key:'Home',ctrlKey:true});assert.equal(selected(),1);
  fields.get('calendar-season').emit('click');
  days[0].emit('keydown',{key:'ArrowDown'});assert.equal(selected(),8);
  days[7].emit('keydown',{key:'End'});assert.equal(selected(),14);
  days[13].emit('keydown',{key:'PageDown'});assert.equal(selected(),21);
  days[20].emit('keydown',{key:'Home'});assert.equal(selected(),15);
});

test('CAL-IMP-02 language changes keep selection, localize all controls and never claim a current live day',()=>{
  const {fields,days,root,language,window}=setup({blocked:true});days[52].emit('click');
  for(const [lang,day,season,week] of [['en','Day','Season','Week'],['de','Tag','Saison','Woche'],['es','Día','Temporada','Semana'],['fr','Jour','Saison','Semaine'],['it','Giorno','Stagione','Settimana']]){
    language(lang);assert.equal(fields.get('calendar-season').textContent,season);assert.equal(fields.get('calendar-week').textContent,week);
    assert.ok(days[52].attrs['aria-label'].includes(day+' 53'));
    assert.equal(window.faWorldCalendar.getSelection().day,53);
    assert.equal(root.dataset.calendarView,'season');
    assert.ok(fields.get('calendar-note').textContent.length>20);
    assert.ok(days.every(d=>d.attrs['aria-current']===undefined));
  }
});

test('CAL-IMP-02 boundary navigation moves focus from a disabled arrow to the selected day',()=>{
  const {fields,days,window}=setup({mobile:true});
  fields.get('calendar-next').focus();
  for(let i=0;i<7;i++)fields.get('calendar-next').emit('click');
  assert.equal(window.faWorldCalendar.getSelection().day,50);
  assert.equal(fields.get('calendar-next').disabled,true);
  assert.equal(days[49].focused,true);
  fields.get('calendar-previous').focus();
  for(let i=0;i<7;i++)fields.get('calendar-previous').emit('click');
  assert.equal(window.faWorldCalendar.getSelection().day,1);
  assert.equal(fields.get('calendar-previous').disabled,true);
  assert.equal(days[0].focused,true);
});

test('A03-04E: calendar detail links preserve exact domestic Fixtures query and existing return encoding',()=>{
 const r=setup({details:true}),walk=node=>[node,...node.children.flatMap(walk)];
 r.days[12].emit('click');
 for(const country of ['it','eng','es','de','fr','pt','nl','br'])for(const tier of [1,2]){
  const division=country+'-'+tier,control=r.fields.get('calendar-division');
  control.value=division;control.emit('change');
  const links=walk(r.fields.get('calendar-details-content')).filter(node=>node.tagName==='a');
  assert.equal(links.length,1);
  assert.equal(links[0].href,'/competitions/'+division+'/fixtures?season=1&matchday=1&calendarReturn=%2Fcalendar%3Fseason%3D1%26calendarView%3Dseason');
 }
});
