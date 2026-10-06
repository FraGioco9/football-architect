// Read-only league aggregates, without DOM or side effects.
export function table(w){
  const byId=new Map(w.teams.map(t=>[t.id,{id:t.id,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0,form:[]}]));
  for(const week of w.fixtures)for(const match of week.matches){
    if(!match.result)continue;
    const h=byId.get(match.home),a=byId.get(match.away),{homeGoals:gh,awayGoals:ga}=match.result;
    h.p++;a.p++;h.gf+=gh;h.ga+=ga;a.gf+=ga;a.ga+=gh;
    if(gh>ga){h.w++;a.l++;h.pts+=3;h.form.push('V');a.form.push('S');}
    else if(gh<ga){a.w++;h.l++;a.pts+=3;a.form.push('V');h.form.push('S');}
    else{h.d++;a.d++;h.pts++;a.pts++;h.form.push('P');a.form.push('P');}
  }
  return [...byId.values()].map(r=>({...r,gd:r.gf-r.ga,form:r.form.slice(-5)})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.id-b.id);
}

export function leagueScorers(w){return [...w.players].filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||b.assists-a.assists||a.apps-b.apps);}

export function standingsSummary(w){const rows=table(w);return {rows,position:rows.findIndex(r=>r.id===w.clubId)+1,points:rows.find(r=>r.id===w.clubId)?.pts||0};}
