import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateAuthoritativeSeason,adaptAuthoritativeSeason,createAuthoritativeLoader} from '../assets/authoritative-season.mjs';
const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
const definition=manifest.competitions.find(c=>c.id==='IT-1');
const clubs=manifest.divisions.find(d=>d.id==='IT-1').clubs;
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:4,seasonNumber:1,phase:'active',day:1};
const empty=()=>({schemaVersion:1,providerId:'authoritative-world',competitionId:'IT-1',selectedSeason:1,world,status:'empty',reason:'calendar-unpublished',provenance:{kind:'none',resultAuthority:null,sourceRef:null},data:null});
const ctx=()=>({definition,selectedSeason:1,revision:1});
test('requires exact viewed identity and never treats missing/fictional responses as real data',()=>{
 assert.equal(validateAuthoritativeSeason(empty(),ctx(),manifest).data,null);
 for(const change of [{providerId:'dev-fictional'},{competitionId:'IT-2'},{selectedSeason:2},{world:{...world,day:57}},{status:'available',data:{}}])assert.throws(()=>validateAuthoritativeSeason({...empty(),...change},ctx(),manifest));
});
test('a transport failure clears old supplied data and does not commit an invented response',async()=>{
 let context=ctx(),clears=0,commits=0;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{clears++;context={...context,revision:context.revision+1}},commit:()=>{commits++},isDev:()=>false,fetchJson:async()=>{throw Error('offline')},manifest});
 await loader.load();assert.equal(clears,1);assert.equal(commits,0);
});
test('does not request or overwrite protected DEV data',async()=>{
 let calls=0;const loader=createAuthoritativeLoader({getContext:ctx,clear:()=>{calls++},commit:()=>{calls++},isDev:()=>true,fetchJson:async()=>{calls++},manifest});
 await loader.load();assert.equal(calls,0);
});
test('a reset during read rejects the obsolete generation before commit',async()=>{
 let context=ctx(),calls=0,commits=0;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{context={...context,revision:context.revision+1}},commit:()=>{commits++},isDev:()=>false,fetchJson:async path=>path==='/api/world'?{world:++calls===1?world:{...world,generation:'12345678-1234-4123-8123-123456789abc',seasonNumber:0,day:0,revision:0,phase:'unstarted'}}:empty(),manifest});
 await loader.load();assert.equal(commits,0);
});
test('out-of-order requests cannot commit into a newer context',async()=>{
 let context=ctx(),release,commits=0;
 const delayed=new Promise(resolve=>{release=resolve});let calls=0;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{context={...context,revision:context.revision+1}},commit:()=>{commits++;return true},isDev:()=>false,fetchJson:async path=>path==='/api/world'?{world}:++calls===1?delayed:empty(),manifest});
 const first=loader.load();await Promise.resolve();await Promise.resolve();
 await loader.load();release(empty());await first;
 assert.equal(commits,1);
});
test('adapts validated empty source without inventing league or player statistics',()=>{
 assert.equal(adaptAuthoritativeSeason(validateAuthoritativeSeason(empty(),ctx(),manifest),ctx(),manifest),null);
 assert.equal(clubs.length,16);
});
function source(){
 const ids=clubs.map(c=>c.countryId+'-'+c.clubId),ring=[...ids],fixtures=[];
 for(let round=1;round<=15;round++){
  for(let i=0;i<8;i++){
   const [home,away]=(round+i)%2?[ring[i],ring[15-i]]:[ring[15-i],ring[i]];
   for(const [r,h,a] of [[round,home,away],[round+15,away,home]])fixtures.push({id:`season:1:IT-1:N${String(r).padStart(2,'0')}:${h}:${a}`,competitionId:'IT-1',day:r+12,round:r,marker:'N'+String(r).padStart(2,'0'),homeClubId:h,awayClubId:a,phaseId:'league',tieId:null,leg:null,neutral:false,result:null});
  }ring.splice(1,0,ring.pop());
 }
 const zero=id=>({clubId:id,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0});
 return {...empty(),status:'partial',reason:null,provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:'world:'+world.generation+':season:1:'+'a'.repeat(64)},data:{season:1,rulesVersion:definition.rules.version,participants:ids,fixtures,
  standings:{complete:false,rows:ids.map((id,i)=>({...zero(id),rank:i+1,points:0}))},statistics:{matchesPlayed:0,totalGoals:0,goalsPerMatch:0,teams:ids.map(id=>({...zero(id),cleanSheets:0})),players:null,playerStatus:'unavailable'},
  calendar:Array.from({length:56},(_,i)=>({day:i+1,fixtureIds:fixtures.filter(f=>f.day===i+1).map(f=>f.id),played:0})),history:null}};
}
test('adapts a complete published schedule into existing domestic fixture and table contracts',()=>{
 const raw=source(),data=adaptAuthoritativeSeason(validateAuthoritativeSeason(raw,ctx(),manifest),ctx(),manifest);
 assert.equal(data.fixtures.length,240);assert.equal(data.statistics.standings.length,16);
 assert.equal(data.statistics.players.length,0);assert.equal(data.statistics.teams.length,16);
 assert.equal(typeof data.fixtures[0].homeId,'number');assert.equal(data.fixtures[0].kickoff,null);
 assert.equal(data.provenance.kind,'authoritative');assert.equal(data.currentMatchday,1);
 assert.ok(Object.isFrozen(data));
});
test('rejects future scores, wrong rules, standings totals, identities and fabricated player statistics',()=>{
 const changes=[
  r=>{r.data.fixtures[0].result={homeGoals:0,awayGoals:0,resolution:'regulation',extraTime:null,penalties:null,winnerClubId:null}},
  r=>{r.data.rulesVersion='unapproved-v99'},
  r=>{r.data.standings.rows[0].points=3},
  r=>{r.data.participants[0]='FR-40'},
  r=>{r.data.statistics.players=[]},
  r=>{r.data.calendar[0].fixtureIds=['unknown']},
 ];
 for(const change of changes){const raw=source();change(raw);assert.throws(()=>validateAuthoritativeSeason(raw,ctx(),manifest));}
});
test('does not commit when the selected season changes while awaiting sporting data',async()=>{
 let context=ctx(),release;const delayed=new Promise(resolve=>{release=resolve});let commits=0;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{context={...context,revision:context.revision+1}},commit:()=>{commits++},isDev:()=>false,fetchJson:async path=>path==='/api/world'?{world}:delayed,manifest});
 const pending=loader.load();await Promise.resolve();await Promise.resolve();
 context={...context,selectedSeason:2,revision:context.revision+1};release(source());await pending;
 assert.equal(commits,0);
});

test('current-matchday shortcut follows the next canonical event and disappears after closure',()=>{
 const raw=source();raw.world={...world,day:13};
 // The adapter consumes validated source data; isolate shortcut selection from score validation.
 assert.equal(adaptAuthoritativeSeason(raw,ctx(),manifest).currentMatchday,2);
 raw.world={...world,day:56};assert.equal(adaptAuthoritativeSeason(raw,ctx(),manifest).currentMatchday,null);
 raw.world={...world,phase:'closed',day:56};assert.equal(adaptAuthoritativeSeason(raw,ctx(),manifest).currentMatchday,null);
});
test('accepts a Season2 promotion without reusing inaugural division membership',()=>{
 const raw=source(),mapping=new Map();raw.selectedSeason=2;raw.world={...world,seasonNumber:2};raw.data.season=2;raw.data.seasonState={day:1,phase:'active'};
 raw.provenance.sourceRef='world:'+world.generation+':season:2:'+'a'.repeat(64);
 raw.data.participants=raw.data.participants.map(id=>id==='IT-16'?'IT-17':id);
 for(const row of [...raw.data.standings.rows,...raw.data.statistics.teams])if(row.clubId==='IT-16')row.clubId='IT-17';
 for(const f of raw.data.fixtures){const old=f.id;if(f.homeClubId==='IT-16')f.homeClubId='IT-17';if(f.awayClubId==='IT-16')f.awayClubId='IT-17';f.id=`season:2:IT-1:${f.marker}:${f.homeClubId}:${f.awayClubId}`;mapping.set(old,f.id)}
 for(const day of raw.data.calendar)day.fixtureIds=day.fixtureIds.map(id=>mapping.get(id));
 const c={...ctx(),selectedSeason:2};const data=adaptAuthoritativeSeason(validateAuthoritativeSeason(raw,c,manifest),c,manifest);
 assert.ok(data.participants.some(c=>c.clubId===17));assert.equal(data.season,2);
});
