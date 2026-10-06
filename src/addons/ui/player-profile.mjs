/** PLY01.04 — UI-independent markup for the game page, IT/EN.
 * Read-only: filters/profiles do not write player objects or game state.
 */
import {ATTRIBUTE_DEFINITIONS,ATTRIBUTE_BY_KEY,validateAttributes} from '../domain/player-attributes.mjs';
import {canonicalPosition,ratePlayer,POSITION_WEIGHTS} from '../domain/player-ratings.mjs';
import {readPlayerAttributes} from '../domain/player-generator.mjs';
const txt={
 it:{title:'Attributi',derived:'Valutazione derivata',legacy:'OVR esistente',positive:'Punti di forza',negative:'Da migliorare',compare:'Confronto calciatori',person:'Calciatore',attribute:'Attributo',minimum:'Minimo',role:'Ruolo naturale',foot:'Piede',reputation:'Reputazione',nationality:'Nazionalità',archetype:'Archetipo',technical:'Tecnici',mental:'Mentali',physical:'Fisici',goalkeeper:'Portiere',right:'Destro',left:'Sinistro',both:'Entrambi',none:'Nessun risultato',quality:'Idoneità per ruolo',filter:'Filtra attributi'},
 en:{title:'Attributes',derived:'Derived rating',legacy:'Existing OVR',positive:'Strengths',negative:'Areas to improve',compare:'Player comparison',person:'Player',attribute:'Attribute',minimum:'Minimum',role:'Natural position',foot:'Foot',reputation:'Reputation',nationality:'Nationality',archetype:'Archetype',technical:'Technical',mental:'Mental',physical:'Physical',goalkeeper:'Goalkeeper',right:'Right',left:'Left',both:'Both',none:'No results',quality:'Positional suitability',filter:'Filter attributes'},
};
export const PROFILE_TEXT=Object.freeze(txt);
const langKey=l=>String(l).toLowerCase().startsWith('en')?'en':'it';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dispName=p=>p.name??[p.firstName,p.lastName].filter(Boolean).join(' ')??String(p.id);
function details(player,options={}){
 const profile=readPlayerAttributes(player,options), pos=canonicalPosition(player.position??player.pos??player.role);
 const rating=ratePlayer({...player,position:pos},profile);
 const strong=Object.entries(POSITION_WEIGHTS[pos]).map(([key,weight])=>({key,weight,value:profile.values[key]})).sort((a,b)=>(b.value*0.8+b.weight*0.2)-(a.value*0.8+a.weight*0.2));
 return {profile,pos,rating,strong:strong.slice(0,3),weak:[...strong].sort((a,b)=>a.value-b.value).slice(0,3)};
}
/** Filter by attribute without changing the squad or its original order on disk. */
export function filterSquadByAttribute(players,{attribute='finishing',minimum=1,descending=true,seed=0,countryId=''}={}){
 if(!Array.isArray(players)||!ATTRIBUTE_BY_KEY[attribute])throw new Error('PLY01_INVALID_FILTER');
 if(!Number.isInteger(minimum)||minimum<1||minimum>100)throw new Error('PLY01_FILTER_MINIMUM');
 return players.map((player,index)=>({player,index,score:readPlayerAttributes(player,{seed,countryId}).values[attribute]}))
  .filter(item=>item.score>=minimum)
  .sort((a,b)=> (descending?b.score-a.score:a.score-b.score)||a.index-b.index)
  .map(({player,score})=>({player,score}));
}
const bar=(label,val)=>`<div class="fa-attr-row"><span class="fa-attr-label">${esc(label)}</span><div class="fa-attr-track" role="meter" aria-valuemin="1" aria-valuemax="100" aria-valuenow="${val}" aria-label="${esc(label)}"><span class="fa-attr-fill" style="width:${val}%"></span></div><strong class="fa-attr-value">${val}</strong></div>`;
function groupHTML(profile,group,l){
 const items=ATTRIBUTE_DEFINITIONS.filter(a=>a.group===group);
 return `<section class="fa-profile-group"><h3>${esc(txt[l][group])}</h3>${items.map(a=>bar(a.label[l],profile.values[a.key])).join('')}</section>`;
}
/** Embeddable HTML: only read-only UI, doesn't alter the official team screen. */
export function renderPlayerProfile(player,{lang='it',seed=0,countryId='',includeKeeperForOutfield=false}={}){
 const l=langKey(lang),t=txt[l],{profile,pos,rating,strong,weak}=details(player,{seed,countryId});
 const groups=['technical','mental','physical',...(pos==='GK'||includeKeeperForOutfield?['goalkeeper']:[])];
 const meta=profile.metadata?.profile??{};
 const li=items=>items.map(a=>`<li><span>${esc(ATTRIBUTE_BY_KEY[a.key].label[l])}</span><strong>${a.value}</strong></li>`).join('');
 return `<article class="fa-profile" aria-label="${esc(t.title)} — ${esc(dispName(player))}">
 <header class="fa-profile-head"><div><p class="fa-profile-eyebrow">${esc(t.title)}</p><h2>${esc(dispName(player))}</h2><span class="fa-profile-position">${esc(pos)}</span></div><div class="fa-profile-ratings"><div><small>${esc(t.legacy)}</small><strong>${esc(rating.legacyOvr??'—')}</strong></div><div><small>${esc(t.derived)}</small><strong>${rating.derivedOvr}</strong></div></div></header>
 <dl class="fa-profile-meta"><div><dt>${esc(t.archetype)}</dt><dd>${esc(meta.archetypeName?.[l]??'—')}</dd></div><div><dt>${esc(t.foot)}</dt><dd>${esc(t[meta.preferredFoot]??'—')}</dd></div><div><dt>${esc(t.nationality)}</dt><dd>${esc(meta.nationality||'—')}</dd></div><div><dt>${esc(t.role)}</dt><dd>${esc(pos)}</dd></div></dl>
 <div class="fa-profile-insights"><section><h3>${esc(t.positive)}</h3><ol>${li(strong)}</ol></section><section><h3>${esc(t.negative)}</h3><ol>${li(weak)}</ol></section></div>
 <div class="fa-profile-groups">${groups.map(g=>groupHTML(profile,g,l)).join('')}</div>
 <section class="fa-profile-suitability"><h3>${esc(t.quality)}</h3>${Object.entries(rating.allPositions).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([p,n])=>bar(p,n)).join('')}</section>
 </article>`;
}
export function renderPlayerComparison(playerA,playerB,{lang='it',seed=0,countryId='',attributes=null}={}){
 const l=langKey(lang),t=txt[l];
 const a=details(playerA,{seed,countryId}),b=details(playerB,{seed,countryId});
 const keys=attributes??ATTRIBUTE_DEFINITIONS.filter(d=>a.pos==='GK'||b.pos==='GK'||d.group!=='goalkeeper').map(d=>d.key);
 if(!Array.isArray(keys)||keys.some(key=>!ATTRIBUTE_BY_KEY[key]))throw new Error('PLY01_COMPARE_ATTRIBUTES');
 return `<section class="fa-profile fa-profile-compare" aria-label="${esc(t.compare)}"><h2>${esc(t.compare)}</h2><div class="fa-compare-head"><strong>${esc(dispName(playerA))}</strong><strong>${esc(dispName(playerB))}</strong></div>
 ${keys.map(key=>{
  const av=a.profile.values[key],bv=b.profile.values[key];return `<div class="fa-compare-row"><div class="fa-compare-left"><span>${av}</span><div class="fa-attr-track"><span class="fa-attr-fill" style="width:${av}%"></span></div></div><span class="fa-compare-name">${esc(ATTRIBUTE_BY_KEY[key].label[l])}</span><div class="fa-compare-right"><div class="fa-attr-track"><span class="fa-attr-fill" style="width:${bv}%"></span></div><span>${bv}</span></div></div>`;
 }).join('')}</section>`;
}
