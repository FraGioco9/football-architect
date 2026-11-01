// Local DEV server only. This file is never listed in the publication allowlist.
const KEY='football-architect:local-debug-visible';
const local=location.hostname==='app.localhost'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
if(local){
 const enabled=()=>{try{return sessionStorage.getItem(KEY)==='1'}catch{return false}};
 const set=on=>{try{if(on)sessionStorage.setItem(KEY,'1');else sessionStorage.removeItem(KEY)}catch{};document.documentElement.dataset.faDebugEnabled=on?'true':'false'};
 set(enabled());
 document.addEventListener('DOMContentLoaded',()=>{
  if(location.pathname!=='/settings'&&location.pathname!=='/settings/')return;
  const grid=document.querySelector('.app-settings-grid');
  if(!grid)return;
  const translations={
   en:['Debug Settings','Enable developer controls for this browser session. Local only.','Enable Debug Settings'],
   de:['Debug-Einstellungen','Entwicklerfunktionen für diese Browsersitzung aktivieren. Nur lokal.','Debug-Einstellungen aktivieren'],
   es:['Ajustes de depuración','Activar herramientas de desarrollo durante esta sesión. Solo local.','Activar depuración'],
   fr:['Paramètres de débogage','Activer les outils de développement pour cette session. Local uniquement.','Activer le débogage'],
   it:['Impostazioni debug','Attiva i controlli di sviluppo per questa sessione. Solo in locale.','Attiva Debug Settings']
  };
  const lang=()=>document.documentElement.lang?.split('-')[0]||'en';
  const panel=document.createElement('section');
  panel.className='app-panel app-settings-panel';
  panel.innerHTML='<h2 data-local-debug-title></h2><div class="app-settings-panel-content"><p class="app-settings-hint" data-local-debug-help></p><label style="display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer"><span data-local-debug-label></span><input type="checkbox" data-local-debug-toggle style="width:22px;height:22px;accent-color:var(--focus)"></label></div>';
  const input=panel.querySelector('[data-local-debug-toggle]');
  input.checked=enabled();
  input.addEventListener('change',()=>set(input.checked));
  const render=()=>{const [title,help,label]=translations[lang()]||translations.en;panel.querySelector('[data-local-debug-title]').textContent=title;panel.querySelector('[data-local-debug-help]').textContent=help;panel.querySelector('[data-local-debug-label]').textContent=label};
  render();
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  grid.insertBefore(panel,grid.children[2]||null);
 });
}
