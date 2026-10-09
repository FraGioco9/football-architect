import {LEAGUES,getLeagueClubs} from './leagues.js';
import {createSession,advanceSession,advanceMinutes,sessionTime,validDate,localToday} from './simulation.js';
import {preseasonStart} from './season-calendar.js';
import {nextScheduledClubFixture,createFixtureCalendarCache} from './fixture-calendar.js';
import {openCareerDatabase,readCatalog,bestCareer,createCareer,selectCareer,saveCareer,renameCareer,deleteCareer,exportCareer,parseCareerImport} from './career-store.js';
import {layout,homePage,managerPage,countryPage,championshipPage,teamsPage,careersPage,settingsPage,simulationPage,tr} from './ui-pages.js';
import {feedback,fromError,feedbackText,renderBlockingError} from './feedback.js';
import {MANAGER_PROFILE_FIELDS,blankManagerProfile,normalizeManagerProfile,managerFullName,managerProfileIssues,validManagerProfile} from './manager-profile.js';
import {isNationalityCode,initialCalendarMonth,shiftCalendarMonth,closestSelectIndex,selectTypeaheadBuffer,centeredMenuScrollTop} from './site-pickers.js';

const app=document.getElementById('app');
const ROUTES=new Set(['/','/new-career','/new-career/country','/new-career/league','/new-career/team','/careers','/settings','/simulation']);
let db=null,catalog={rows:[],activeId:null},loaded=null,lang='it';
const newDraft=()=>({managerName:'',managerProfile:blankManagerProfile(),countryId:null,championshipId:null,clubId:null,query:''});
let draft=newDraft();
let timer=null,busy=false,sequence=0,feedbackState=null,storageFailure=null,languageMenuOpen=false;
let pickerOpen=null,pickerMonth=null,pickerView='days',selectedBoxId=null,managerSubmitted=false;
let typeahead={kind:'',query:'',last:0};
let lastRenderedRoute=null,careersFromSimulationId=null;
// Derived schedules stay in memory only; cache is bounded across careers/seasons.
const fixtureCalendarFor=createFixtureCalendarCache(4);
// Keep the focused/matched option centered in the *menu's* visible viewport.
// Using rects rather than offsetTop supports fixed popovers and nested ARIA rows.
function centerMenuOption(option){
 if(!option)return;
 const menu=option.closest('.fa-nationality-menu,.fa-calendar-year-picker,.fa-calendar-month-picker,.language-listbox');
 if(!menu||menu.scrollHeight<=menu.clientHeight)return;
 const menuRect=menu.getBoundingClientRect(),optionRect=option.getBoundingClientRect();
 if(!menuRect.height||!optionRect.height)return;
 menu.scrollTop=centeredMenuScrollTop(menu.scrollTop,menu.clientHeight,menu.scrollHeight,
  optionRect.top-menuRect.top,optionRect.height);
}

function tabStopElements(){
 return [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
  .filter(el=>el.tabIndex>=0&&!el.disabled&&el.type!=='hidden'&&
   !el.closest('[hidden],[inert],[aria-hidden="true"],.fa-picker-popover,.language-listbox')&&
   el.getClientRects().length>0);
}
function tabRelativeTo(anchorId,reverse=false){
 const controls=tabStopElements(),i=controls.findIndex(x=>x.id===anchorId);
 const next=i>=0?controls[i+(reverse?-1:1)]:null;
 if(next)next.focus({preventScroll:false});
 else document.activeElement?.blur?.();
}
function focusSnapshot(){
 const el=document.activeElement;
 if(!el||!app.contains(el)||!el.matches?.('a,button,input,select,textarea,[tabindex]'))return null;
 return {id:el.id,action:el.dataset.action,value:el.dataset.value,
  country:el.dataset.country,item:el.dataset.id};
}
function restoreSnapshot(snapshot){
 if(!snapshot)return false;
 const all=[...app.querySelectorAll('a,button,input,select,textarea,[tabindex]')];
 const target=(snapshot.id?document.getElementById(snapshot.id):null)||
  all.find(el=>el.dataset.action===snapshot.action&&
   (snapshot.value===undefined||el.dataset.value===snapshot.value)&&
   (snapshot.country===undefined||el.dataset.country===snapshot.country)&&
   (snapshot.item===undefined||el.dataset.id===snapshot.item));
 if(!target||!app.contains(target)||target.disabled)return false;
 target.focus({preventScroll:true});return true;
}
function positionNationality(){
 const popup=app.querySelector('.fa-nationality-menu'),trigger=app.querySelector('#manager-nationality');
 if(!popup||!trigger)return;
 const rect=trigger.getBoundingClientRect(),gap=6,margin=8;
 const width=popup.offsetWidth,height=popup.offsetHeight;
 const left=Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin));
 const below=rect.bottom+gap+height<=window.innerHeight-margin;
 const top=below?rect.bottom+gap:Math.max(margin,rect.top-height-gap);
 popup.style.left=Math.round(left)+'px';popup.style.top=Math.round(top)+'px';
}
window.addEventListener('resize',positionNationality);
window.addEventListener('scroll',positionNationality,true);
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
function navigate(url){stop();if(url!=='/careers')careersFromSimulationId=null;languageMenuOpen=false;feedbackState=null;pickerOpen=null;selectedBoxId=null;closeRenameDialog(false);closeDeleteDialog(false);history.pushState({},'',url);void render();}
function fail(error){stop();feedbackState=fromError(error);void render();}
async function refreshCatalog(){catalog=await readCatalog(db);return catalog;}
async function render(){
 const ticket=++sequence;
 if(!db){app.innerHTML=layout(renderBlockingError(storageFailure??new Error('INDEXEDDB_UNAVAILABLE'),lang),lang,null,languageMenuOpen);return;}
 let page=path();
 try{
  if(page!=='/simulation')await refreshCatalog();
  if(ticket!==sequence)return;
  if((page==='/new-career/country'||page==='/new-career/league'||page==='/new-career/team')&&
    (!validManagerProfile(draft.managerProfile))){
   history.replaceState({},'','/new-career');page='/new-career';
  }
  if((page==='/new-career/league'||page==='/new-career/team')&&!LEAGUES.some(l=>l.id===draft.countryId)){
   history.replaceState({},'','/new-career/country');page='/new-career/country';
  }
  if(page==='/new-career/team'&&!LEAGUES.some(l=>l.id===draft.championshipId&&l.id===draft.countryId)){
   history.replaceState({},'','/new-career/league');page='/new-career/league';
  }
  if(page==='/simulation'&&!loaded){
   await refreshCatalog();
   const candidate=bestCareer(catalog);
   if(candidate){loaded=await selectCareer(db,candidate.id);}
   else {history.replaceState({},'','/');page='/';}
  }
  if(ticket!==sequence)return;
  const snapshot=focusSnapshot(),samePage=lastRenderedRoute===page;
  let inner;
  if(page==='/new-career')inner=managerPage(draft,lang,{open:pickerOpen,month:pickerMonth??initialCalendarMonth(draft.managerProfile.birthDate),jump:pickerView});
  else if(page==='/new-career/country')inner=countryPage(draft,lang);
  else if(page==='/new-career/league')inner=championshipPage(draft,lang);
  else if(page==='/new-career/team')inner=teamsPage(draft,lang);
  else if(page==='/careers')inner=careersPage(catalog,lang,careersFromSimulationId);
  else if(page==='/settings')inner=settingsPage(lang);
  else if(page==='/simulation'&&loaded)inner=simulationPage(loaded.meta,loaded.state,lang,timer!==null,nextScheduledClubFixture(loaded.state,fixtureCalendarFor));
  else inner=homePage(catalog,lang);
  closeRenameDialog(false);
  closeDeleteDialog(false);
  app.innerHTML=layout(inner,lang,feedbackState,languageMenuOpen);
  app.querySelectorAll('.fa-site-dialog').forEach(dialog=>{
   dialog.addEventListener('close',()=>{
    releaseSiteModalLock();
    dialog.querySelector('.fa-interactive-box')?.classList.remove('fa-control-selected');
   });
  });
  if(page==='/new-career'){
   if(managerSubmitted)validateManagerForm(document.getElementById('manager-form'),false);
   if(selectedBoxId)app.querySelectorAll('.fa-interactive-box').forEach(x=>x.classList.toggle('fa-control-selected',x.id===selectedBoxId));
  }
  if(pickerOpen==='calendar'){
   positionCalendar();
   centerMenuOption(app.querySelector('.fa-calendar-year-picker .fa-calendar-year-option.is-selected'));
  }
  if(pickerOpen==='nationality')positionNationality();
  if(samePage)restoreSnapshot(snapshot);
  else if(lastRenderedRoute!==null&&page.startsWith('/new-career')){
   const heading=app.querySelector('.wizard-page .fa-page-title');
   heading?.setAttribute('tabindex','-1');
   heading?.focus({preventScroll:false});
  }
  lastRenderedRoute=page;
  document.documentElement.lang=lang;
  document.title=tr(lang,'Football Architect','Football Architect');
 }catch(e){
  if(ticket!==sequence)return;
  stop();
  app.innerHTML=layout(renderBlockingError(e,lang),lang,null,languageMenuOpen);
 }
}
async function advanceClock(minutes){
 if(busy||!loaded)return;
 busy=true;
 const current=loaded;
 try{
  const next=advanceMinutes(current.state,minutes);
  const saved=await saveCareer(db,current.meta.id,next,{
   expectedDays:current.state.daysElapsed,expectedTime:sessionTime(current.state)
  });
  if(loaded?.meta.id===current.meta.id){loaded=saved;await render();}
 }catch(e){fail(e);}finally{busy=false;}
}
async function advance(days){return advanceClock(days*1440);}
async function begin(){
 if(busy||!validManagerProfile(draft.managerProfile)||!LEAGUES.some(l=>l.id===draft.countryId)||!LEAGUES.some(l=>l.id===draft.championshipId&&l.id===draft.countryId)||!getLeagueClubs(draft.countryId).some(c=>c.id===draft.clubId))return;
 busy=true;
 try{
  const current=await createCareer(db,{managerName:managerFullName(draft.managerProfile),managerProfile:draft.managerProfile,countryId:draft.countryId,clubId:draft.clubId,session:createSession(draft.countryId,draft.clubId,preseasonStart(localToday()))});
  loaded=current;
  draft=newDraft();
  navigate('/simulation');
 }finally{busy=false;}
}
async function load(id){stop();loaded=await selectCareer(db,id);navigate('/simulation');}
// Shared modal lifecycle: native showModal makes the background inert, while
// the reserved scrollbar gutter prevents page movement when the thumb hides.
function releaseSiteModalLock(){
 const root=document.documentElement;
 root.classList.remove('fa-modal-open');
 root.style.removeProperty('--fa-modal-scrollbar-gutter');
}
function openSiteModal(dialog,initialFocus){
 if(!dialog||typeof dialog.showModal!=='function')return false;
 const root=document.documentElement;
 const gutter=Math.max(0,window.innerWidth-root.clientWidth);
 root.style.setProperty('--fa-modal-scrollbar-gutter',gutter+'px');
 try{dialog.showModal();}
 catch(error){releaseSiteModalLock();throw error;}
 root.classList.add('fa-modal-open');
 initialFocus?.focus({preventScroll:true});
 return true;
}
function closeRenameDialog(restoreFocus=false){
 const dialog=app.querySelector('#career-rename-dialog');
 const originalId=dialog?.dataset.careerId;
 if(dialog?.open)dialog.close();
 releaseSiteModalLock();
 if(restoreFocus&&originalId){
  const trigger=[...app.querySelectorAll('[data-action="rename"]')].find(x=>x.dataset.id===originalId);
  trigger?.focus({preventScroll:true});
 }
}
function closeDeleteDialog(restoreFocus=false){
 const dialog=app.querySelector('#career-delete-dialog');
 const originalId=dialog?.dataset.careerId;
 if(dialog?.open)dialog.close();
 releaseSiteModalLock();
 if(restoreFocus&&originalId){
  const trigger=[...app.querySelectorAll('[data-action="delete"]')].find(x=>x.dataset.id===originalId);
  trigger?.focus({preventScroll:true});
 }
}
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
  const selected=options.find(o=>o.getAttribute('aria-selected')==='true')??options[0];
  selected?.focus({preventScroll:true});centerMenuOption(selected);
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
  case 'careers':careersFromSimulationId=path()==='/simulation'&&loaded?loaded.meta.id:null;navigate('/careers');break;
  case 'settings':navigate('/settings');break;
  case 'cancel-setup':draft=newDraft();managerSubmitted=false;pickerMonth=null;navigate('/');break;
  case 'setup-back':navigate(path()==='/new-career/team'?'/new-career/league':path()==='/new-career/league'?'/new-career/country':'/new-career');break;

  case 'nationality-toggle':
   pickerOpen=pickerOpen==='nationality'?null:'nationality';
   if(!pickerOpen)selectedBoxId=null;
   await render();
   if(pickerOpen){
    const option=app.querySelector('.fa-nationality-menu .fa-picker-option.is-selected, .fa-nationality-menu .fa-picker-option');
    option?.focus({preventScroll:true});centerMenuOption(option);
   }
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
   pickerOpen=pickerOpen==='calendar'?null:'calendar';pickerView='days';
   if(!pickerOpen)selectedBoxId=null;
   pickerMonth=pickerMonth??initialCalendarMonth(draft.managerProfile.birthDate);
   await render();
   app.querySelector('#manager-birth-date')?.focus({preventScroll:true});
   break;
  case 'calendar-jump-toggle':
   pickerView=pickerView==='days'?'months':pickerView==='months'?'years':'days';
   await render();
   app.querySelector(pickerView==='months'?'.fa-calendar-month-option.is-selected':pickerView==='years'?'.fa-calendar-year-option.is-selected':'.fa-calendar-title')?.focus({preventScroll:true});
   break;
  case 'calendar-prev':case 'calendar-next':case 'calendar-prev-coarse':case 'calendar-next-coarse':{
   const sign=action.includes('next')?1:-1,coarse=action.includes('coarse');
   const step=pickerView==='days'?(coarse?12:1):pickerView==='months'?(coarse?120:12):(coarse?1200:120);
   pickerMonth=shiftCalendarMonth(pickerMonth,sign*step);
   await render();
   app.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});break;
  }
  case 'calendar-month-select':{
   const month=element.dataset.value;
   if(!/^(0[1-9]|1[0-2])$/.test(month))break;
   pickerMonth=shiftCalendarMonth(pickerMonth.slice(0,4)+'-'+month,0);
   pickerView='days';await render();
   app.querySelector('.fa-calendar-title')?.focus({preventScroll:true});break;
  }
  case 'calendar-year-select':{
   const year=Number(element.dataset.value);
   if(!Number.isInteger(year)||year<1900||year>Number(localToday().slice(0,4)))break;
   pickerMonth=shiftCalendarMonth(year+'-'+pickerMonth.slice(5,7),0);
   pickerView='months';await render();
   app.querySelector('.fa-calendar-month-option.is-selected')?.focus({preventScroll:true});break;
  }
  case 'calendar-day':case 'calendar-today':{
   const value=action==='calendar-today'?localToday():element.dataset.value;
   if(!validDate(value)||value>localToday())break;
   draft.managerProfile.birthDate=value;pickerOpen=null;pickerMonth=value.slice(0,7);
   selectedBoxId=null;pickerView='days';await render();
   app.querySelector('#manager-birth-date')?.focus({preventScroll:true});break;
  }
  case 'calendar-clear':
   draft.managerProfile.birthDate='';pickerOpen=null;pickerView='days';selectedBoxId=null;
   await render();app.querySelector('#manager-birth-date')?.focus({preventScroll:true});break;
  case 'country':if(LEAGUES.some(l=>l.id===element.dataset.country)){draft.countryId=element.dataset.country;draft.championshipId=null;draft.clubId=null;await render();app.querySelector(`[data-action="country"][data-country="${draft.countryId}"]`)?.focus({preventScroll:true});}break;
  case 'country-next':if(LEAGUES.some(l=>l.id===draft.countryId))navigate('/new-career/league');break;
  case 'championship':if(LEAGUES.some(l=>l.id===element.dataset.championship&&l.id===draft.countryId)){draft.championshipId=element.dataset.championship;draft.clubId=null;await render();app.querySelector(`[data-action="championship"][data-championship="${draft.championshipId}"]`)?.focus({preventScroll:true});}break;
  case 'championship-next':if(LEAGUES.some(l=>l.id===draft.championshipId&&l.id===draft.countryId))navigate('/new-career/team');break;
  case 'select':if(LEAGUES.some(l=>l.id===draft.championshipId&&l.id===draft.countryId)&&getLeagueClubs(draft.countryId).some(c=>c.id===Number(element.dataset.id))){draft.clubId=Number(element.dataset.id);await render();app.querySelector(`.club-table-select[data-id="${draft.clubId}"]`)?.focus({preventScroll:true});}break;
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
   const dialog=app.querySelector('#career-rename-dialog');
   const input=dialog?.querySelector('#career-rename-input');
   if(!dialog||!input||typeof dialog.showModal!=='function')return;
   dialog.dataset.careerId=entry.id;
   input.value=entry.meta.careerName??entry.meta.managerName;
   input.setAttribute('aria-invalid','false');
   input.classList.remove('fa-field-invalid');
   const warning=dialog.querySelector('#career-rename-error');
   if(warning){warning.hidden=true;warning.textContent='';}
   // Focus starts at the title: the field is not selected until the user
   // explicitly clicks or tabs into it.
   openSiteModal(dialog,dialog.querySelector('#career-rename-title'));
   break;
  }
  case 'rename-cancel':closeRenameDialog(true);break;
  case 'export':{
   const snapshot=await exportCareer(db,element.dataset.id);
   download('football-architect-'+element.dataset.id+'.json',snapshot);
   break;
  }
  case 'delete':{
   const entry=catalog.rows.find(r=>r.id===element.dataset.id);
   if(!entry)return;
   const dialog=app.querySelector('#career-delete-dialog');
   if(!dialog)return;
   dialog.dataset.careerId=entry.id;
   openSiteModal(dialog,dialog.querySelector('#career-delete-title'));
   break;
  }
  case 'delete-cancel':closeDeleteDialog(true);break;
  case 'import':document.getElementById('import-file')?.click();break;
  case 'hour':stop();await advanceClock(60);break;
  case 'day':stop();await advance(1);break;
  case 'week':stop();await advance(7);break;
  case 'month':stop();await advance(30);break;
  case 'year':stop();await advance(365);break;
  case 'toggle':{
   if(timer!==null)stop();
   else timer=setInterval(()=>{if(!busy)void advanceClock(60);},500);
   await render();break;
  }
 }
}
document.addEventListener('click',event=>{
 if(pickerOpen&&!event.target.closest?.('[data-fa-picker]')){
  pickerOpen=null;pickerView='days';selectedBoxId=null;
  app.querySelectorAll('.fa-control-selected').forEach(el=>el.classList.remove('fa-control-selected'));
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
    form.elements.namedItem(key))?.focus({preventScroll:false});
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
document.addEventListener('submit',event=>{
 if(event.target.id!=='career-rename-form')return;
 event.preventDefault();
 if(busy)return;
 const form=event.target,dialog=form.closest('#career-rename-dialog');
 const id=dialog?.dataset.careerId,input=form.querySelector('#career-rename-input');
 const name=input?.value.trim()??'';
 const message=form.querySelector('#career-rename-error');
 if(!name||name.length>80){
  if(message){message.hidden=false;message.textContent=tr(lang,'Inserisci un nome da 1 a 80 caratteri.','Enter a name between 1 and 80 characters.');}
  input?.setAttribute('aria-invalid','true');
  input?.classList.add('fa-field-invalid');
  input?.focus();return;
 }
 const entry=catalog.rows.find(r=>r.id===id&&r.status==='ok');
 if(!entry){closeRenameDialog(false);return;}
 busy=true;
 void (async()=>{
  try{
   const meta=await renameCareer(db,id,name);
   if(loaded?.meta.id===id)loaded={...loaded,meta};
   closeRenameDialog(false);
   feedbackState=feedback('success','RENAME_OK');
   await render();
  }catch(error){closeRenameDialog(false);fail(error);}
  finally{busy=false;}
 })();
});
document.addEventListener('submit',event=>{
 if(event.target.id!=='career-delete-form')return;
 event.preventDefault();
 if(busy)return;
 const dialog=event.target.closest('#career-delete-dialog'),id=dialog?.dataset.careerId;
 const entry=catalog.rows.find(r=>r.id===id);
 if(!entry){closeDeleteDialog(false);return;}
 busy=true;
 void (async()=>{
  try{
   await deleteCareer(db,id);
   if(loaded?.meta.id===id){stop();loaded=null;}
   closeDeleteDialog(false);
   feedbackState=feedback('success','DELETE_OK');
   await render();
  }catch(error){closeDeleteDialog(false);fail(error);}
  finally{busy=false;}
 })();
});
document.addEventListener('focusin',event=>{
 if(event.target.id!=='career-rename-input')return;
 event.target.classList.add('fa-control-selected');
});
document.addEventListener('focusout',event=>{
 if(event.target.id!=='career-rename-input')return;
 event.target.classList.remove('fa-control-selected');
});
document.addEventListener('input',event=>{
 if(event.target.id!=='career-rename-input')return;
 event.target.classList.remove('fa-field-invalid');
 event.target.setAttribute('aria-invalid','false');
 const message=document.getElementById('career-rename-error');
 if(message){message.hidden=true;message.textContent='';}
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

// Global Tab semantics for all site popovers: only their trigger is in tab order.
document.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const el=document.activeElement;
 const inLanguage=languageMenuOpen&&el?.closest?.('[data-language-picker]');
 const inPicker=pickerOpen&&el?.closest?.('[data-fa-picker]');
 if(!inLanguage&&!inPicker)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 const anchor=inLanguage?'language-combobox-home':pickerOpen==='calendar'?'manager-birth-date':'manager-nationality';
 if(inLanguage)languageMenuOpen=false;
 else {pickerOpen=null;pickerView='days';}
 selectedBoxId=null;
 void render().then(()=>tabRelativeTo(anchor,event.shiftKey)).catch(fail);
},true);

// Keyboard grid navigation is shared by days (7 columns), months and years (3).
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey)return;
 const el=event.target;
 const trigger=el.closest?.('#manager-birth-date');
 if(trigger&&event.key==='ArrowDown'){
  event.preventDefault();
  const focusDay=()=>app.querySelector('.fa-calendar-day.is-selected:not([disabled]),.fa-calendar-day.is-today:not([disabled]),.fa-calendar-day:not([disabled])')?.focus({preventScroll:false});
  if(pickerOpen!=='calendar')void handle('calendar-toggle',trigger).then(focusDay).catch(fail);
  else focusDay();
  return;
 }
 if(pickerOpen!=='calendar')return;
 const inside=el.closest?.('.fa-calendar-panel');
 if(!inside)return;
 if(event.altKey&&event.key==='ArrowUp'){
  event.preventDefault();
  pickerView=pickerView==='days'?'months':'years';
  void render().then(()=>{
   app.querySelector(pickerView==='months'?'.fa-calendar-month-option.is-selected':'.fa-calendar-year-option.is-selected')?.focus({preventScroll:false});
  }).catch(fail);
  return;
 }
 const day=el.closest('.fa-calendar-day'),month=el.closest('.fa-calendar-month-option'),year=el.closest('.fa-calendar-year-option');
 const items=day?[...app.querySelectorAll('.fa-calendar-day')]:
  month?[...app.querySelectorAll('.fa-calendar-month-option')]:
  year?[...app.querySelectorAll('.fa-calendar-year-option')]:null;
 if(!items)return;
 if(day&&['PageUp','PageDown'].includes(event.key)){
  event.preventDefault();
  const monthDelta=(event.key==='PageDown'?1:-1)*(event.shiftKey?12:1);
  const desired=day.dataset.value.slice(-2);
  pickerMonth=shiftCalendarMonth(pickerMonth,monthDelta);
  void render().then(()=>{
   const grid=[...app.querySelectorAll('.fa-calendar-day:not([disabled])')];
   (grid.find(x=>x.dataset.value?.startsWith(pickerMonth)&&x.dataset.value?.endsWith('-'+desired))||
    grid.find(x=>x.dataset.value?.startsWith(pickerMonth))||grid[0])?.focus({preventScroll:false});
  }).catch(fail);
  return;
 }
 const deltas=day?{ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}:
  {ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3};
 const i=items.indexOf(day||month||year);
 const next=event.key==='Home'?0:event.key==='End'?items.length-1:i+(deltas[event.key]??NaN);
 if(!Number.isFinite(next))return;
 event.preventDefault();
 const direction=next>=i?1:-1;
 let target=next;
 while(target>=0&&target<items.length&&items[target].disabled)target+=direction;
 if(items[target])items[target].focus({preventScroll:false});
},true);

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

document.addEventListener('keydown',event=>{
 if(!pickerOpen)return;
 if(event.key==='Escape'){
  event.preventDefault();
  const target=pickerOpen==='calendar'?'manager-birth-date':'manager-nationality';
  pickerOpen=null;pickerView='days';selectedBoxId=null;void render().then(()=>app.querySelector('#'+target)?.focus({preventScroll:true}));
  return;
 }
 const item=event.target.closest?.('.fa-nationality-menu .fa-picker-option');
 if(item&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
  event.preventDefault();
  const options=[...app.querySelectorAll('.fa-nationality-menu .fa-picker-option')],i=options.indexOf(item);
  const next=event.key==='Home'?0:event.key==='End'?options.length-1:(i+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
  const nextOption=options[next];
  nextOption?.focus({preventScroll:true});centerMenuOption(nextOption);
 }
});


// Shared typeahead: typing on any site dropdown focuses the nearest option.
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing||
   event.key.length!==1||!/[\p{L}\p{N}]/u.test(event.key))return;
 const target=event.target;
 const nationality=target.closest?.('[data-action="nationality-toggle"],.fa-nationality-menu .fa-picker-option');
 const language=target.closest?.('[data-action="language-toggle"],.language-listbox .language-option');
 const month=target.closest?.('.fa-calendar-month-option');
 const year=target.closest?.('.fa-calendar-year-option');
 if(!nationality&&!language&&!month&&!year)return;
 event.preventDefault();
 const kind=nationality?'nationality':language?'language':month?'calendar-month':'calendar-year';
 const now=Date.now(),same=typeahead.kind===kind;
 const query=selectTypeaheadBuffer(same?typeahead.query:'',event.key,same?now-typeahead.last:Infinity);
 typeahead={kind,query,last:now};
 const focusMatch=async()=>{
  if(kind==='nationality'&&pickerOpen!=='nationality'){pickerOpen='nationality';await render();}
  if(kind==='language'&&!languageMenuOpen){languageMenuOpen=true;await render();}
  const selector=kind==='nationality'?'.fa-nationality-menu .fa-picker-option':
   kind==='language'?'.language-listbox .language-option':
   kind==='calendar-month'?'.fa-calendar-month-picker .fa-calendar-month-option':
   '.fa-calendar-year-picker .fa-calendar-year-option';
  const options=[...app.querySelectorAll(selector)];
  const text=typeahead.kind===kind?typeahead.query:query;
  const index=closestSelectIndex(options.map(o=>({label:o.textContent})),text);
  const option=index>=0?options[index]:null;
  option?.focus({preventScroll:true});
  centerMenuOption(option);
 };
 void focusMatch().catch(fail);
},true);

window.addEventListener('popstate',()=>{stop();careersFromSimulationId=null;closeRenameDialog(false);closeDeleteDialog(false);void render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer!==null){stop();void render();}});
async function boot(){
 try{db=await openCareerDatabase();storageFailure=null;await render();}
 catch(e){db=null;storageFailure=e;await render();}
}
void boot();
