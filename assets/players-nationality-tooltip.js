/* Shared nationality names and accessible tooltip across public and Admin Players tables. */
(()=>{'use strict';
 const flags=Object.freeze({
  ESP:'es',ARG:'ar',FRA:'fr',ENG:'gb-eng',POR:'pt',BRA:'br',MAR:'ma',BEL:'be',NED:'nl',MEX:'mx',
  COL:'co',SUI:'ch',GER:'de',CRO:'hr',ITA:'it',USA:'us',JPN:'jp',SEN:'sn',NOR:'no',URU:'uy',
  DEN:'dk',AUT:'at',IRN:'ir',ECU:'ec',EGY:'eg',AUS:'au',CAN:'ca',ALG:'dz',CIV:'ci',NGA:'ng',
  TUR:'tr',KOR:'kr',PAR:'py',SWE:'se',RUS:'ru',UKR:'ua',POL:'pl',HUN:'hu',WAL:'gb-wls',COD:'cd',
  GRE:'gr',CMR:'cm',SCO:'gb-sct',SRB:'rs',SVK:'sk',PAN:'pa',MLI:'ml',RSA:'za',VEN:'ve',CHI:'cl'
 });
 const homeNames={en:['England','Scotland','Wales'],it:['Inghilterra','Scozia','Galles'],de:['England','Schottland','Wales'],es:['Inglaterra','Escocia','Gales'],fr:['Angleterre','Écosse','Pays de Galles']};
 function name(code){
  if(!Object.hasOwn(flags,code))return code||'';
  const lang=(document.documentElement.lang||'en').toLowerCase().slice(0,2);
  const home=homeNames[lang]||homeNames.en;
  if(code==='ENG')return home[0];if(code==='SCO')return home[1];if(code==='WAL')return home[2];
  try{return new Intl.DisplayNames([lang],{type:'region'}).of(flags[code].slice(0,2).toUpperCase())||code;}catch{return code;}
 }
 const selector='.app-players-nationality-flag[data-player-country]';
 let active=null,tip=null;
 function tooltip(){
  if(tip)return tip;
  tip=document.createElement('div');tip.id='app-players-nationality-tooltip';tip.className='app-players-nationality-tooltip';
  tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);return tip;
 }
 function hide(){if(active)active.removeAttribute('aria-describedby');active=null;if(tip)tip.hidden=true;}
 function position(){
  if(!active||!tip||tip.hidden)return;
  const rect=active.getBoundingClientRect(),w=tip.offsetWidth||110,h=tip.offsetHeight||38;
  tip.style.left=Math.round(Math.min(window.innerWidth-w-8,Math.max(8,rect.left+rect.width/2-w/2)))+'px';
  const below=rect.bottom+8,above=rect.top-h-8;
  tip.style.top=Math.round(Math.max(8,below+h>window.innerHeight&&above>=8?above:Math.min(below,window.innerHeight-h-8)))+'px';
 }
 function show(node){
  if(!node||!node.matches(selector))return;
  if(active&&active!==node)active.removeAttribute('aria-describedby');
  active=node;const tipNode=tooltip();node.alt=name(node.dataset.playerCountry);
  tipNode.textContent=node.alt;tipNode.hidden=false;node.setAttribute('aria-describedby',tipNode.id);position();
 }
 document.addEventListener('pointerover',e=>{const node=e.target.closest?.(selector);if(node&&e.pointerType!=='touch')show(node);});
 document.addEventListener('pointerout',e=>{if(active&&(e.target===active||active.contains(e.target))&&!active.contains(e.relatedTarget))hide();});
 document.addEventListener('focusin',e=>{const node=e.target.closest?.(selector);if(node)show(node);});
 document.addEventListener('focusout',e=>{if(e.target===active)hide();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
 new MutationObserver(()=>{if(active){active.alt=name(active.dataset.playerCountry);if(tip)tip.textContent=active.alt;position();}})
  .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 window.faPlayersNationality=Object.freeze({flags,name});
})();
