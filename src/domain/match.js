// Domain logic: no DOM, browser storage or UI dependencies.
import {clamp} from './rules.js';
import {clubPlayers,playerById} from './selectors.js';
import {formationSlots,teamStrength} from './lineups.js';

function poisson(rand,lambda){let t=1,n=-1,limit=Math.exp(-lambda);do{n++;t*=Math.max(1e-8,rand());}while(t>limit&&n<10);return Math.min(7,n);}

const choice=(rand,items)=>items[Math.floor(rand()*items.length)];

function weightedPlayer(rand,players){
  const weights={ATT:6,AS:3.5,AD:3.5,COC:3,CC:1.8,MED:.65,TD:.5,TS:.5,DC:.35,POR:.01};
  const total=players.reduce((s,p)=>s+(weights[p.position]||1)*(.5+p.ovr/100),0);
  let n=rand()*total;
  for(const p of players){n-=(weights[p.position]||1)*(.5+p.ovr/100);if(n<=0)return p;}
  return players.at(-1);
}

function avgRole(players,roles,fallback){const a=players.filter(p=>roles.includes(p.position));return a.length?a.reduce((s,p)=>s+p.ovr,0)/a.length:fallback;}

export function simulateMatch(w,m,rand){
  const lineupHome=formationSlots(w,m.home).map(id=>playerById(w,id)).filter(Boolean);
  const lineupAway=formationSlots(w,m.away).map(id=>playerById(w,id)).filter(Boolean);
  const strengthHome=teamStrength(w,m.home),strengthAway=teamStrength(w,m.away);
  let attackH=avgRole(lineupHome,['ATT','AD','AS','COC'],strengthHome),attackA=avgRole(lineupAway,['ATT','AD','AS','COC'],strengthAway);
  let defendH=avgRole(lineupHome,['DC','TD','TS','MED'],strengthHome),defendA=avgRole(lineupAway,['DC','TD','TS','MED'],strengthAway);
  const styleH=m.home===w.clubId?w.tactic:'Equilibrata',styleA=m.away===w.clubId?w.tactic:'Equilibrata';
  const bonus=s=>s==='Offensiva'?.23:s==='Prudente'?-.17:0;
  let xgH=clamp(1.28+(attackH-defendA)*.052+(strengthHome-strengthAway)*.032+.19+bonus(styleH)-bonus(styleA)*.35,.3,3.65);
  let xgA=clamp(1.08+(attackA-defendH)*.052+(strengthAway-strengthHome)*.032+bonus(styleA)-bonus(styleH)*.35,.3,3.65);
  if(m.home===w.clubId){
    if(w.tempo==='Alto')xgH*=1.08; else if(w.tempo==='Basso')xgH*=.96;
    if(w.pressing==='Alto'){xgH+=.14;xgA+=.09;}
    if(w.pressing==='Basso'){xgH-=.07;xgA-=.09;}
  }
  if(m.away===w.clubId){
    if(w.tempo==='Alto')xgA*=1.08; else if(w.tempo==='Basso')xgA*=.96;
    if(w.pressing==='Alto'){xgA+=.14;xgH+=.09;}
    if(w.pressing==='Basso'){xgA-=.07;xgH-=.09;}
  }
  xgH=clamp(xgH,.2,4);xgA=clamp(xgA,.2,4);
  let homeGoals=poisson(rand,xgH),awayGoals=poisson(rand,xgA);
  const goals=[];
  for(const [side,count,list] of [['home',homeGoals,lineupHome],['away',awayGoals,lineupAway]]){
    for(let i=0;i<count;i++){
      const scorer=weightedPlayer(rand,list),candidates=list.filter(p=>p.id!==scorer.id);
      const assister=rand()<.7?weightedPlayer(rand,candidates):null;
      const minute=3+Math.floor(rand()*90);
      goals.push({side,minute,scorerId:scorer.id,assistId:assister?.id||null});
      scorer.goals++;if(assister)assister.assists++;
    }
  }
  goals.sort((a,b)=>a.minute-b.minute);
  const possessionH=Math.round(clamp(50+(strengthHome-strengthAway)*1.05+(rand()-.5)*13,30,70));
  const shotsHome=Math.max(homeGoals,Math.round(xgH*5+rand()*5)),shotsAway=Math.max(awayGoals,Math.round(xgA*5+rand()*5));
  const result={homeGoals,awayGoals,goals,xgHome:+xgH.toFixed(2),xgAway:+xgA.toFixed(2),possessionHome:possessionH,shotsHome,shotsAway};
  for(const [clubId,lineup,conceded] of [[m.home,lineupHome,awayGoals],[m.away,lineupAway,homeGoals]]){
    const active=new Set(lineup.map(p=>p.id));
    const bench=clubPlayers(w,clubId).filter(p=>!active.has(p.id)&&!p.injury).sort((a,b)=>b.ovr-a.ovr).slice(0,3);
    const everyone=[...lineup,...bench];
    for(const [idx,p] of everyone.entries()){
      p.apps++;
      const extraPress=clubId===w.clubId&&w.pressing==='Alto'?4:0;
      p.fitness=clamp(p.fitness-(idx<11?15+Math.round(rand()*9)+extraPress:6+Math.round(rand()*6)),32,100);
      p.morale=clamp(p.morale+(clubId===m.home?homeGoals-awayGoals:awayGoals-homeGoals)*2+Math.round(rand()*5)-2,20,100);
      p.form=clamp(+(6.5+(clubId===m.home?homeGoals-awayGoals:awayGoals-homeGoals)*.25+rand()*.7).toFixed(1),4,10);
      if(idx<11&&p.position==='POR'&&conceded===0)p.cleanSheets++;
      if(rand()<.007){p.injury=1+Math.floor(rand()*3);}
      if(rand()<.07)p.yellow++;
    }
  }
  m.result=result;
  return result;
}
