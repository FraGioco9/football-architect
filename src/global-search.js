import {getLeagueClubs} from './leagues.js';

// Ephemeral and deterministic: only existing pages and scheduled fixtures.
// Never persists a query or creates match outcomes.
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const match=(text,tokens)=>tokens.every(token=>fold(text).includes(token));

export function searchCareer(query,lang,meta,calendar,now='',limit=8){
 const tokens=fold(query).trim().split(/\s+/).filter(Boolean);
 if(!tokens.length||!meta||!Array.isArray(calendar?.matchdays))return [];
 const max=Math.max(1,Math.min(12,Number.isInteger(limit)?limit:8));
 const pages=[
  {kind:'page',route:'/dashboard',title:'Dashboard',detail:lang==='en'?'Career overview':'Riepilogo carriera',terms:'dashboard scrivania carriera career home'},
  {kind:'page',route:'/calendar',title:lang==='en'?'Calendar':'Calendario',detail:lang==='en'?'Scheduled fixtures':'Partite programmate',terms:'calendar calendario partite fixtures matches giornate rounds'}
 ];
 const results=pages.filter(p=>match(p.title+' '+p.detail+' '+p.terms,tokens)).map(({terms,...p})=>p);
 const clubs=new Map(getLeagueClubs(meta.countryId).map(c=>[c.id,c.name]));
 const fixtures=calendar.matchdays.flatMap(day=>day.fixtures);
 const hits=fixtures.flatMap(f=>{
  const home=clubs.get(f.homeClubId),away=clubs.get(f.awayClubId);
  if(!home||!away)return [];
  const title=home+' — '+away;
  const info=f.date+' '+f.time+' '+f.matchday+' '+(lang==='en'?'round match home away':'giornata partita casa trasferta');
  if(!match(title+' '+info,tokens))return [];
  return [{kind:'fixture',title,detail:f.date+' · '+f.time+' · '+(lang==='en'?'Round ':'Giornata ')+f.matchday,date:f.date,matchday:f.matchday,at:f.date+'T'+f.time}];
 });
 // Upcoming fixtures first, followed by older dates, without fabricated results.
 hits.sort((a,b)=>{
  const ap=a.at>=now,bp=b.at>=now;
  return ap!==bp?(ap?-1:1):a.at.localeCompare(b.at)||a.title.localeCompare(b.title);
 });
 return [...results,...hits].slice(0,max).map(({at,...item})=>item);
}
