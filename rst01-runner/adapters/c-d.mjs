import {
  assert,attachErrorCapture,domainCandidates,exportProbe,launchPersistent,navigateCore,pass,nonExecuted,
  primarySummary,readPrimary,uiProbe
} from '../lib/runtime.mjs';

async function ensureSoak(ctx){
  if(ctx.shared.worldSoak)return ctx.shared.worldSoak;
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1280,height:850},suffix:'c-soak'});
  const started=Date.now();
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    const cap=attachErrorCapture(page);
    await page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
      const [
        {makeWorld},
        {startCareer,simulateRound,newSeason,validateSave},
        advancedCareer,
        {enableCareerWorld,careerWorldLeague,OFFICIAL_WORLD_COUNTRIES,validateCareerWorld},
        {enableCareerDivisions,captureDivisionSeason,divisionLeague,divisionArchive,validateCareerDivisions}
      ]=await Promise.all([
        import('/src/data.js'),
        import('/src/engine.js'),
        import('/src/domain/advanced-career.js'),
        import('/src/domain/career-world.js'),
        import('/src/domain/career-divisions.js')
      ]);
      const fail=(ok,message,details)=>{if(!ok)throw new Error(message+' :: '+JSON.stringify(details||{}));};
      const w=makeWorld();
      startCareer(w,1,'RST01 C Soak');
      const enableAdvanced=advancedCareer.enableAdvancedCareer||Object.entries(advancedCareer).find(([name,value])=>/^enable/i.test(name)&&typeof value==='function')?.[1];
      fail(typeof enableAdvanced==='function','advanced career enable API unavailable',{exports:Object.keys(advancedCareer)});
      enableAdvanced(w);enableCareerWorld(w);enableCareerDivisions(w);
      const countries=[...OFFICIAL_WORLD_COUNTRIES];
      fail(countries.length===8,'expected eight countries',{countries});

      const semanticFootprint=(root,scopeRe,leafRe)=>{
        const seen=new WeakSet(),hits=[];
        const walk=(v,p='',d=0)=>{
          if(v===null||v===undefined||d>9)return;
          if(typeof v!=='object')return;
          if(seen.has(v))return;
          seen.add(v);
          for(const [k,x] of Object.entries(v)){
            const q=p?p+'.'+k:k;
            const inScope=scopeRe.test(q);
            if(inScope&&leafRe.test(k)&&hits.length<240){
              hits.push({
                path:q,
                value:(typeof x==='string'||typeof x==='number'||typeof x==='boolean')?x:undefined,
                size:Array.isArray(x)?x.length:undefined,
                type:Array.isArray(x)?'array':typeof x
              });
            }
            if(x&&typeof x==='object')walk(x,q,d+1);
          }
        };
        walk(root);return hits;
      };

      const seasonRows=[];
      const firstPlayerIds=new Set((w.players||[]).map(p=>p.id));
      for(let cycle=1;cycle<=10;cycle++){
        const target=w.fixtures.length;
        while(w.round<target)simulateRound(w);
        fail(w.round===target,'season did not complete',{cycle,round:w.round,target});
        fail(validateSave(w),'save invalid at season end',{cycle});
        fail(validateCareerWorld(w),'world invalid at season end',{cycle});
        fail(validateCareerDivisions(w),'divisions invalid at season end',{cycle});

        const plan=captureDivisionSeason(w);
        const countryRows={};
        for(const country of countries){
          const e=plan.countries[country];
          const world=careerWorldLeague(w,country);
          const lower=divisionLeague(w,country);
          fail(e.top.length===20&&e.bottom.length===20,'division table size invalid',{cycle,country});
          fail(new Set(e.promoted).size===3&&new Set(e.relegated).size===3,'movement count invalid',{cycle,country,e});
          fail(e.playoff?.matches?.length===3,'playoff bracket invalid',{cycle,country});
          countryRows[country]={
            topClubs:world.clubs.length,
            lowerClubs:lower.clubs.length,
            promoted:[...e.promoted],
            relegated:[...e.relegated],
            playoffWinner:e.playoff?.winnerId,
            archiveBefore:divisionArchive(w,country).length
          };
        }

        const cupEndEvidence=semanticFootprint(
          w,
          /cup|continental|domestic|tournament|knockout/i,
          /winner|champion|qualified|qualif|round|stage|archive|history/i
        );
        const historyEndEvidence=semanticFootprint(
          w,
          /history|record|rival/i,
          /history|record|rival|club|season|winner|champion|value/i
        );

        newSeason(w);
        fail(validateSave(w),'save invalid after rollover',{cycle});
        fail(validateCareerWorld(w),'world invalid after rollover',{cycle});
        fail(validateCareerDivisions(w),'divisions invalid after rollover',{cycle});
        for(const country of countries)countryRows[country].archiveAfter=divisionArchive(w,country).length;

        const cupPostEvidence=semanticFootprint(
          w,
          /cup|continental|domestic|tournament|knockout/i,
          /winner|champion|qualified|qualif|round|stage|archive|history/i
        );
        const historyPostEvidence=semanticFootprint(
          w,
          /history|record|rival/i,
          /history|record|rival|club|season|winner|champion|value/i
        );

        seasonRows.push({
          cycle,
          resultingSeason:w.season,
          countries:countryRows,
          cupEndEvidence,
          cupPostEvidence,
          historyEndEvidence,
          historyPostEvidence,
          playerCount:(w.players||[]).length
        });
      }
      const finalIds=(w.players||[]).map(p=>p.id);
      return {
        countries,
        cycles:seasonRows,
        final:{season:w.season,round:w.round,playerCount:finalIds.length,uniquePlayers:new Set(finalIds).size},
        playerChurn:{
          initial:firstPlayerIds.size,
          final:finalIds.length,
          retained:finalIds.filter(id=>firstPlayerIds.has(id)).length,
          newIds:finalIds.filter(id=>!firstPlayerIds.has(id)).length
        }
      };
    });
    result.runtime={errors:cap.errors,warnings:cap.warnings,elapsedMs:Date.now()-started};
    ctx.shared.worldSoak=result;
    return result;
  }finally{
    await made.context.close().catch(()=>{});
  }
}
async function C01(ctx){
  const soak=await ensureSoak(ctx);
  const ok=soak.cycles.every(row=>Object.keys(row.countries).length===8&&Object.values(row.countries).every(x=>x.topClubs===20&&x.lowerClubs===20));
  assert(ok,'C01 eight-country league matrix invalid',soak.cycles);
  return pass({countries:soak.countries,cycles:soak.cycles.map(x=>({cycle:x.cycle,resultingSeason:x.resultingSeason}))});
}

async function C02(ctx){
  const soak=await ensureSoak(ctx);
  assert(soak.cycles.length===10,'C02 expected ten completed seasons',{cycles:soak.cycles.length});
  assert(soak.final.round===0,'C02 expected rollover to round 0',soak.final);
  return pass({cycles:soak.cycles.length,final:soak.final});
}

async function C03(ctx){
  const soak=await ensureSoak(ctx);
  const bad=[];
  for(const row of soak.cycles)for(const [country,x] of Object.entries(row.countries)){
    if(x.promoted.length!==3||x.relegated.length!==3||x.playoffWinner==null||x.archiveAfter!==row.cycle)bad.push({cycle:row.cycle,country,x});
  }
  assert(!bad.length,'C03 promotion/relegation/playoff/archive mismatch',bad);
  return pass({verifiedCountries:soak.countries.length,verifiedCycles:soak.cycles.length});
}

async function C04(ctx){
  const soak=await ensureSoak(ctx);
  const rows=soak.cycles.map(row=>{
    const evidence=[...row.cupEndEvidence,...row.cupPostEvidence];
    const terminal=evidence.filter(x=>/winner|champion/i.test(x.path)&&x.value!==undefined&&String(x.value)!=='');
    const qualification=evidence.filter(x=>/qualif/i.test(x.path));
    const progression=evidence.filter(x=>/round|stage/i.test(x.path));
    const archive=evidence.filter(x=>/archive|history/i.test(x.path));
    return {cycle:row.cycle,terminal,qualification,progression,archive};
  });
  const complete=rows.every(x=>x.terminal.length&&x.progression.length&&(x.qualification.length||x.archive.length));
  if(!complete)return nonExecuted('Cup certification lacks terminal/progression/qualification-or-archive evidence for one or more seasons',{rows});
  const signatures=new Set(rows.map(x=>JSON.stringify(x.terminal.map(v=>[v.path,v.value]))));
  if(signatures.size<2)return nonExecuted('Cup terminal evidence did not vary across the ten-season run',{rows});
  return pass({cycles:rows.map(x=>({cycle:x.cycle,terminal:x.terminal.slice(0,12),qualificationCount:x.qualification.length,progressionCount:x.progression.length,archiveCount:x.archive.length}))});
}
async function C05(ctx){
  const soak=await ensureSoak(ctx);
  const archives=soak.cycles.at(-1)?.countries||{};
  const archiveOk=Object.values(archives).every(x=>x.archiveAfter===10);
  assert(archiveOk,'C05 division history did not persist for ten cycles',archives);

  const semantic=soak.cycles.map(row=>({
    cycle:row.cycle,
    evidence:[...row.historyEndEvidence,...row.historyPostEvidence]
  }));
  const hasRecord=semantic.some(x=>x.evidence.some(v=>/record/i.test(v.path)));
  const hasRivalry=semantic.some(x=>x.evidence.some(v=>/rival/i.test(v.path)));
  if(!hasRecord||!hasRivalry)return nonExecuted('Record/rivalry state could not both be evidenced across the ten-season history',{hasRecord,hasRivalry,semantic});
  const signatures=new Set(semantic.map(x=>JSON.stringify(x.evidence.map(v=>[v.path,v.value,v.size]))));
  if(signatures.size<2)return nonExecuted('Record/rivalry history did not produce distinct persisted season signatures',{semantic});
  return pass({archiveSeasons:10,hasRecord,hasRivalry,signatures:signatures.size,playerChurn:soak.playerChurn});
}
async function D01(ctx){
  const primary=await readPrimary(ctx.page);
  if(!primary.career)await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 D01');
  const p=await readPrimary(ctx.page);
  const result=await ctx.page.evaluate(async career=>{
    const {autoLineup,validateSave}=await import('/src/engine.js');
    autoLineup(career);
    const candidates=[];
    const seen=new WeakSet();
    const walk=(v,p='',d=0)=>{
      if(!v||typeof v!=='object'||d>7||seen.has(v))return;
      seen.add(v);
      for(const [k,x] of Object.entries(v)){
        const q=p?p+'.'+k:k;
        if(Array.isArray(x)&&/lineup|starter|starting.*xi|starting/i.test(k)){
          const ids=x.map(item=>typeof item==='number'||typeof item==='string'?item:(item?.playerId??item?.id)).filter(v=>v!==undefined&&v!==null);
          candidates.push({path:q,size:x.length,ids,unique:new Set(ids).size});
        }
        if(x&&typeof x==='object')walk(x,q,d+1);
      }
    };
    walk(career);
    const formation=[];
    const walkFormation=(v,p='',d=0)=>{
      if(!v||typeof v!=='object'||d>5)return;
      for(const [k,x] of Object.entries(v)){
        const q=p?p+'.'+k:k;
        if(/formation/i.test(k)&&(typeof x==='string'||typeof x==='number'))formation.push({path:q,value:x});
        if(x&&typeof x==='object')walkFormation(x,q,d+1);
      }
    };
    walkFormation(career);
    return {valid:validateSave(career),candidates,formation};
  },p.career);
  assert(result.valid===true,'D01 auto-lineup produced invalid save',result);
  const exact=result.candidates.find(x=>x.size===11&&x.ids.length===11&&x.unique===11);
  if(!exact||!result.formation.length)return nonExecuted('Could not prove an exact 11-player distinct starting lineup plus formation state',result);
  return pass({lineup:exact,formation:result.formation.slice(0,20)});
}
async function D02(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 D02');
  await navigateCore(ctx.page,'tactics');
  const before=await primarySummary(ctx.page);
  const fingerprint=async()=>ctx.page.evaluate(async()=>{
    const rec=await new Promise((resolve,reject)=>{
      const r=indexedDB.open('football-architect-primary-careers',1);
      r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get('primary');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);};
      r.onerror=()=>reject(r.error);
    });
    if(!rec?.raw)return [];
    const rows=JSON.parse(rec.raw),entries=new Map(rows),slot=[...entries].find(([k])=>/^football-architect:career:slot:/.test(k));
    if(!slot)return [];
    const career=JSON.parse(slot[1]),out=[],seen=new WeakSet();
    const walk=(v,p='',d=0)=>{if(!v||typeof v!=='object'||d>7||seen.has(v))return;seen.add(v);for(const [k,x] of Object.entries(v)){const q=p?p+'.'+k:k;if(/tactic|formation|style|press|tempo/i.test(k)&&(['string','number','boolean'].includes(typeof x)))out.push([q,x]);if(x&&typeof x==='object')walk(x,q,d+1);}};
    walk(career);return out.sort((a,b)=>a[0].localeCompare(b[0]));
  });
  const beforeFp=await fingerprint();

  const selects=ctx.page.locator('select:visible:not([disabled])');
  let changedControl=null;
  for(let i=0;i<await selects.count();i++){
    const el=selects.nth(i);
    const meta=await el.evaluate(node=>({name:node.name||'',id:node.id||'',aria:node.getAttribute('aria-label')||'',value:node.value,options:[...node.options].map(o=>({value:o.value,disabled:o.disabled}))}));
    if(!/tactic|formation|style|press|tempo/i.test(meta.name+' '+meta.id+' '+meta.aria))continue;
    const alt=meta.options.find(o=>!o.disabled&&o.value!==meta.value);
    if(!alt)continue;
    await el.selectOption(alt.value);
    await ctx.page.waitForTimeout(400);
    changedControl={...meta,to:alt.value};
    break;
  }
  if(!changedControl)return nonExecuted('No deterministic tactics select with an alternate value was found');

  const after=await primarySummary(ctx.page);
  const afterFp=await fingerprint();
  assert(after.checksumValid===true,'D02 checksum invalid after tactics change',{before,after,changedControl});
  const semanticChanged=JSON.stringify(beforeFp)!==JSON.stringify(afterFp);
  const persistedChanged=before.sha256!==after.sha256||before.revision!==after.revision;
  if(!semanticChanged||!persistedChanged)return nonExecuted('Tactics UI changed but a persisted tactical-state change could not be proven',{changedControl,beforeFp,afterFp,before,after});
  return pass({changedControl,before,after,beforeFingerprint:beforeFp,afterFingerprint:afterFp});
}
async function D03(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 D03');
  const exports=await exportProbe(ctx.page,['substitut','change.*player','bench','window']);
  const probe=await uiProbe(ctx.page);
  ctx.shared.substitutionEvidence={executed:false,exports,uiActions:probe.actions.filter(x=>/sub|bench|change/i.test(x)).slice(0,40)};
  return nonExecuted('Behavioral substitution driver is still required: API/UI presence alone is not accepted as PASS',ctx.shared.substitutionEvidence);
}
async function D04(ctx){
  if(!ctx.shared.substitutionEvidence?.executed){
    return nonExecuted('D04 requires a completed D03 substitution scenario; no substitution was behaviorally executed',ctx.shared.substitutionEvidence||{});
  }
  return nonExecuted('D04 post-substitution minutes/fitness assertions are intentionally blocked until D03 produces concrete substitution evidence');
}
async function D05(ctx){
  if(!ctx.shared.substitutionEvidence?.executed){
    return nonExecuted('D05 requires a completed substitution scenario before injury-during-change/recovery can be certified',ctx.shared.substitutionEvidence||{});
  }
  return nonExecuted('D05 injury-during-substitution and medical-return driver remains to be implemented');
}
export const adapters={C01,C02,C03,C04,C05,D01,D02,D03,D04,D05};
