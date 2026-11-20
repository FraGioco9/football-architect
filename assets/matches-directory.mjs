import './world-clock-adapter.js';
import './competition-tabs.js';
import {matchPublicContext,publicClubIdentityCatalog} from './match-public-context.mjs';
import {resolveScoreboardTheme} from './match-scoreboard-themes.mjs';

const root=document.querySelector('.matches-directory');
const el=id=>root.querySelector('#md-'+id);
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR','int'];
const competitions=countries.flatMap(c=>[1,2].map(n=>matchPublicContext({competitionId:c+'-'+n}).competitions[0]));
const {clubs,clubCrests}=publicClubIdentityCatalog();
const teams=new Map(clubs.map(c=>[c.countryId+'-'+c.clubId,c]));
const vocabulary={
 en:'Matches|Season|Sporting day|Current day|Country|Competition|Search team|All|International|England|Previous day|Next day|No matches on this day.|No matching fixtures.|Fixtures have not been published.|Publication in progress.|The world has not started.|Matches unavailable.|Retry|Scheduled|To be confirmed|Rank|Winner|Round|Leg|Neutral venue|League|Playoffs|Playout|Quarter-finals|Semi-finals|Final|Loading matches',
 it:'Partite|Stagione|Giorno sportivo|Giorno corrente|Paese|Competizione|Cerca squadra|Tutti|Internazionale|Inghilterra|Giorno precedente|Giorno successivo|Nessuna partita in questo giorno.|Nessuna partita corrispondente.|Incontri non ancora pubblicati.|Pubblicazione in corso.|Il mondo non è ancora iniziato.|Partite non disponibili.|Riprova|In programma|Da definire|Posizione|Vincente|Turno|Gara|Campo neutro|Campionato|Playoff|Playout|Quarti di finale|Semifinali|Finale|Caricamento partite',
 de:'Spiele|Saison|Spieltag|Aktueller Tag|Land|Wettbewerb|Team suchen|Alle|International|England|Vorheriger Tag|Nächster Tag|Keine Spiele an diesem Tag.|Keine passenden Spiele.|Spiele noch nicht veröffentlicht.|Veröffentlichung läuft.|Die Saison hat noch nicht begonnen.|Spiele nicht verfügbar.|Erneut versuchen|Angesetzt|Noch offen|Rang|Sieger|Runde|Spiel|Neutraler Platz|Liga|Playoffs|Playout|Viertelfinale|Halbfinale|Finale|Spiele werden geladen',
 es:'Partidos|Temporada|Día deportivo|Día actual|País|Competición|Buscar equipo|Todos|Internacional|Inglaterra|Día anterior|Día siguiente|No hay partidos este día.|Ningún partido coincide.|Partidos aún sin publicar.|Publicación en curso.|El mundo aún no ha comenzado.|Partidos no disponibles.|Reintentar|Programado|Por confirmar|Puesto|Ganador|Ronda|Partido|Campo neutral|Liga|Playoffs|Permanencia|Cuartos de final|Semifinales|Final|Cargando partidos',
 fr:'Matchs|Saison|Journée sportive|Jour actuel|Pays|Compétition|Rechercher une équipe|Tous|International|Angleterre|Jour précédent|Jour suivant|Aucun match ce jour.|Aucun match correspondant.|Matchs pas encore publiés.|Publication en cours.|Le monde n’a pas encore démarré.|Matchs indisponibles.|Réessayer|Programmé|À déterminer|Rang|Vainqueur|Tour|Manche|Terrain neutre|Championnat|Barrages|Maintien|Quarts de finale|Demi-finales|Finale|Chargement des matchs'
};
const keys='title season day current country competition search all international england prev next empty filtered unpublished partial zero unavailable retry scheduled tbd rank winner round leg neutral league playoffs playout quarterfinals semifinals final loading'.split(' ');
let words,locale,world=null,rows=[],state='loading',epoch=0,loaded='',pending='';
const skeleton=el('list').innerHTML;
function node(tag,text,className){
 const element=document.createElement(tag);
 if(text!=null)element.textContent=text;
 if(className)element.className=className;
 return element;
}
function link(href,text){const a=node('a',text);a.href=window.faAppHref?.(href)??href;return a}
function logo(src,competitionId){
 const fallback=competitionId?'app-competition-logo-placeholder':'app-world-club-crest-placeholder';
 const slot=node('span',competitionId??'',fallback+' md-logo');
 slot.setAttribute('aria-hidden','true');
 if(src){
  const img=node('img');
  img.alt='';
  img.addEventListener('load',()=>slot.replaceChildren(img),{once:true});
  img.src='/'+src;
 }
 return slot;
}
function region(id){
 if(id==='ENG')return words.england;
 if(id==='int')return words.international;
 return new Intl.DisplayNames([locale],{type:'region'}).of(id);
}
const menus=new Map();
function options(id,items,value){
 const trigger=el(id),menu=el(id+'-menu'),key=JSON.stringify(items);
 let picker=menus.get(id);
 if(picker?.key!==key){
  const choices=items.map(([v,label],index)=>{
   const option=node('div',label,'language-option');
   option.id=menu.id+'-'+index;
   option.dataset.menuValue=String(v);
   option.setAttribute('role','option');
   return option;
  });
  menu.replaceChildren(...choices);
  if(picker)picker.binding.update(choices);
  else picker={binding:window.faBindCompetitionMenu(trigger,menu,choices,choice=>chooseFilter(id,choice),trigger.parentElement,{fitViewport:true,boundary:root.closest('.fa-shell-content-scroll')})};
  picker.key=key;
  menus.set(id,picker);
 }
 trigger.disabled=false;
 picker.binding.sync(String(value));
 el(id+'-value').textContent=items.find(([v])=>String(v)===String(value))?.[1]??'—';
}
function selection(){
 const params=new URLSearchParams(location.search);
 const season=Number(params.get('season')||world?.seasonNumber);
 const selectedSeason=season>0&&Number.isInteger(season)&&season<=world?.seasonNumber?season:world?.seasonNumber??0;
 const rawDay=Number(params.get('day'));
 const day=Number.isInteger(rawDay)&&rawDay>=1&&rawDay<=56?rawDay:Math.max(1,Math.min(56,selectedSeason===world?.seasonNumber?world.day:1));
 const country=countries.includes(params.get('country'))?params.get('country'):'';
 const ids=competitions.filter(c=>!country||c.id.split('-')[0]===country);
 const competition=ids.some(c=>c.id===params.get('competition'))?params.get('competition'):'';
 return {season:selectedSeason,day,country,competition,q:(params.get('q')||'').slice(0,100),ids};
}
function updateURL(changes,replace=false){
 const params=new URLSearchParams(location.search);
 for(const [k,v] of Object.entries(changes)){if(v)params.set(k,v);else params.delete(k)}
 const href='/matches'+(params.size?'?'+params:'');
 if(href!==location.pathname+location.search)history[replace?'replaceState':'pushState'](null,'',href);
 refresh();
}
function participant(id,ref,home=false){
 const c=teams.get(id);
 const name=c?.primaryName??(ref?.kind==='leagueRank'?words.rank+' '+ref.rank:ref?.kind==='tieWinner'?words.winner+' '+ref.tieId:words.tbd);
 const side=node('span',null,'md-team');
 const crest=logo(clubCrests[id]);
 const label=c?link('/clubs/'+c.countryId.toLowerCase()+'/'+c.clubId+'/overview',name):node('span',name);
 if(home)side.append(label,crest);else side.append(crest,label);
 return side;
}
function fixture(f){
 const row=node('div',null,'md-row'),href='/matches/'+f.matchId;
 const r=f.result;
 const score=link(href,r?r.homeGoals+' – '+r.awayGoals:'—');
 score.className='md-score';
 score.setAttribute('aria-label',[teams.get(f.homeClubId)?.primaryName??words.tbd,score.textContent,teams.get(f.awayClubId)?.primaryName??words.tbd].join(' '));
 row.append(participant(f.homeClubId,f.participantA,true),score,participant(f.awayClubId,f.participantB));
 const info=[words[f.phaseId]??f.phaseId,f.round?words.round+' '+f.round:'',f.leg?words.leg+' '+f.leg:'',
  r?.penalties?'('+r.penalties.home+' – '+r.penalties.away+' pen.)':r?.extraTime?'AET':'',!r?f.status==='scheduled'?words.scheduled:words.tbd:'',f.neutral?words.neutral:f.venue];
 row.append(node('small',info.filter(Boolean).join(' · ')));
 row.addEventListener('click',event=>{if(!event.target.closest('a')&&!window.getSelection()?.toString())location.assign(score.href)});
 return row;
}
const fold=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
function render(){
 const s=selection(),list=el('list'),status=el('status');
 locale=Object.hasOwn(vocabulary,document.documentElement.lang)?document.documentElement.lang:'en';
 words=Object.fromEntries(vocabulary[locale].split('|').map((v,i)=>[keys[i],v]));
 el('title').textContent=words.title;document.title=words.title+' — Football Architect';
 root.querySelectorAll('[data-word]').forEach(n=>n.textContent=words[n.dataset.word]);
 el('current').textContent=words.current;
 for(const k of ['prev','next'])el(k).setAttribute('aria-label',words[k]);
 options('season',world?Array.from({length:Math.max(1,world.seasonNumber)},(_,i)=>[world.seasonNumber-i,world.seasonNumber-i]):[['','—']],world?s.season:'');
 options('day',s.season?Array.from({length:56},(_,i)=>[i+1,i+1]):[['','—']],s.season?s.day:'');
 options('country',[['',words.all],...countries.map(c=>[c,region(c)])],s.country);
 options('competition',[['',words.all],...s.ids.map(c=>[c.id,c.name])],s.competition);
 if(el('q').value!==s.q)el('q').value=s.q;
 el('prev').disabled=!s.season||s.day<=1;el('next').disabled=!s.season||s.day>=56;
 el('current').disabled=!world?.seasonNumber;el('season').disabled=!world?.seasonNumber;el('day').disabled=!s.season;
 list.setAttribute('aria-busy',String(state==='loading'));
 if(state==='loading'){list.innerHTML=skeleton;status.textContent='';return}
 list.replaceChildren();status.textContent='';
 if(state==='error'){const retry=node('button',words.retry);retry.onclick=()=>start();status.append(words.unavailable+' ',retry);return}
 if(['zero','unpublished','unavailable'].includes(state)){status.textContent=words[state];return}
 const needle=fold(s.q);
 for(const c of s.ids){
  if(s.competition&&c.id!==s.competition)continue;
  const filtered=rows.filter(f=>f.competitionId===c.id&&(!needle||[f.homeClubId,f.awayClubId].some(id=>fold(teams.get(id)?.primaryName??'').includes(needle))));
  if(!filtered.length)continue;
  const group=node('section'),heading=node('h2'),a=link('/competitions/'+c.id.toLowerCase()+'/fixtures?season='+s.season,c.name);
  heading.append(logo(resolveScoreboardTheme(c).logoAsset,c.id));
  heading.append(a);group.append(heading,...filtered.map(fixture));list.append(group);
 }
 if(state==='partial')status.textContent=words.partial;
 if(!list.childElementCount&&(state!=='partial'||s.country||s.q||s.competition))
  status.append(' '+(s.country||s.q||s.competition?words.filtered:words.empty));
}
async function get(path){
 const response=await fetch(path,{credentials:'omit',cache:'no-store'});
 if(!response.ok)throw Error(String(response.status));
 return response.json();
}
async function refresh(){
 const s=selection();
 if(!world||!s.season){render();return}
 const params=new URLSearchParams(location.search);
 for(const key of ['season','day','country','competition','q']){
  if(!params.has(key))continue;
  if(s[key])params.set(key,String(s[key]));else params.delete(key);
 }
 if(params.toString()!==location.search.slice(1))history.replaceState(null,'','/matches'+(params.size?'?'+params:''));
 const id=[world.generation,world.revision,s.season,s.day].join('/');
 if(id===loaded||id===pending){render();return}
 const ticket=++epoch;pending=id;loaded='';state='loading';render();
 try{
  const data=await get('/api/matches?season='+s.season+'&day='+s.day);
  if(ticket!==epoch)return;
  if(!window.faWorldClockAdapter.sameWorld(data.world,world)){await start();return}
  if(data.schemaVersion!==1||data.providerId!=='authoritative-world'||!['published','partial','unpublished','unavailable'].includes(data.publication)||data.selectedSeason!==s.season||data.day!==s.day||!Array.isArray(data.fixtures))throw Error('Invalid directory');
  state=data.publication;rows=data.fixtures;loaded=id;
 }catch{if(ticket!==epoch)return;state='error'}
 if(ticket===epoch){pending='';render()}
}
async function start(){
 const ticket=++epoch;world=null;pending=loaded='';state='loading';render();
 try{
  const data=await get('/api/world');if(ticket!==epoch)return;
  if(!window.faWorldClockAdapter.validPublicWorld(data.world))throw Error('Invalid world');
  world=data.world;state=world.seasonNumber?'loading':'zero';await refresh();
 }catch{if(ticket===epoch){state='error';render()}}
}
function chooseFilter(key,value){
 const changes={[key]:value};
 if(key==='country'&&value&&!el('competition').value.startsWith(value+'-'))changes.competition='';
 if(key==='season')changes.day=Number(value)===world.seasonNumber?Math.max(1,world.day):1;
 updateURL(changes);
}
// A scroll can synthesize pointer events at the same position.
let pointerX,pointerY;
window.addEventListener('scroll',()=>{root.dataset.scrolling='true'},{capture:true,passive:true});
window.addEventListener('pointermove',event=>{
 if(event.pointerType!=='mouse')return;
 if(pointerX!==event.clientX||pointerY!==event.clientY)delete root.dataset.scrolling;
 pointerX=event.clientX;pointerY=event.clientY;
},{passive:true});
el('q').oninput=()=>updateURL({q:el('q').value},true);
el('prev').onclick=()=>updateURL({day:selection().day-1});
el('next').onclick=()=>updateURL({day:selection().day+1});
el('current').onclick=()=>updateURL({season:'',day:''});
addEventListener('popstate',refresh);
addEventListener('fa:source-change',start);
addEventListener('fa:world-invalidated',start);
addEventListener('pageshow',e=>{if(e.persisted)start()});
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
start();
