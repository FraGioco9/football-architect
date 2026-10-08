import {icon} from './icons.js';
// The language combobox and menu follow Football Architect's pre-reset interface.
export function languagePicker(lang,open=false){
 const en=lang==='en',label=en?'Language':'Lingua';
 const selected=en?{code:'EN',name:'English'}:{code:'IT',name:'Italiano'};
 const options=[{value:'it',code:'IT',label:'Italiano'},{value:'en',code:'EN',label:'English'}];
 return `<div class="language-picker language-picker-home" data-language-picker="home">
  <button type="button" class="language-combobox" id="language-combobox-home" role="combobox" aria-label="${label}: ${selected.name}" aria-haspopup="listbox" aria-expanded="${open}" aria-controls="language-list-home" data-action="language-toggle">
   <span class="language-icon" aria-hidden="true">${icon('flag',15)}</span>
   <span class="language-current"><b>${selected.code}</b><span>${selected.name}</span></span>
   <span class="language-chevron" aria-hidden="true">${icon('chevron-down',14)}</span>
  </button>
  ${open?`<div class="language-listbox" id="language-list-home" role="listbox" aria-label="${label}">
   ${options.map(item=>`<button type="button" class="language-option${item.value===lang?' is-selected':''}" role="option" aria-selected="${item.value===lang}" data-action="language-option" data-value="${item.value}" tabindex="-1"><span class="language-option-code">${item.code}</span><span>${item.label}</span>${item.value===lang?icon('check',14):''}</button>`).join('')}
  </div>`:''}
 </div>`;
}
