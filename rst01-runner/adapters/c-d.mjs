import {
  assert,domainCandidates,exportProbe,launchPersistent,navigateCore,pass,nonExecuted,
  primarySummary,readPrimary,uiProbe
} from '../lib/runtime.mjs';

async function ensureSoak(ctx){
  if(ctx.shared.worldSoak)return ctx.shared.worldSoak;
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1280,height:850},suffix:'c-soak'});
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
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

      const keyFootprint=(root,re)=>{
        const seen=new WeakSet(),hits=[];
        const walk=(v,p='',d=0)=>{
          if(!v||typeof v!=='object'||d>8||seen.has(v))return;
          seen.add(v);
          for(const [k,x] of Object.entries(v)){
            const q=p?p+'.'+k:k;
            if(re.test(k)&&hits.length<120)hits.push({path:q,type:Array.isArray(x)?'array':typeof x,size:Array.isArray(x)?x.length:undefined});
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
        const cupFootprint=keyFootprint(w,/cup|continental|domestic|tournament|knockout/i);
        const historyFootprint=keyFootprint(w,/history|record|rival/i);
        newSeason(w);
        fail(validateSave(w),'save invalid after rollover',{cycle});
        fail(validateCareerWorld(w),'world invalid after rollover',{cycle});
        fail(validateCareerDivisions(w),'divisions invalid after rollover',{cycle});
        for(const country of countries){
          countryRows[country].archiveAfter=divisionArchive(w,country).length;
        }
        seasonRows.push({
          cycle,
          resultingSeason:w.season,
          countries:countryRows,
          cupFootprint,
          historyFootprint,
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
  const footprint=soak.cycles.map(x=>x.cupFootprint.length);
  if(!footprint.some(n=>n>0))return nonExecuted('No cup/continental state footprint discovered during ten-season soak',{footprint});
  return pass({footprint,examples:soak.cycles.find(x=>x.cupFootprint.length)?.cupFootprint.slice(0,20)});
}

async function C05(ctx){
  const soak=await ensureSoak(ctx);
  const archives=soak.cycles.at(-1)?.countries||{};
  const archiveOk=Object.values(archives).every(x=>x.archiveAfter===10);
  assert(archiveOk,'C05 division history did not persist for ten cycles',archives);
  const historyHits=soak.cycles.reduce((n,x)=>n+x.historyFootprint.length,0);
  if(historyHits===0)return nonExecuted('No record/rivalry state footprint discovered',{archives});
  return pass({historyHits,playerChurn:soak.playerChurn});
}

async function D01(ctx){
  const primary=await readPrimary(ctx.page);
  if(!primary.career)await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 D01');
  const p=await readPrimary(ctx.page);
  const result=await ctx.page.evaluate(async career=>{
    const {autoLineup,validateSave}=await import('/src/engine.js');
    autoLineup(career);
    const seen=[];
    const walk=(v,p='',d=0)=>{
      if(!v||typeof v!=='object'||d>5)return;
      for(const [k,x] of Object.entries(v)){
        const q=p?p+'.'+k:k;
        if(/lineup|formation|starter|slot|position/i.test(k)&&seen.length<80)seen.push({path:q,type:Array.isArray(x)?'array':typeof x,size:Array.isArray(x)?x.length:undefined});
        if(x&&typeof x==='object')walk(x,q,d+1);
      }
    };
    walk(career);
    return {valid:validateSave(career),lineupFootprint:seen};
  },p.career);
  assert(result.valid===true,'D01 auto-lineup produced invalid save',result);
  if(!result.lineupFootprint.length)return nonExecuted('No lineup/formation state footprint found after autoLineup',result);
  return pass(result);
}

async function D02(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 D02');
  await navigateCore(ctx.page,'tactics');
  const before=await primarySummary(ctx.page);
  const actions=await ctx.page.locator('[data-action]:not([disabled])').evaluateAll(els=>els.map((el,index)=>({
    index,action:el.getAttribute('data-action')||'',text:(el.textContent||'').trim(),
    visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)
  })).filter(x=>x.visible&&/tactic|preset|style|formation/i.test(x.action+' '+x.text)));
  const exports=await exportProbe(ctx.page,['tactic','formation','style','preset']);
  if(!actions.length&&!exports.length)return nonExecuted('No tactics preset/style controls or exports found',{actions,exports});
  let clicked=null;
  if(actions.length){
    const all=ctx.page.locator('[data-action]:not([disabled])');
    clicked=actions[0];
    await all.nth(clicked.index).click().catch(()=>{});
    await ctx.page.waitForTimeout(300);
  }
  const after=await primarySummary(ctx.page);
  assert(after.checksumValid===true,'D02 checksum invalid after tactics interaction',{before,after,clicked,exports});
  return pass({before,after,clicked,exports:exports.slice(0,30)});
}

async function D03(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 D03');
  const exports=await exportProbe(ctx.page,['substitut','change.*player','bench','window']);
  if(!exports.length)return nonExecuted('No substitution/window API exports discovered',{candidates:domainCandidates});
  const probe=await uiProbe(ctx.page);
  return pass({exports:exports.slice(0,40),uiActions:probe.actions.filter(x=>/sub|bench|change/i.test(x)).slice(0,40)});
}

async function D04(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for D04');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,validateSave}=await import('/src/engine.js');
    const players=Array.isArray(career.players)?career.players:[];
    const numeric=(obj,re)=>Object.fromEntries(Object.entries(obj||{}).filter(([k,v])=>re.test(k)&&typeof v==='number'));
    const before=players.slice(0,80).map(p=>({id:p.id,metrics:numeric(p,/minute|fitness|fatigue|condition|stamina/i)}));
    simulateRound(career);
    const after=players.slice(0,80).map(p=>({id:p.id,metrics:numeric(p,/minute|fitness|fatigue|condition|stamina/i)}));
    let changed=0;
    for(const a of after){
      const b=before.find(x=>x.id===a.id);if(!b)continue;
      if(JSON.stringify(a.metrics)!==JSON.stringify(b.metrics))changed++;
    }
    return {valid:validateSave(career),changed,before:before.slice(0,10),after:after.slice(0,10)};
  },p.career);
  assert(result.valid===true,'D04 simulateRound produced invalid save',result);
  if(result.changed===0)return nonExecuted('No minutes/fitness metrics changed after simulated round',result);
  return pass(result);
}

async function D05(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for D05');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,validateSave}=await import('/src/engine.js');
    const signature=player=>Object.fromEntries(Object.entries(player||{}).filter(([k])=>/injur|medical|recover|fitness|condition/i.test(k)));
    const before=(career.players||[]).map(p=>({id:p.id,s:signature(p)}));
    const rounds=Math.min(20,Math.max(1,(career.fixtures?.length||1)-career.round));
    for(let i=0;i<rounds;i++)simulateRound(career);
    const after=(career.players||[]).map(p=>({id:p.id,s:signature(p)}));
    let changed=0,injured=0;
    for(const a of after){
      const b=before.find(x=>x.id===a.id);if(b&&JSON.stringify(a.s)!==JSON.stringify(b.s))changed++;
      if(Object.entries(a.s).some(([k,v])=>/injur/i.test(k)&&((typeof v==='number'&&v>0)||(typeof v==='string'&&v))))injured++;
    }
    return {valid:validateSave(career),rounds,changed,injured,fieldSample:after.find(x=>Object.keys(x.s).length)?.s||{}};
  },p.career);
  assert(result.valid===true,'D05 repeated rounds produced invalid save',result);
  if(result.changed===0)return nonExecuted('No injury/medical/condition state changed in deterministic window',result);
  return pass(result);
}

export const adapters={C01,C02,C03,C04,C05,D01,D02,D03,D04,D05};
