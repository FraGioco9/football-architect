import assert from 'node:assert/strict';
import test from 'node:test';
import {canArchiveAtTerminalMilestone,canCloseArchivedSeason,canPrepareApprovedNextSeason,type TerminalMilestoneRow} from '../src/domain/calendar/terminal-milestone-policy.ts';

const hash='archived-results-digest';
const archive:TerminalMilestoneRow={event_id:'season:archive',kind:'archive-season',scope:'season',scheduled_day:56,event_order:9000,status:'completed',receipt_hash:hash};
const close:TerminalMilestoneRow={event_id:'season:close',kind:'close-season',scope:'season',scheduled_day:56,event_order:9100,status:'scheduled',receipt_hash:null};
const next:TerminalMilestoneRow={event_id:'season:next-prepare',kind:'prepare-next-season',scope:'season',scheduled_day:56,event_order:9200,status:'scheduled',receipt_hash:null};
const replace=(rows:readonly TerminalMilestoneRow[],id:string,patch:Partial<TerminalMilestoneRow>)=>rows.map(row=>row.event_id===id?{...row,...patch}:row);

// Independent pre-extraction predicates, copied from main's two versioned commands.
function legacyClose(events:readonly TerminalMilestoneRow[],archiveHash:string):boolean {
  const archived=events.find(e=>e.event_id==='season:archive'),closing=events.find(e=>e.event_id==='season:close');
  return !(!archived||archived.kind!=='archive-season'||archived.scope!=='season'||archived.scheduled_day!==56||archived.status!=='completed'||archived.receipt_hash!==archiveHash||
    !closing||closing.kind!=='close-season'||closing.scope!=='season'||closing.scheduled_day!==56||closing.status!=='scheduled'||closing.event_order<=archived.event_order||
    events.some(e=>e.status==='scheduled'&&e.event_id!=='season:close'&&e.event_id!=='season:next-prepare'));
}
function legacyPrepare(completion:readonly TerminalMilestoneRow[],sourceArchiveHash:string):boolean {
  const archived=completion.find(e=>e.event_id==='season:archive'),closing=completion.find(e=>e.event_id==='season:close'),following=completion.find(e=>e.event_id==='season:next-prepare');
  return !(!archived||!closing||!following||archived.kind!=='archive-season'||closing.kind!=='close-season'||following.kind!=='prepare-next-season'||
    completion.some(e=>e.scope!=='season'||e.scheduled_day!==56)||
    !(archived.event_order<closing.event_order&&closing.event_order<following.event_order)||
    archived.status!=='completed'||closing.status!=='completed'||following.status!=='scheduled'||
    archived.receipt_hash!==sourceArchiveHash||closing.receipt_hash!==sourceArchiveHash||following.receipt_hash!==null);
}
const variants:ReadonlyArray<Partial<TerminalMilestoneRow>>=[
  {kind:'other'},{scope:'other'},{scheduled_day:55},{scheduled_day:57},
  {event_order:100},{event_order:8999},{event_order:9000},{event_order:9100},{event_order:9200},{event_order:9300},
  {status:'completed'},{status:'scheduled'},{status:'other'},
  {receipt_hash:null},{receipt_hash:'wrong'},{receipt_hash:hash},
  {event_id:'other'},
];

test('archive milestone preserves previously enforced status and minimum ordering',()=>{
  assert.equal(canArchiveAtTerminalMilestone(null),false);
  for(const status of ['scheduled','completed','other'])for(const order of [-1,0,7999,8000,9000,9200]){
    assert.equal(canArchiveAtTerminalMilestone({status,event_order:order}),status==='scheduled'&&order>=8000);
  }
});

test('close command has byte-for-byte predicate parity across row mutations, absent rows and pending events',()=>{
  const baseline=[archive,close,next];
  const scenarios:TerminalMilestoneRow[][]=[baseline,[],[archive],[close],[next],[archive,close],
    [...baseline,{...archive,event_id:'domestic:unfinished',status:'scheduled'}],
    [...baseline,{...archive,event_id:'domestic:complete'}]];
  for(const row of baseline)for(const variant of variants)scenarios.push(replace(baseline,row.event_id,variant));
  for(const events of scenarios)for(const digest of [hash,'wrong',''])
    assert.equal(canCloseArchivedSeason(events,digest),legacyClose(events,digest),JSON.stringify({events,digest}));
  assert.equal(canCloseArchivedSeason(baseline,hash),true);
});

test('prepare-next command preserves version-specific strict three-row ordering and receipt parity',()=>{
  const completedClose={...close,status:'completed',receipt_hash:hash};
  const baseline=[archive,completedClose,next];
  const scenarios:TerminalMilestoneRow[][]=[baseline,[],[archive],[completedClose],[next],[archive,completedClose],
    [...baseline,{...archive,event_id:'extra',status:'scheduled'}]];
  for(const row of baseline)for(const variant of variants)scenarios.push(replace(baseline,row.event_id,variant));
  for(const events of scenarios)for(const digest of [hash,'wrong',''])
    assert.equal(canPrepareApprovedNextSeason(events,digest),legacyPrepare(events,digest),JSON.stringify({events,digest}));
  assert.equal(canPrepareApprovedNextSeason(baseline,hash),true);
});

test('terminal predicates are read-only and do not mutate receipts or rows',()=>{
  const rows=Object.freeze([archive,Object.freeze({...close,status:'completed',receipt_hash:hash}),next].map(e=>Object.freeze({...e})));
  const before=JSON.stringify(rows);
  canCloseArchivedSeason(rows,hash);
  canPrepareApprovedNextSeason(rows,hash);
  assert.equal(JSON.stringify(rows),before);
});
