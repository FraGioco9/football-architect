/* Shared account presentation and trusted host/language handoff; no credentials in storage. */
((root,factory)=>{
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.faAccountUI=api.mount(root);
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const languages=['en','de','es','fr','it'],key='football-architect:language';
 const supported=value=>languages.includes(value);
 const resolveLanguage=(explicit,saved)=>supported(explicit)?explicit:supported(saved)?saved:'en';
 function accountTarget(href,language){
  const url=new URL(href);
  if(!/^\/account(?:\/(?:login|register|recover|verify-email))?\/?(?:index\.html)?$/.test(url.pathname))throw Error('Invalid account route');
  const host=url.hostname.toLowerCase();
  if(host==='localhost')url.hostname='app.localhost';
  else if(!host.startsWith('app.')&&!/^(?:127\.0\.0\.1|\[::1\])$/.test(host)&&!host.endsWith('.vercel.app')&&!host.endsWith('.github.io'))url.hostname='app.'+host.replace(/^www\./,'');
  const token=url.searchParams.get('token');
  url.search='';url.hash='';url.username='';url.password='';
  if((url.pathname.includes('/recover')||url.pathname.includes('/verify-email'))&&/^[a-f0-9]{64}$/.test(token||''))url.searchParams.set('token',token);
  const locale=resolveLanguage(language,null);if(locale!=='en')url.searchParams.set('lang',locale);
  return url.href;
 }
 function mount(win){
  const doc=win.document,url=new URL(win.location.href);
  let saved;try{saved=win.localStorage.getItem(key)}catch{/* Storage is optional. */}
  let language=resolveLanguage(url.searchParams.get('lang'),saved),redirecting=false;
  const target=accountTarget(url.href,language);
  if(new URL(target).origin!==url.origin){
   redirecting=true;doc.documentElement.dataset.accountRedirecting='true';
   win.location.replace(target);
  }
  const callbacks=new Set();
  const selects=new Map();
  function refreshMenus(){
   for(const [select,view] of selects){
    const fingerprint=JSON.stringify([...select.options].map(option=>[option.value,option.textContent]));
    if(view.fingerprint!==fingerprint){
     const options=[...select.options].map((item,index)=>{
      const option=doc.createElement('div');option.className='language-option';option.setAttribute('role','option');
      option.id=view.menu.id+'-'+index;option.dataset.menuValue=item.value;option.textContent=item.textContent;return option;
     });
     view.menu.replaceChildren(...options);view.binding.update(options);view.fingerprint=fingerprint;
    }
    view.binding.sync(select.value);view.value.textContent=select.selectedOptions[0]?.textContent||'';view.trigger.disabled=select.disabled;
   }
  }
  function enhanceSelect(select){
   let control=select.closest('[data-account-select-control]'),trigger,value,menu;
   if(control){trigger=doc.getElementById(select.id+'-trigger');value=doc.getElementById(select.id+'-value');menu=doc.getElementById(select.id+'-menu');}
   else{
   control=doc.createElement('div');control.className='language-control';
   trigger=doc.createElement('button');trigger.type='button';trigger.className='language-trigger';trigger.id=select.id+'-trigger';
   trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',select.id+'-menu');
   const label=select.id==='account-language'?'account-language-label':'nationality-label';
   trigger.setAttribute('aria-labelledby',label+' '+select.id+'-value');
   value=doc.createElement('span');value.id=select.id+'-value';trigger.append(value);
   trigger.insertAdjacentHTML('beforeend','<svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>');
   menu=doc.createElement('div');menu.id=select.id+'-menu';menu.className='language-menu';menu.hidden=true;menu.setAttribute('role','listbox');menu.setAttribute('aria-labelledby',label);
   select.before(control);control.append(select,trigger,menu);select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
   }
   const binding=win.faBindCompetitionMenu(trigger,menu,[],chosen=>{
    select.value=chosen;select.dispatchEvent(new win.Event('change',{bubbles:true}));refreshMenus();
   },control);
   selects.set(select,{trigger,menu,value,binding,fingerprint:null});
   select.addEventListener('change',refreshMenus);
   select.form?.addEventListener('reset',()=>win.queueMicrotask(refreshMenus));
   refreshMenus();
  }
  function links(){
   for(const a of doc.querySelectorAll('a[href]')){
    const href=new URL(a.getAttribute('href'),url);
    if(href.origin===url.origin&&href.pathname.startsWith('/account'))a.href=accountTarget(href.href,language);
   }
  }
  function choose(value){
   language=resolveLanguage(value,null);doc.documentElement.lang=language;
   try{win.localStorage.setItem(key,language)}catch{/* Current document still changes language. */}
   // Keep reloads in the chosen language; one-time tokens are never reintroduced.
   const current=new URL(win.location.href);current.searchParams.delete('next');if(language==='en')current.searchParams.delete('lang');else current.searchParams.set('lang',language);
   win.history.replaceState(null,'',current.pathname+current.search);
   const select=doc.getElementById('account-language');if(select)select.value=language;
   const label=doc.getElementById('account-language-label');
   if(label)label.textContent={en:'Language',de:'Sprache',es:'Idioma',fr:'Langue',it:'Lingua'}[language];
   links();for(const callback of callbacks)callback(language);refreshMenus();
   for(const message of doc.querySelectorAll('[data-validation]'))message.textContent=validation[language][Number(message.dataset.validation)];
  }
  function feedback(node,text,kind='error'){
   if(!node)return;delete node.dataset.validation;node.classList.add('account-feedback');node.dataset.kind=kind;node.textContent=text;
  }
  const validation={
   en:['Complete the required fields.','Enter a valid email address.','Use at least 15 characters for your password.','Check the format of your details.'],
   it:['Compila i campi obbligatori.','Inserisci un indirizzo email valido.','Usa almeno 15 caratteri per la password.','Controlla il formato dei dati inseriti.'],
   de:['Fülle die Pflichtfelder aus.','Gib eine gültige E-Mail-Adresse ein.','Verwende mindestens 15 Zeichen für dein Passwort.','Prüfe das Format deiner Angaben.'],
   es:['Completa los campos obligatorios.','Introduce un correo electrónico válido.','Usa al menos 15 caracteres para la contraseña.','Comprueba el formato de tus datos.'],
   fr:['Remplissez les champs obligatoires.','Saisissez une adresse e-mail valide.','Utilisez au moins 15 caractères pour le mot de passe.','Vérifiez le format des informations saisies.']
  };
  function ready(){
   const select=doc.getElementById('account-language');
   if(select)select.addEventListener('change',()=>choose(select.value));
   choose(language);
   for(const form of doc.querySelectorAll('form')){
    form.noValidate=true;
    form.addEventListener('submit',event=>{
     const invalid=[...form.elements].filter(field=>field.willValidate&&!field.validity.valid);
     if(!invalid.length)return;
     event.preventDefault();event.stopImmediatePropagation();
     for(const field of invalid)field.setAttribute('aria-invalid','true');
     const field=invalid[0],v=field.validity,index=v.valueMissing?0:v.typeMismatch?1:v.tooShort&&field.type==='password'?2:3;
     const message=doc.querySelector('#message,#status');feedback(message,validation[language][index]);
     if(message){message.dataset.validation=String(index);field.setAttribute('aria-describedby',message.id);}
     field.focus();
    },true);
    form.addEventListener('input',event=>event.target.removeAttribute?.('aria-invalid'));
   }
   if(typeof win.faBindCompetitionMenu==='function')for(const select of doc.querySelectorAll('select[data-account-select]'))enhanceSelect(select);
   for(const link of doc.querySelectorAll('[data-account-home]')){
    const home=new URL('/dashboard',url);
    link.href=home.href;
   }
   doc.documentElement.dataset.accountReady="true";
  }
  if(!redirecting){
   doc.documentElement.lang=language;
   if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
   win.addEventListener('storage',event=>{if(event.key===key)choose(event.newValue)});
  }
  // Repaint status messages as well as labels, without touching user-entered values.
  function translateStatus(previous,next){
   for(const node of doc.querySelectorAll('[role="status"],#status,#message,#sessions-summary')){
    const index=previous.indexOf(node.textContent);if(index>=0)node.textContent=next[index];
   }
  }
  return {get language(){return language},redirecting,bind(callback){callbacks.add(callback);callback(language)},translateStatus,choose,refreshMenus,feedback};
 }
 return {accountTarget,resolveLanguage,mount};
});
