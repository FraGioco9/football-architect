/** PLYR-05 REC-02: read-only attribute page, recovered from UX #20 PR #37.
 * Never use exact values, comparisons or hidden-score rankings for external players.
 */
import {ATTRIBUTE_DEFINITIONS, ATTRIBUTE_GROUPS} from './addons/domain/player-attributes.mjs';
import {readPlayerAttributes} from './addons/domain/player-generator.mjs';
import {renderPlayerComparison} from './addons/ui/player-profile.mjs';
import {esc} from './ui-components.js';

export const PROFILE_ATTRIBUTE_GROUPS=Object.freeze(Object.keys(ATTRIBUTE_GROUPS));
const labels={
 technical:{it:'Tecnici',en:'Technical'},
 mental:{it:'Mentali',en:'Mental'},
 physical:{it:'Fisici',en:'Physical'},
 goalkeeper:{it:'Portiere',en:'Goalkeeper'}
};
const tr=(lang,it,en)=>lang==='en'?en:it;
const score=value=>Number.isInteger(value)&&value>=1&&value<=100?value:null;
const estimate=value=>value&&score(value.min)!==null&&score(value.max)!==null&&value.min<=value.max?`${value.min}–${value.max}`:null;
const label=(definition,lang)=>esc(definition.label[lang==='en'?'en':'it']);

export function renderPlayerAttributesPanel(w,player,ui,{report=null}={}){
 const lang=ui.language==='en'?'en':'it',owned=player.clubId===w.clubId;
 const group=PROFILE_ATTRIBUTE_GROUPS.includes(ui.playerAttributeGroup)?ui.playerAttributeGroup:'technical';
 const definitions=ATTRIBUTE_DEFINITIONS.filter(d=>d.group===group);
 // Read authoritative skills ONLY for managed players.
 const exact=owned?readPlayerAttributes(player,{seed:w.seed,countryId:w.countryId}).values:null;
 const read=definition=>owned?score(exact?.[definition.key]):null;
 const reportValue=definition=>!owned?estimate(report?.attributes?.[definition.key]):null;
 const numeric=definition=>owned?read(definition):null;
 const rows=definitions.map(d=>({definition:d,value:numeric(d),range:reportValue(d)}));
 const insights=owned?rows.filter(row=>row.value!==null):[];
 const strengths=[...insights].sort((a,b)=>b.value-a.value||a.definition.key.localeCompare(b.definition.key)).slice(0,3);
 const weaknesses=[...insights].sort((a,b)=>a.value-b.value||a.definition.key.localeCompare(b.definition.key)).slice(0,3);
 const ranking=(title,entries)=>`<section class="plyr052-insight"><h3>${esc(title)}</h3>${entries.length?`<ol>${entries.map(row=>`<li><span>${label(row.definition,lang)}</span><strong>${row.value}</strong></li>`).join('')}</ol>`:'<p>—</p>'}</section>`;
 const teammates=owned?w.players.filter(p=>p.clubId===w.clubId&&p.id!==player.id)
    .slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),lang==='en'?'en':'it')||Number(a.id)-Number(b.id)):[];
 const compared=owned?teammates.find(p=>String(p.id)===String(ui.comparePlayerId))??null:null;
 const picker=owned?`<section class="plyr052-compare" aria-label="${tr(lang,'Confronto compagni','Teammate comparison')}">
   <label for="ply01-compare-player">${tr(lang,'Confronta con','Compare with')}</label>
   <select id="ply01-compare-player" class="plyr052-select">
     <option value="none">${tr(lang,'Seleziona un compagno','Select a teammate')}</option>
     ${teammates.map(p=>`<option value="${esc(p.id)}"${compared?.id===p.id?' selected':''}>${esc(p.name)} · ${esc(p.position)}</option>`).join('')}
   </select>
   ${compared?`<div class="plyr052-comparison">${renderPlayerComparison(player,compared,{lang,seed:w.seed,countryId:w.countryId,attributes:definitions.map(d=>d.key)})}</div>`:''}
 </section>`:'';
 const last=owned&&Array.isArray(player.developmentV1?.history)?player.developmentV1.history.at(-1):null;
 const changes=Array.isArray(last?.changes)?last.changes.filter(c=>definitions.some(d=>d.key===c.attribute)&&
    score(c.from)!==null&&score(c.to)!==null&&c.to!==c.from):[];
 const tracked=owned&&changes.length?`<section class="plyr052-changes">
   <h3>${tr(lang,'Variazioni già registrate','Recorded changes')}${Number.isSafeInteger(last.season)?` · ${last.season}`:''}</h3>
   <ul>${changes.map(c=>{
     const definition=definitions.find(d=>d.key===c.attribute);
     return `<li><span>${label(definition,lang)}</span><strong>${c.to>c.from?'+':''}${c.to-c.from}</strong><small>${c.from} → ${c.to}</small></li>`;
   }).join('')}</ul>
 </section>`:'';
 return `<div class="plyr052-attributes" data-attribute-group="${group}">
   <div class="plyr052-groups" role="group" aria-label="${tr(lang,'Categoria attributi','Attribute category')}">
     ${PROFILE_ATTRIBUTE_GROUPS.map(g=>`<button type="button" data-action="player-attribute-group" data-value="${g}" class="plyr052-group${g===group?' is-active':''}" aria-pressed="${g===group}">${esc(labels[g][lang])} <small>${ATTRIBUTE_DEFINITIONS.filter(d=>d.group===g).length}</small></button>`).join('')}
   </div>
   <div class="plyr052-layout">
     <section class="plyr052-list" aria-label="${esc(labels[group][lang])}">
       <h3>${esc(labels[group][lang])}</h3>
       ${!owned?`<p class="plyr052-note">${tr(lang,'Sono visibili solo le stime effettivamente disponibili nello scouting.','Only estimates available from scouting are shown.')}</p>`:''}
       <div class="plyr052-rows">
        ${rows.map(({definition:d,value,range})=>`<div class="plyr052-row">
          <span>${label(d,lang)}</span>
          ${value!==null?`<div class="plyr052-meter" role="meter" aria-label="${label(d,lang)}" aria-valuemin="1" aria-valuemax="100" aria-valuenow="${value}"><span style="width:${value}%"></span></div><strong>${value}</strong>`
           :`<strong class="plyr052-estimate">${range??'—'}</strong>`}
        </div>`).join('')}
       </div>
     </section>
     ${owned?`<aside class="plyr052-insights">
       ${ranking(tr(lang,'Punti di forza','Strengths'),strengths)}
       ${ranking(tr(lang,'Da migliorare','Areas to improve'),weaknesses)}
       </aside>`:''}
   </div>
   ${tracked}
   ${picker}
 </div>`;
}
