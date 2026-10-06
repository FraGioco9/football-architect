/** SIM03.04 — keyboard-friendly pitch editor for official career slot duties. */
import {FORMATIONS} from '../../domain/rules.js';
import {toAddonPosition} from '../career-bridge.mjs';
import {careerRolesEnabled,careerSlotRole,assessCareerSlotRole} from '../../domain/career-roles.js';
import {availableRoles,ROLE_BY_ID} from '../domain/player-roles.mjs';
import {ATTRIBUTE_BY_KEY} from '../domain/player-attributes.mjs';
import {esc} from '../../ui-components.js';
const tr=(language,it,en)=>language==='en'?en:it;
export function renderCareerRolesPitch(world,language='it',{slot=0}={}){
 if(!world.advancedV1?.enabled)return '';
 if(!careerRolesEnabled(world))return `<section class="panel sim03-panel" aria-label="SIM03"><h3>${tr(language,'Ruoli individuali SIM03','SIM03 individual roles')}</h3><p>${tr(language,'Personalizza ruolo e compito per posizione, utilizzando familiarità e attributi verificati. Le carriere precedenti restano inalterate fino all’attivazione.','Set role and duty by position, using verified attributes and positional familiarity. Previous careers remain unchanged until activation.')}</p><button type="button" class="btn btn-primary" data-action="sim03-enable">${tr(language,'Attiva SIM03','Enable SIM03')}</button></section>`;
 const index=Number.isSafeInteger(slot)&&slot>=0&&slot<11?slot:0;
 const slots=FORMATIONS[world.formation];
 const player=world.players.find(p=>p.id===world.lineup[index]);
 const position=toAddonPosition(slots[index].p),choice=careerSlotRole(world,index),fit=assessCareerSlotRole(world,index);
 const roleOptions=availableRoles(position);
 const notes=key=>ATTRIBUTE_BY_KEY[key]?.label[language==='en'?'en':'it']??key;
 const dutyLabels={defend:tr(language,'Difesa','Defend'),support:tr(language,'Supporto','Support'),attack:tr(language,'Attacco','Attack')};
 const field=slots.map((s,i)=>{
   const p=world.players.find(x=>x.id===world.lineup[i]),r=careerSlotRole(world,i),pos=toAddonPosition(s.p);
   const role=ROLE_BY_ID[r.role];
   return `<button type="button" class="sim03-position${i===index?' is-selected':''}" data-action="sim03-slot" data-index="${i}" aria-pressed="${i===index}" aria-label="${tr(language,'Seleziona slot','Select slot')} ${i+1}: ${esc(p?.name??pos)} — ${esc(role?.label?.[language==='en'?'en':'it']??r.role)}" style="left:${s.x}%;top:${s.y}%"><strong>${esc(p?.name?.split(' ').at(-1)??pos)}</strong><small>${esc(role?.label?.[language==='en'?'en':'it']??r.role)}</small></button>`;
 }).join('');
 return `<section class="panel sim03-panel" aria-label="SIM03"><h3>${tr(language,'Editor ruoli e compiti — campo','Pitch role and duty editor')}</h3><p class="note">${tr(language,'Modulo','Formation')} ${esc(world.formation)} · ${tr(language,'Seleziona una posizione sul campo (anche con Tab) per personalizzarla.','Choose a position on the pitch (including with Tab) to customize it.')}</p>
 <div class="sim03-layout"><div class="sim03-pitch" role="group" aria-label="${tr(language,'Posizioni sul campo','Pitch positions')}"><div class="sim03-pitch-line"></div><div class="sim03-center-circle"></div>${field}</div>
 <div class="sim03-detail"><h4>${esc(player?.name??position)} · ${esc(position)}</h4><p>${tr(language,'Slot','Slot')} ${index+1}/11 · ${tr(language,'Modulo','Formation')} ${esc(world.formation)}</p>
 <label for="sim03-role-select">${tr(language,'Ruolo','Role')}<select id="sim03-role-select" data-sim03-role data-index="${index}" aria-label="${tr(language,'Ruolo del giocatore','Player role')}">${roleOptions.map(r=>`<option value="${esc(r.id)}"${r.id===choice.role?' selected':''}>${esc(r.label[language==='en'?'en':'it'])}</option>`).join('')}</select></label>
 <label for="sim03-duty-select">${tr(language,'Compito','Duty')}<select id="sim03-duty-select" data-sim03-duty data-index="${index}" aria-label="${tr(language,'Compito del giocatore','Player duty')}">${Object.entries(dutyLabels).map(([id,label])=>`<option value="${id}"${id===choice.duty?' selected':''}>${label}</option>`).join('')}</select></label>
 ${fit?`<div class="sim03-fit" role="status"><strong>${tr(language,'Idoneità nel ruolo','Role suitability')}: ${fit.overall}/100</strong><small>${tr(language,'OVR originale invariato','Original OVR unchanged')}: ${Math.round(fit.baseOvr)} · ${tr(language,'Penalità posizione','Position penalty')}: −${fit.positionLoss} · ${tr(language,'Effetto ruolo','Role adjustment')}: ${fit.roleAdjustment>0?'+':''}${fit.roleAdjustment}</small><small>${tr(language,'Punti forti','Strengths')}: ${fit.strengths.map(notes).map(esc).join(', ')}</small><small>${tr(language,'Da migliorare','Needs work')}: ${fit.weaknesses.map(notes).map(esc).join(', ')}</small></div>`:`<p>${tr(language,'Seleziona un titolare per visualizzare l’idoneità.','Select a starter to see suitability.')}</p>`}
 <button type="button" class="btn btn-outline" data-action="sim03-reset">${tr(language,'Ripristina ruoli di questo modulo','Reset roles for this formation')}</button><p class="note">${tr(language,'Gli altri moduli e i risultati già giocati non cambiano. I nuovi ruoli influenzano soltanto gli eventi delle partite future.','Other formations and past results remain unchanged. New duties affect future match events only.')}</p></div></div></section>`;
}
