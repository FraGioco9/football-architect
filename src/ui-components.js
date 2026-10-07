/** Shared, dependency-free, string-template UI primitives.
 * Keep their output stable: existing views, translations, saves and test snapshots
 * rely on these HTML contracts. Game-specific components stay in ui.js.
 */

export const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const statusTag=(s,variant='muted')=>`<span class="tag status-chip tag-${variant}">${s}</span>`;

export const sectionHead=(eyebrow,title,_subtitle='',actions='')=>`<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>${actions?`<div class="head-actions">${actions}</div>`:''}</div>`;

export const panel=(title,subtitle,contents,extra='',classes='')=>`<section class="panel card-shell ${classes}"><header class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${extra}</header>${contents}</section>`;

export const actionButton=(label,action,klass='btn btn-quiet',other='')=>`<button type="button" class="${klass}" data-action="${action}" ${other}>${label}</button>`;

export const tableColumns=(columns)=>`<thead><tr>${columns.map(c=>{
  const column=typeof c==='string'?{label:c}:c;
  return `<th scope="col"${column.numeric?' class="cell-numeric"':''}${column.sort?` aria-sort="${column.sort}"`:''}${column.label?` aria-label="${esc(column.label)}"`:''}>${esc(column.text??column.label??'')}${column.sort?`<span class="table-sort-mark" aria-hidden="true">${column.sort==='ascending'?'↑':column.sort==='descending'?'↓':'•'}</span>`:''}</th>`;
}).join('')}</tr></thead>`;
export const numberCell=(content,extraClass='')=>`<td class="cell-numeric${extraClass?' '+esc(extraClass):''}">${content}</td>`;
export const emptyTableRow=(message,columns)=>`<tr class="table-empty-row"><td colspan="${columns}"><div class="empty-state" role="status">${esc(message)}</div></td></tr>`;

// UX2-00 — Shared presentation contract. Existing gameplay data-action and view
// contracts are unchanged; rich values below are trusted, pre-rendered UI HTML.
const BUTTON_VARIANTS=Object.freeze({primary:'btn-primary',secondary:'btn-quiet',outline:'btn-outline',danger:'btn-danger'});
export function uiButton({label,action,variant='secondary',size='normal',attributes='',disabled=false}={}){
  if(!Object.hasOwn(BUTTON_VARIANTS,variant))throw new TypeError('Invalid button variant');
  if(!['normal','compact'].includes(size))throw new TypeError('Invalid button size');
  if(!action)throw new TypeError('Button action required');
  return `<button type="button" class="btn ${BUTTON_VARIANTS[variant]}${size==='compact'?' btn-mini':''}" data-action="${esc(action)}"${disabled?' disabled':''}${attributes?' '+attributes:''}>${esc(label??'')}</button>`;
}
export function metricCard({label,value,detail='',icon='',valueClass='',ariaLabel=''}={}){
  return `<div class="kpi metric-card" data-design-system="metric" role="group" aria-label="${esc(label??'')}"><div class="kpi-name">${esc(label??'')}${icon?` ${icon}`:''}</div><div class="kpi-main${valueClass?' '+esc(valueClass):''}"${ariaLabel?` aria-label="${esc(ariaLabel)}"`:''}>${value}</div>${detail?`<div class="kpi-bottom">${detail}</div>`:''}</div>`;
}
export function emptyState(message,{description='',icon='',action=''}={}){
  return `<div class="empty-state ds-empty" role="status">${icon?`<span class="ds-empty-icon" aria-hidden="true">${icon}</span>`:''}<span class="ds-empty-title">${esc(message)}</span>${description?`<span class="ds-empty-description">${esc(description)}</span>`:''}${action?`<span class="ds-empty-action">${action}</span>`:''}</div>`;
}
export function inlineNotice(message,{tone='info',label=''}={}){
  if(!['info','success','warning','error'].includes(tone))throw new TypeError('Invalid notice tone');
  return `<div class="ds-notice ds-notice-${tone}" role="${tone==='error'?'alert':'status'}"${label?` aria-label="${esc(label)}"`:''}>${esc(message)}</div>`;
}
export function dialogFrame({type,title,body,wide=false,lang='it',closeIcon='×'}={}){
  const content=`<header class="modal-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" type="button" data-action="close-modal" aria-label="${lang==='en'?'Close':'Chiudi'}">${closeIcon}</button></header><div class="modal-body">${body}</div>`;
  const framed=type==='match'?`<div class="match-dialog-scroll">${content}</div>`:content;
  return `<div class="modal-layer" role="presentation" data-action="dismiss-modal"><section class="modal ds-dialog ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1" data-dialog-kind="${esc(type)}" data-stop-close>${framed}</section></div>`;
}
