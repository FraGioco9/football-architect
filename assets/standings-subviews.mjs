/* Presentation-only standings splits from the already verified season snapshot.
 * Never replaces the authoritative Overall ranking or qualification decisions. */
export const STANDINGS_SUBVIEWS=Object.freeze(['overall','first','second','home','away','last5']);
const identity=(club,international)=>international?club.countryId+'-'+club.clubId:String(club.clubId);
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const scored=game=>Number.isSafeInteger(game.homeGoals)&&game.homeGoals>=0&&
  Number.isSafeInteger(game.awayGoals)&&game.awayGoals>=0;
const result=(own,other)=>own>other?'W':own<other?'L':'D';

export function projectStandings(rows,fixtures,definition,mode){
  if(!STANDINGS_SUBVIEWS.includes(mode)||!Array.isArray(rows))return null;
  if(mode==='overall')return rows;
  const international=definition?.category==='international';
  if(international&&(mode==='first'||mode==='second'))return null;
  const roundCount=definition?.metrics?.phases?.league?.rounds;
  if(!Number.isSafeInteger(roundCount)||roundCount<2||!Array.isArray(fixtures))return null;
  if((mode==='first'||mode==='second')&&roundCount%2!==0)return null;
  const clubs=new Map();
  for(const row of rows){
    if(!row?.club)return null;
    const id=identity(row.club,international);
    if(clubs.has(id))return null;
    clubs.set(id,{row,matches:[]});
  }
  const seen=new Set();
  for(const fixture of fixtures){
    if(fixture?.phaseId!=='league')continue; // Knockouts never enter league tables.
    const home=String(fixture.homeId),away=String(fixture.awayId);
    if(!clubs.has(home)||!clubs.has(away)||home===away||
      !Number.isSafeInteger(fixture.round)||fixture.round<1||fixture.round>roundCount)return null;
    if(fixture.homeGoals==null&&fixture.awayGoals==null)continue;
    if(!scored(fixture))return null;
    const key=[fixture.round,home,away].join('|');
    if(seen.has(key))return null;
    seen.add(key);
    const order=[fixture.round,Number.isSafeInteger(fixture.day)?fixture.day:0,
      String(fixture.sourceFixtureId??fixture.id??key)];
    clubs.get(home).matches.push({fixture,home:true,order});
    clubs.get(away).matches.push({fixture,home:false,order});
  }
  const ordered=([...matches])=>matches.sort((a,b)=>
    a.order[0]-b.order[0]||a.order[1]-b.order[1]||cmp(a.order[2],b.order[2]));
  const resultRows=[];
  for(const [id,{row,matches}] of clubs){
    const all=ordered(matches);
    // A partial fixture payload must not yield a plausible but false split table.
    const goals=all.reduce((sum,{fixture,home})=>{
      sum.gf+=home?fixture.homeGoals:fixture.awayGoals;
      sum.ga+=home?fixture.awayGoals:fixture.homeGoals;
      return sum;
    },{gf:0,ga:0});
    if(row.played!==all.length||row.gf!==goals.gf||row.ga!==goals.ga)return null;
    let selected=all;
    if(mode==='first')selected=all.filter(x=>x.fixture.round<=roundCount/2);
    if(mode==='second')selected=all.filter(x=>x.fixture.round>roundCount/2);
    if(mode==='home')selected=all.filter(x=>x.home);
    if(mode==='away')selected=all.filter(x=>!x.home);
    if(mode==='last5')selected=all.slice(-5);
    let won=0,drawn=0,lost=0,gf=0,ga=0;
    for(const {fixture,home} of selected){
      const own=home?fixture.homeGoals:fixture.awayGoals;
      const other=home?fixture.awayGoals:fixture.homeGoals;
      gf+=own;ga+=other;
      if(own>other)won++;else if(own===other)drawn++;else lost++;
    }
    const recent=selected.slice(-5).reverse().map(({fixture,home})=>({
      result:result(home?fixture.homeGoals:fixture.awayGoals,
        home?fixture.awayGoals:fixture.homeGoals),
      round:fixture.round,homeId:fixture.homeId,awayId:fixture.awayId
    }));
    resultRows.push({...row,played:selected.length,won,drawn,lost,gf,ga,
      gd:gf-ga,pts:3*won+drawn,recent,position:null,_standingsKey:id});
  }
  resultRows.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||b.won-a.won||
    cmp(a._standingsKey,b._standingsKey));
  return resultRows.map(({_standingsKey,...row},index)=>({...row,position:index+1}));
}
