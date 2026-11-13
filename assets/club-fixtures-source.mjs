// Read-only Club Fixtures projection. Authority stays with the shared season validator.
import {validPublicWorld,scoreValid} from './authoritative-season.mjs';
import {competitionIdsForClub} from './club-season-source.mjs';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const same=(a,b)=>['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k]);
export function projectClubFixtures(fixtures,clubKey,season,day){
 competitionIdsForClub(clubKey);
 const seen=new Set();
 return Object.freeze(fixtures.filter(f=>[f.homeClubId,f.awayClubId].includes(clubKey)).map(f=>{
  if(!f.id||seen.has(f.id)||!Number.isInteger(f.day)||f.day<1||f.day>56||typeof f.neutral!=='boolean')throw TypeError('Invalid club fixture');
  seen.add(f.id);
  if(f.result&&f.day>day)throw TypeError('Future club result');
  if(f.result&&!scoreValid(f.result,f))throw TypeError('Invalid club result');
  const home=f.homeClubId===clubKey,result=f.result,penalties=result?.penalties;
  return Object.freeze({id:f.id,competitionId:f.competitionId,season,day:f.day,round:f.round,phaseId:f.phaseId,
   marker:f.marker??'',tieId:f.tieId??null,leg:f.leg??null,opponentId:home?f.awayClubId:f.homeClubId,
   venue:f.neutral?'neutral':home?'home':'away',goalsFor:result?(home?result.homeGoals:result.awayGoals):null,
   goalsAgainst:result?(home?result.awayGoals:result.homeGoals):null,resolution:result?.resolution??null,
   penalties:penalties?Object.freeze({for:home?penalties.home:penalties.away,against:home?penalties.away:penalties.home}):null});
 }).sort((a,b)=>a.day-b.day||compare(a.competitionId,b.competitionId)||compare(a.marker,b.marker)||
  a.round-b.round||compare(a.tieId??'',b.tieId??'')||(a.leg??0)-(b.leg??0)||compare(a.id,b.id)));
}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const bad=()=>{throw TypeError('Invalid authoritative club fixture payload')};
export async function readClubFixtures({clubKey,season,world,fetchJson,manifest,signal}){
 const allowed=competitionIdsForClub(clubKey);
 if(!validPublicWorld(world)||typeof fetchJson!=='function')throw TypeError('Invalid club fixture read');
 const base={source:'authoritative',clubKey,season,world,day:season===world.seasonNumber?world.day:56,competitions:[],rows:[],unavailable:[]};
 if(world.seasonNumber===0||season===0)return {...base,coverage:'unstarted'};
 if(!Number.isInteger(season)||season<1||season>world.seasonNumber||world.seasonNumber>2)return {...base,coverage:'unavailable'};
 const payload=await fetchJson('/api/clubs/'+clubKey+'/seasons/'+season+'/fixtures',{signal});
 if(signal?.aborted)throw Error('Club fixtures cancelled');
 if(!object(payload)||payload.schemaVersion!==1||payload.providerId!=='authoritative-world'||
   payload.clubKey!==clubKey||payload.selectedSeason!==season||!same(payload.world,world))bad();
 if(payload.status==='empty'){
  if(!['season-not-prepared','calendar-unpublished'].includes(payload.reason)||payload.data!==null||
    payload.provenance?.kind!=='none'||payload.provenance?.sourceRef!==null||payload.provenance?.resultAuthority!==null)bad();
  return {...base,coverage:'unpublished'};
 }
 if(payload.status==='unavailable'){
  if(!['unsupported-season','unsupported-world-season'].includes(payload.reason)||payload.data!==null||
    payload.provenance?.kind!=='none'||payload.provenance?.sourceRef!==null||payload.provenance?.resultAuthority!==null)bad();
  return {...base,coverage:'unavailable'};
 }
 const closed=season<world.seasonNumber||world.phase==='closed',data=payload.data,provenance=payload.provenance;
 if(payload.status!==(closed?'available':'partial')||payload.reason!==null||
   provenance?.kind!=='authoritative'||provenance.resultAuthority!=='temporary-score-v1'||
   typeof provenance.sourceRef!=='string'||
   !provenance.sourceRef.startsWith('club-fixtures:'+world.generation+':season:'+season+':')||
   !/^[a-f0-9]{64}$/.test(provenance.sourceRef.split(':').at(-1))||
   !object(data)||data.season!==season||!object(data.seasonState)||
   data.seasonState.day!==base.day||data.seasonState.phase!==(closed?'closed':world.phase)||
   !Array.isArray(data.competitions)||!Array.isArray(data.fixtures)||!Array.isArray(manifest?.competitions))bad();
 const ids=new Set(),competitions=[];
 for(const id of data.competitions){
  if(typeof id!=='string'||!allowed.includes(id)||ids.has(id))bad();
  const definition=manifest.competitions.find(c=>c.id===id);
  if(!definition)bad();
  ids.add(id);competitions.push(definition);
 }
 const domestic=[...ids].filter(id=>!id.startsWith('int-'));
 if((ids.size>0&&domestic.length!==1)||ids.size>2)bad();
 for(const f of data.fixtures){
  if(!object(f)||!ids.has(f.competitionId)||
    ![f.homeClubId,f.awayClubId].includes(clubKey)||f.homeClubId===f.awayClubId||
    typeof f.homeClubId!=='string'||typeof f.awayClubId!=='string'||
    !Number.isInteger(f.day)||f.day<1||f.day>56||
    (f.result!==null)!==(f.day<=base.day)||
    f.result!==null&&!scoreValid(f.result,f))bad();
 }
 const rows=projectClubFixtures(data.fixtures,clubKey,season,base.day);
 return {...base,competitions,rows,coverage:'complete'};
}
