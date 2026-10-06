/** WRD05 official career history: render real, saved archives only. */
import {hasCareerWorld} from '../domain/career-world.js';
import {officialArchive,officialHistorySeasons,officialHonours,officialClubHistory,officialPlayerHistory,officialRecords,officialRivalries,officialClubIdentity,officialClubNarrative} from '../domain/career-history.js';
import {esc} from '../ui-components.js';
const val=v=>v===null||v===undefined?'—':String(v);
const th=(name)=>`<th scope="col">${esc(name)}</th>`;
const td=(v)=>`<td>${esc(val(v))}</td>`;

export function careerHistoryPanel(w,ui,country){
 if(!hasCareerWorld(w))return '';
 const en=ui.language==='en',seasonList=officialHistorySeasons(w),latest=seasonList.at(-1)??null;
 const season=seasonList.includes(ui.worldHistorySeason)?ui.worldHistorySeason:latest;
 const history=season===null?null:officialArchive(w,country,season),details=history?.details??null;
 const translations=en?{
  title:'History, records & rivalries',intro:'Only completed seasons and documented results are recorded. No invented past trophies or matches.',season:'Season',noArchive:'Complete a season to open the historical archive.',compact:'This season was recorded using the previous archive format; detailed records are unavailable.',
  ranking:'Final league table',club:'Club',pts:'Points',played:'Played',win:'Wins',draw:'Draws',lost:'Losses',scorers:'Top scorers',goals:'Goals',awards:'Roll of honour',records:'All-time records',rivalries:'Recorded rivalries',city:'City derby',sporting:'Sporting rivalry',meetings:'Meetings',identity:'Fictional club identity',foundation:'Fictional founding year',reputation:'Reputation',titles:'Recorded titles',clubHistory:'Club seasons',timeline:'Season-by-season champions',players:'Player history',seasonAward:'League champion',missing:'Not recorded',noRivalries:'No head-to-head evidence yet',disclaimer:'No cups, promotion or personal awards are invented before the corresponding gameplay is integrated.'
 }:{
  title:'Storia, record e rivalità',intro:'Sono registrate solo stagioni concluse e risultati realmente simulati. Nessun trofeo o incontro passato inventato.',season:'Stagione',noArchive:'Completa una stagione per consultare l’archivio.',compact:'Stagione archiviata nel formato precedente: i dettagli storici non sono disponibili.',
  ranking:'Classifica finale',club:'Squadra',pts:'Punti',played:'PG',win:'V',draw:'N',lost:'P',scorers:'Capocannonieri',goals:'Gol',awards:'Albo d’oro',records:'Record storici',rivalries:'Rivalità documentate',city:'Derby cittadino',sporting:'Rivalità sportiva',meetings:'Incontri',identity:'Identità del club immaginario',foundation:'Fondazione immaginaria',reputation:'Reputazione',titles:'Titoli registrati',clubHistory:'Stagioni del club',timeline:'Campioni per stagione',players:'Storico del calciatore',seasonAward:'Campione del campionato',missing:'Non registrato',noRivalries:'Nessun confronto diretto documentato',disclaimer:'Non vengono attribuite coppe, promozioni o premi individuali finché non esistono le rispettive competizioni.'
 };
 const t=translations;
 const clubs=country===w.countryId?w.teams:w.advancedV1.worldV1.leagues.find(l=>l.countryId===country)?.clubs??[];
 const selectedId=clubs.some(c=>String(c.id)===String(ui.worldClub))?Number(ui.worldClub):null;
 const identity=selectedId===null?null:officialClubIdentity(w,country,selectedId);
 const historicalNames=new Map(clubs.map(c=>[c.id,c.name]));
 if(history)for(const row of history.table??[])historicalNames.set(row.id,row.name);
 const name=id=>historicalNames.get(id)??String(id);
 const honours=officialHonours(w,country),records=officialRecords(w,country,{throughSeason:season}),rivalries=officialRivalries(w,country,{throughSeason:season,limit:10});
 const seasonRows=details?.rows??history?.table??[];
 const scorerRows=details?.leaders??history?.topScorers??[];
 const selectedClubHistory=selectedId===null?[]:officialClubHistory(w,country,selectedId).filter(h=>season===null||h.season<=season);
 const selectedPlayer=ui.worldPlayer?officialPlayerHistory(w,country,ui.worldPlayer).filter(h=>season===null||h.season<=season):[];
 return `<section class="official-history panel" aria-label="${esc(t.title)}"><div class="section-head"><div><span class="overline">WRD05 · ${en?'OFFICIAL ARCHIVE':'ARCHIVIO UFFICIALE'}</span><h2>${esc(t.title)}</h2><p>${esc(t.intro)}</p></div></div>
 ${seasonList.length?`<label class="official-history-filter">${esc(t.season)} <select data-world-history-season aria-label="${esc(t.season)}">${seasonList.map(s=>`<option value="${s}"${s===season?' selected':''}>${s}</option>`).join('')}</select></label>`:`<p class="muted">${esc(t.noArchive)}</p>`}
 ${history&&!details?`<p class="official-history-note">${esc(t.compact)}</p>`:''}
 ${history?`<div class="official-history-grid"><div><h3>${esc(t.ranking)}</h3><div class="table-scroll" role="region" tabindex="0" aria-label="${esc(t.ranking)}"><table class="data-table"><thead><tr>${['#',t.club,t.played,t.win,t.draw,t.lost,t.pts].map(th).join('')}</tr></thead><tbody>${seasonRows.map((r,i)=>`<tr>${td(i+1)}<td><button type="button" class="world-club-link" data-action="world-club" data-club="${esc(r.clubId??r.id)}">${esc(r.name)}</button></td>${td(r.p)}${td(r.w??'—')}${td(r.d??'—')}${td(r.l??'—')}${td(r.pts)}</tr>`).join('')}</tbody></table></div></div>
 <div><h3>${esc(t.scorers)}</h3><div class="table-scroll" role="region" tabindex="0"><table class="data-table"><thead><tr>${[en?'Player':'Calciatore',t.goals].map(th).join('')}</tr></thead><tbody>${scorerRows.slice(0,12).map(p=>`<tr>${td(p.name)}${td(p.goals)}</tr>`).join('')||`<tr><td colspan="2">${esc(t.missing)}</td></tr>`}</tbody></table></div><p>${esc(t.seasonAward)}: <strong>${esc(name(history.championId))}</strong></p></div></div>`:''}
 <div class="official-history-grid"><div><h3>${esc(t.awards)}</h3><div class="table-scroll" role="region" tabindex="0"><table class="data-table"><thead><tr>${[t.season,t.club].map(th).join('')}</tr></thead><tbody>${honours.filter(h=>season===null||h.season<=season).slice().reverse().map(h=>`<tr>${td(h.season)}${td(h.clubName)}</tr>`).join('')||`<tr><td colspan="2">${esc(t.missing)}</td></tr>`}</tbody></table></div></div>
 <div><h3>${esc(t.records)}</h3><div class="table-scroll" role="region" tabindex="0"><table class="data-table"><thead><tr>${[en?'Record':'Record',en?'Holder':'Detentore',t.season,en?'Value':'Valore'].map(th).join('')}</tr></thead><tbody>${records.map(r=>`<tr>${td(({points:en?'Points':'Punti',goals:en?'Team goals':'Gol squadra',wins:en?'Wins':'Vittorie',scorer:en?'Scorer goals':'Gol marcatore'})[r.type])}${td(r.name)}${td(r.season)}${td(r.value)}</tr>`).join('')||`<tr><td colspan="4">${esc(t.missing)}</td></tr>`}</tbody></table></div></div></div>
 <h3>${esc(t.rivalries)}</h3><div class="table-scroll" role="region" tabindex="0"><table class="data-table"><thead><tr>${[t.club,t.club,en?'Type':'Tipo',t.meetings,'V-N-P'].map(th).join('')}</tr></thead><tbody>${rivalries.map(r=>`<tr>${td(name(r.a))}${td(name(r.b))}${td(r.kind==='city'?t.city:t.sporting)}${td(r.meetings)}${td(`${r.winsA}–${r.draws}–${r.winsB}`)}</tr>`).join('')||`<tr><td colspan="5">${esc(t.noRivalries)}</td></tr>`}</tbody></table></div>
 ${identity?`<div class="official-history-grid"><div><h3>${esc(t.identity)}</h3><div class="official-history-club"><span class="official-history-colors" aria-hidden="true"><i style="background:${esc(identity.colors[0])}"></i><i style="background:${esc(identity.colors[1])}"></i></span><strong>${esc(identity.name)}</strong></div><p>${esc(identity.city)} · ${t.foundation}: ${esc(val(identity.founded))} · ${t.reputation}: ${esc(val(identity.reputation))} · ${t.titles}: ${identity.titles}</p><p>${esc(officialClubNarrative(w,country,selectedId,ui.language,season))}</p></div><div><h3>${esc(t.clubHistory)}</h3><div class="table-scroll" role="region" tabindex="0"><table class="data-table"><thead><tr>${[t.season,'#',t.pts,t.win,t.goals].map(th).join('')}</tr></thead><tbody>${selectedClubHistory.map(c=>`<tr>${td(c.season)}${td(c.rank)}${td(c.points)}${td(c.wins)}${td(c.goalsFor)}</tr>`).join('')||`<tr><td colspan="5">${esc(t.missing)}</td></tr>`}</tbody></table></div></div></div>`:''}
 ${selectedPlayer.length?`<h3>${esc(t.players)}</h3><div class="table-scroll" role="region" tabindex="0"><table class="data-table"><thead><tr>${[t.season,en?'Player':'Calciatore',t.goals,t.played].map(th).join('')}</tr></thead><tbody>${selectedPlayer.map(p=>`<tr>${td(p.season)}${td(p.name)}${td(p.goals)}${td(p.apps??'—')}</tr>`).join('')}</tbody></table></div>`:''}
 <p class="official-history-note">${esc(t.disclaimer)}</p></section>`;
}
