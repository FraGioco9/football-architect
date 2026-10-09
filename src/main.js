import {LEAGUES,getLeagueClubs} from './leagues.js';
import {createSession,advanceSession,validDate,localToday} from './simulation.js';
import {openCareerDatabase,readCatalog,bestCareer,createCareer,selectCareer,saveCareer,renameCareer,deleteCareer,exportCareer,parseCareerImport} from './career-store.js';
import {layout,homePage,managerPage,countryPage,teamsPage,careersPage,settingsPage,simulationPage,tr} from './ui-pages.js';
import {feedback,fromError,feedbackText,renderBlockingError} from './feedback.js';
import {MANAGER_PROFILE_FIELDS,blankManagerProfile,normalizeManagerProfile,managerFullName,managerProfileIssues,validManagerProfile} from './manager-profile.js';
import {isNationalityCode,initialCalendarMonth,shiftCalendarMonth,closestSelectIndex,selectTypeaheadBuffer} from './site-pickers.js';

const app=document.getElementById('app');
const ROUTES=new Set(['/','/new-career','/new-career/country','/new-career/team','/careers','/settings','/simulation']);
let db=null,catalog={rows:[],activeId:null},loaded=null,lang='it';
const newDraft=()=>({managerName:'',managerProfile:blankManagerProfile(),countryId:null,clubId:null,query:''});
let draft=newDraft();
let timer=null,busy=false,sequence=0,feedbackState=null,storageFailure=null,languageMenuOpen=false;
let pickerOpen=null,pickerMonth=null,pickerJump=false,selectedBoxId=null,managerSubmitted=false;
let typeahead={kind:'',query:'',last:0};
function positionCalendar(){
 const popup=app.querySelector('.fa-calendar-panel'),trigger=app.querySelector('#manager-birth-date');
 if(!popup||!trigger)return;
 const rect=trigger.getBoundingClientRect(),margin=8,gap=6;
 const width=popup.offsetWidth,height=popup.offsetHeight;
 const left=Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin));
 const below=rect.bottom+gap+height<=window.innerHeight-margin;
 const top=below?rect.bottom+gap:Math.max(margin,rect.top-height-gap);
 popup.style.left=Math.round(left)+'px';popup.style.top=Math.round(top)+'px';
}
window.addEventListener('resize',positionCalendar);
window.addEventListener('scroll',positionCalendar,true);
try{lang=localStorage.getItem('football-architect:minimal:lang')==='en'?'en':'it';}catch{}
const path=()=>ROUTES.has(location.pathname)?location.pathname:'/';
function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
function navigate(url){stop();languageMenuOpen=false;feedbackState=null;pickerOpen=null;pickerJump=false;selectedBoxId=null;history.pushState({},'',url);void render();}
function fail(error){stop();feedbackState=fromError(error);void render();}
async function refreshCatalog(){catalog=await readCatalog(db);return catalog;}
async function render(){
 const ticket=++sequence;
 if(!db){app.innerHTML=layout(renderBlockingError(storageFailure??new Error('INDEXEDDB_UNAVAILABLE'),lang),lang,null,languageMenuOpen);return;}
 let page=path();
 try{
  if(page!=='/simulation')await refreshCatalog();
  if(ticket!==sequence)return;
  if((page==='/new-career/country'||page==='/new-career/team')&&
    (!validManagerProfile(draft.managerProfile))){
   history.replaceState({},'','/new-career');page='/new-career';
  }
  if(page==='/new-career/team'&&!LEAGUES.some(l=>l.id===draft.countryId)){
   history.replaceState({},'','/new-career/country');page='/new-career/country';
  }
  if(page==='/simulation'&&!loaded){
   await refreshCatalog();
   const candidate=bestCareer(catalog);
   if(candidate){loaded=await selectCareer(db,candidate.id);}
   else {history.replaceState({},'','/');page='/';}
  }
  if(ticket!==sequence)return;
  let inner;
  if(page==='/new-career')inner=managerPage(draft,lang,{open:pickerOpen,month:pickerMonth??initialCalendarMonth(draft.managerProfile.birthDate),jump:pickerJump});
  else if(page==='/new-career/country')inner=countryPage(draft,lang);
  else if(page==='/new-career/team')inner=teamsPage(draft,lang);
  else if(page==='/careers')inner=careersPage(catalog,lang);
  else if(page==='/settings')inner=settingsPage(lang);
  else if(page==='/simulation'&&loaded)inner=simulationPage(loaded.meta,loaded.state,lang,timer!==null);
  else inner=homePage(catalog,lang);
  app.innerHTML=layout(inner,lang,feedbackState,languageMenuOpen);
  if(page==='/new-career'){
   if(managerSubmitted)validateManagerForm(document.getElementById('manager-form'),false);
   if(selectedBoxId)app.querySelectorAll('.fa-interactive-box').forEach(x=>x.classList.toggle('fa-control-selected',x.id===selectedBoxId));
  }
  if(pickerOpen==='calendar')positionCalendar();
  document.documentElement.lang=lang;
  document.title=tr(lang,'Football Architect','Football Architect');
 }catch(e){
  if(ticket!==sequence)return;
  stop();
  app.innerHTML=layout(renderBlockingError(e,lang),lang,null,languageMenuOpen);
 }
}
async function advance(days){
 if(busy||!loaded)return;
 busy=true;
 const current=loaded;
 try{
  const next=advanceSession(current.state,days);
  const saved=await saveCareer(db,current.meta.id,next,{expectedDays:current.state.daysElapsed});
  if(loaded?.meta.id===current.meta.id){loaded=saved;await render();}
 }catch(e){fail(e);}finally{busy=false;}
}
async function begin(){
 if(busy||!validManagerProfile(draft.managerProfile)||!LEAGUES.some(l=>l.id===draft.countryId)||!getLeagueClubs(draft.countryId).some(c=>c.id===draft.clubId))return;
 busy=true;
 try{
  const current=await createCareer(db,{managerName:managerFullName(draft.managerProfile),managerProfile:draft.managerProfile,countryId:draft.countryId,clubId:draft.clubId});
  loaded=current;
  draft=newDraft();
  navigate('/simulation');
 }finally{busy=false;}
}
async function load(id){stop();loaded=await selectCareer(db,id);navigate('/simulation');}
function download(name,object){
 const data=new Blob([JSON.stringify(object,null,2)],{type:'application/json'});
 const href=URL.createObjectURL(data),link=document.createElement('a');
 link.href=href;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(href),1000);
}
async function toggleLanguageMenu(open,focus){
 languageMenuOpen=open;
 await render();
 const combo=app.querySelector('[data-action="language-toggle"]');
 if(focus==='combo')combo?.focus({preventScroll:true});
 if(focus==='option'){
  const options=[...app.querySelectorAll('[data-action="language-option"]')];
  (options.find(o=>o.getAttribute('aria-selected')==='true')??options[0])?.focus({preventScroll:true});
 }
 if(focus==='next'){
  const controls=[...app.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])')];
  controls[controls.indexOf(combo)+1]?.focus({preventScroll:true});
 }
}
async function setLanguage(value){
 if(!['it','en'].includes(value))return;
 lang=value;languageMenuOpen=false;
 try{localStorage.setItem('football-architect:minimal:lang',lang);}catch{}
 await render();
 app.querySelector('[data-action="language-toggle"]')?.focus({preventScroll:true});
}
async function handle(action,element){
 switch(action){
  case 'feedback-dismiss':feedbackState=null;await render();break;
  case 'retry-storage':{
   if(!db){
    try{db=await openCareerDatabase();storageFailure=null;}
    catch(e){storageFailure=e;db=null;}
   }
   feedbackState=null;await render();break;
  }
  case 'language-toggle':await toggleLanguageMenu(!languageMenuOpen,'combo');break;
  case 'language-option':await setLanguage(element.dataset.value);break;
  case 'language-focus':await toggleLanguageMenu(true,'option');break;
  case 'home':navigate('/');break;
  case 'new':draft=newDraft();managerSubmitted=false;pickerMonth=null;navigate('/new-career');break;
  case 'careers':navigate('/careers');break;
  case 'settings':navigate('/settings');break;
  case 'cancel-setup':draft=newDraft();managerSubmitted=false;pickerMonth=null;navigate('/');break;
  case 'setup-back':navigate(path()==='/new-career/team'?'/new-career/country':'/new-career');break;

  case 'nationality-toggle':
   pickerOpen=pickerOpen==='nationality'?null:'nationality';
   await render();
   if(pickerOpen)app.querySelector('.fa-nationality-menu .fa-picker-option.is-selected, .fa-nationality-menu .fa-picker-option')?.focus({preventScroll:true});
   else app.querySelector('#manager-nationality')?.focus({preventScroll:true});
   break;
  case 'nationality-select':{
   const value=element.dataset.value;
   if(!isNationalityCode(value))break;
   draft.managerProfile.nationality=value;pickerOpen=null;selectedBoxId=null;
   await render();
   app.querySelector('#manager-nationality')?.focus({preventScroll:true});
   break;
  }
  case 'calendar-toggle':
   pickerOpen=pickerOpen==='calendar'?null:'calendar';pickerJump=false;
   pickerMonth=pickerMonth??initialCalendarMonth(draft.managerProfile.birthDate);
   await render();
   app.querySelector('#manager-birth-date')?.focus({preventScroll:true});
   break;
  case 'calendar-jump-toggle':
   pickerJump=!pickerJump;await render();
   app.querySelector(pickerJump?'[data-calendar-part="year"]':'.fa-calendar-title')?.focus({preventScroll:true});
   break;
  case 'calendar-prev':case 'calendar-next':
   pickerMonth=shiftCalendarMonth(pickerMonth,action==='calendar-next'?1:-1);
   await render();
   app.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});
   break;
  case 'calendar-day':case 'calendar-today':{
   const value=action==='calendar-today'?localToday():element.dataset.value;
   if(!validDate(value)||value>localToday())break;
   draft.managerProfile.birthDate=value;pickerOpen=null;pickerMonth=value.slice(0,7);
   selectedBoxId=null;pickerJump=false;await render();
   app.querySelector('#manager-birth-date')?.focus({preventScroll:true});break;
  }
  case 'calendar-clear':
   draft.managerProfile.birthDate='';pickerOpen=null;pickerJump=false;selectedBoxId=null;
   await render();app.querySelector('#manager-birth-date')?.focus({preventScroll:true});break;
  case 'country':if(LEAGUES.some(l=>l.id===element.dataset.country)){draft.countryId=element.dataset.country;draft.clubId=null;await render();app.querySelector(`[data-action="country"][data-country="${draft.countryId}"]`)?.focus({preventScroll:true});}break;
  case 'country-next':if(LEAGUES.some(l=>l.id===draft.countryId))navigate('/new-career/team');break;
  case 'select':if(getLeagueClubs(draft.countryId).some(c=>c.id===Number(element.dataset.id))){draft.clubId=Number(element.dataset.id);await render();app.querySelector(`.club-table-select[data-id="${draft.clubId}"]`)?.focus({preventScroll:true});}break;
  case 'start-career':await begin();break;
  case 'continue':{
   await refreshCatalog();
   const last=bestCareer(catalog);if(last)await load(last.id);
   break;
  }
  case 'load':await load(element.dataset.id);break;
  case 'rename':{
   const entry=catalog.rows.find(r=>r.id===element.dataset.id&&r.status==='ok');
   if(!entry)return;
   const name=prompt(tr(lang,'Nome carriera','Career name'),entry.meta.careerName??entry.meta.managerName);
   if(name===null)return;
   const trimmed=name.trim();
   if(!trimmed||trimmed.length>80){feedbackState=feedback('error','CAREER_NAME_INVALID');await render();return;}
   const meta=await renameCareer(db,entry.id,trimmed);
   if(loaded?.meta.id===entry.id)loaded={...loaded,meta};
   feedbackState=feedback('success','RENAME_OK');
   await render();break;
  }
  case 'export':{
   const snapshot=await exportCareer(db,element.dataset.id);
   download('football-architect-'+element.dataset.id+'.json',snapshot);
   break;
  }
  case 'delete':{
   const id=element.dataset.id,entry=catalog.rows.find(r=>r.id===id);
   if(!entry)return;
   if(!confirm(tr(lang,'Eliminare definitivamente questa carriera?','Permanently delete this career?')))return;
   await deleteCareer(db,id);
   if(loaded?.meta.id===id){stop();loaded=null;}
   feedbackState=feedback('success','DELETE_OK');await render();break;
  }
  case 'import':document.getElementById('import-file')?.click();break;
  case 'day':stop();await advance(1);break;
  case 'week':stop();await advance(7);break;
  case 'month':stop();await advance(30);break;
  case 'year':stop();await advance(365);break;
  case 'toggle':{
   if(timer!==null)stop();
   else timer=setInterval(()=>{if(!busy)void advance(1);},500);
   await render();break;
  }
 }
}
document.addEventListener('click',event=>{
 if(pickerOpen&&!event.target.closest?.('[data-fa-picker]')){
  pickerOpen=null;
  // Closing on an outside click must not recreate the form and steal focus
  // from the field the user just clicked.
  app.querySelector('.fa-picker-popover')?.remove();
  app.querySelector('.fa-picker-trigger[aria-expanded="true"]')?.setAttribute('aria-expanded','false');
 }
 const el=event.target.closest('[data-action]');
 if(languageMenuOpen&&!event.target.closest('[data-language-picker]')){
  languageMenuOpen=false;
  if(!el||!app.contains(el)){void render();return;}
 }
 if(!el||!app.contains(el))return;
 if(el.dataset.action==='home')event.preventDefault();
 if(busy)return;
 void handle(el.dataset.action,el).catch(fail);
});
document.addEventListener('keydown',event=>{
 const combo=event.target.closest?.('[data-action="language-toggle"]');
 if(combo){
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();void toggleLanguageMenu(true,'option');return;
  }
  if(event.key==='Escape'&&languageMenuOpen){event.preventDefault();void toggleLanguageMenu(false,'combo');return;}
 }
 const option=event.target.closest?.('[data-action="language-option"]');
 if(!option)return;
 const items=[...app.querySelectorAll('[data-action="language-option"]')],position=items.indexOf(option);
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:(position+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
  items[next]?.focus({preventScroll:true});
 }else if(event.key==='Escape'){
  event.preventDefault();void toggleLanguageMenu(false,'combo');
 }else if(event.key==='Tab'){
  event.preventDefault();void toggleLanguageMenu(false,event.shiftKey?'combo':'next');
 }
});
function updateManagerField(field,code){
 const name=field.name,shown=name==='birthDate'?document.getElementById('manager-birth-date'):
  name==='nationality'?document.getElementById('manager-nationality'):field;
 shown?.setAttribute('aria-invalid',code?'true':'false');
 shown?.classList.toggle('fa-field-invalid',Boolean(code));
}
function validateManagerForm(form,focus=true){
 if(!form)return false;
 const profile=Object.fromEntries(MANAGER_PROFILE_FIELDS.map(key=>[key,String(form.elements.namedItem(key)?.value??'')]));
 const issues=managerProfileIssues(profile);
 const invalid=MANAGER_PROFILE_FIELDS.filter(key=>issues[key]);
 for(const key of MANAGER_PROFILE_FIELDS)updateManagerField(form.elements.namedItem(key),issues[key]);
 const summary=document.getElementById('manager-form-error');
 if(summary){
  summary.hidden=invalid.length===0;
  summary.textContent=invalid.length?
   tr(lang,'Controlla i campi evidenziati in rosso.','Check the fields highlighted in red.'):'';
 }
 if(invalid.length){
  managerSubmitted=true;
  if(focus){
   const key=invalid[0];
   (key==='birthDate'?document.getElementById('manager-birth-date'):
    key==='nationality'?document.getElementById('manager-nationality'):
    form.elements.namedItem(key))?.focus({preventScroll:true});
  }
  return false;
 }
 draft.managerProfile=normalizeManagerProfile(profile);
 draft.managerName=managerFullName(draft.managerProfile);
 managerSubmitted=false;
 return true;
}
document.addEventListener('submit',event=>{
 if(event.target.id!=='manager-form')return;
 event.preventDefault();
 if(!validateManagerForm(event.target))return;
 pickerOpen=null;navigate('/new-career/country');
});
document.addEventListener('input',event=>{
 const field=event.target;
 if(!field.classList?.contains('wizard-profile-input'))return;
 if(!MANAGER_PROFILE_FIELDS.includes(field.name))return;
 draft.managerProfile[field.name]=field.value;
 draft.managerName=managerFullName(draft.managerProfile);
 const form=field.form;
 if(managerSubmitted)validateManagerForm(form,false);
});
document.addEventListener('change',event=>{
 if(event.target.id==='import-file')void (async()=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  if(file.size>2_000_000)throw Error('IMPORT_TOO_LARGE');
  const data=parseCareerImport(await file.text());
  await createCareer(db,data);
  feedbackState=feedback('success','IMPORT_OK');
  await render();
 })().catch(fail);
});

document.addEventListener('pointerdown',event=>{
 document.documentElement.classList.remove('fa-keyboard-navigation');
 // Only the interactive box itself can acquire the visual selected state.
 // Clicking its label never selects it; keyboard focus has a separate indicator.
 const box=event.target.closest?.('.fa-interactive-box');
 // Menu entries and non-interactive labels are never equivalent to clicking a field.
 selectedBoxId=box?.id??null;
 typeahead={kind:'',query:'',last:0};
 app.querySelectorAll('.fa-interactive-box').forEach(el=>el.classList.toggle('fa-control-selected',el.id===selectedBoxId));
},true);
document.addEventListener('keydown',event=>{
 if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
  document.documentElement.classList.add('fa-keyboard-navigation');
  if(event.key==='Tab'){
   selectedBoxId=null;
   app.querySelectorAll('.fa-control-selected').forEach(el=>el.classList.remove('fa-control-selected'));
  }
 }
},true);
document.addEventListener('change',event=>{
 const selector=event.target.closest?.('[data-calendar-part]');
 if(!selector)return;
 const year=document.querySelector('[data-calendar-part="year"]')?.value;
 const month=document.querySelector('[data-calendar-part="month"]')?.value;
 if(!year||!month)return;
 pickerMonth=shiftCalendarMonth(year+'-'+month,0);pickerJump=true;
 void render().then(()=>app.querySelector('[data-calendar-part="'+selector.dataset.calendarPart+'"]')?.focus({preventScroll:true}));
});
document.addEventListener('keydown',event=>{
 if(!pickerOpen)return;
 if(event.key==='Escape'){
  event.preventDefault();
  const target=pickerOpen==='calendar'?'manager-birth-date':'manager-nationality';
  pickerOpen=null;void render().then(()=>app.querySelector('#'+target)?.focus({preventScroll:true}));
  return;
 }
 const item=event.target.closest?.('.fa-nationality-menu .fa-picker-option');
 if(item&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
  event.preventDefault();
  const options=[...app.querySelectorAll('.fa-nationality-menu .fa-picker-option')],i=options.indexOf(item);
  const next=event.key==='Home'?0:event.key==='End'?options.length-1:(i+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
  options[next]?.focus({preventScroll:true});
 }
});


// Type-to-closest-value works on the existing site dropdowns, including when closed.
// Search moves focus; it does not commit a choice until Enter/click.
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.key.length!==1||!/[\\p{L}\\p{N}]/u.test(event.key))return;
 const target=event.target;
 const nationality=target.closest?.('[data-action="nationality-toggle"],.fa-nationality-menu .fa-picker-option');
 const language=target.closest?.('[data-action="language-toggle"],.language-listbox .language-option');
 const native=target.closest?.('select[data-calendar-part]');
 if(!nationality&&!language&&!native)return;
 event.preventDefault();
 const kind=nationality?'nationality':language?'language':native.dataset.calendarPart;
 const now=Date.now(),same=typeahead.kind===kind;
 const query=selectTypeaheadBuffer(same?typeahead.query:'',event.key,same?now-typeahead.last:Infinity);
 typeahead={kind,query,last:now};
 const focusMatch=async()=>{
  if(kind==='nationality'&&pickerOpen!=='nationality'){pickerOpen='nationality';await render();}
  if(kind==='language'&&!languageMenuOpen){languageMenuOpen=true;await render();}
  const options=native?[...app.querySelectorAll('select[data-calendar-part="'+kind+'"] option')]:
   [...app.querySelectorAll(kind==='nationality'?'.fa-nationality-menu .fa-picker-option':'.language-listbox .language-option')];
  const index=closestSelectIndex(options.map(o=>({label:o.textContent})),query);
  if(index<0)return;
  if(native){
   const select=app.querySelector('select[data-calendar-part="'+kind+'"]');
   if(select&&select.value!==options[index].value){
    select.value=options[index].value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }else{
   options[index]?.focus({preventScroll:true});
   options[index]?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
 };
 void focusMatch().catch(fail);
},true);

window.addEventListener('popstate',()=>{stop();void render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer!==null){stop();void render();}});
async function boot(){
 try{db=await openCareerDatabase();storageFailure=null;await render();}
 catch(e){db=null;storageFailure=e;await render();}
}
void boot();
