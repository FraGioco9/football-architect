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
  url.pathname=url.pathname.replace(/\/index\.html$/,'').replace(/\/+$/,'');
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
   },control,{fitViewport:true});
   selects.set(select,{trigger,menu,value,binding,fingerprint:null});
   select.addEventListener('change',refreshMenus);
   select.form?.addEventListener('reset',()=>win.queueMicrotask(refreshMenus));
   refreshMenus();
  }
  function configureBack(){
   const back=doc.getElementById('account-go-back');if(!back)return;
   back.href=win.faLoginReturn?.peek?.()||'/dashboard';
   back.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    // Navigation preserves the return destination for a later successful sign-in.
    back.href=win.faLoginReturn?.peek?.()||'/dashboard';
   });
  }
  function links(){
   for(const a of doc.querySelectorAll('a[href]')){
    const href=new URL(a.getAttribute('href'),url);
    if(href.origin!==url.origin)continue;
    if(href.pathname.startsWith('/account'))a.href=accountTarget(href.href,language);
    else{href.pathname=href.pathname.replace(/\/+$/,'')||'/';a.href=href.href;}
   }
  }
  function choose(value){
   language=resolveLanguage(value,null);doc.documentElement.lang=language;
   try{win.localStorage.setItem(key,language)}catch{/* Current document still changes language. */}
   // Keep reloads in the chosen language; one-time tokens are never reintroduced.
   const current=new URL(win.location.href);current.pathname=current.pathname.replace(/\/index\.html$/,'').replace(/\/+$/,'');current.searchParams.delete('next');if(language==='en')current.searchParams.delete('lang');else current.searchParams.set('lang',language);
   win.history.replaceState(null,'',current.pathname+current.search);
   const select=doc.getElementById('account-language');if(select)select.value=language;
   const label=doc.getElementById('account-language-label');
   if(label)label.textContent={en:'Language',de:'Sprache',es:'Idioma',fr:'Langue',it:'Lingua'}[language];
   links();for(const callback of callbacks)callback(language);refreshMenus();refreshAssistance();
   const backLabel=doc.getElementById('account-go-back-label');
   if(backLabel)backLabel.textContent={en:'Go back',it:'Torna indietro',de:'Zurück',es:'Volver',fr:'Retour'}[language];
   for(const message of doc.querySelectorAll('[data-validation]'))message.textContent=validation[language][Number(message.dataset.validation)];
  }
  function feedback(node,text,kind='error'){
   if(!node)return;delete node.dataset.validation;node.classList.add('account-feedback');node.dataset.kind=kind;node.textContent=text;
  }
  const touched=new WeakSet();
  const assistance={
   en:['Show password','Hide password','At least 15 characters.','Optional information','Check your inbox and spam folder. If you receive a verification link, open it, then sign in.','Check your inbox and spam folder. If you receive a recovery link, open it to choose a new password.','Sign in using your new password.'],
   it:['Mostra password','Nascondi password','Almeno 15 caratteri.','Informazioni facoltative','Controlla la posta in arrivo e lo spam. Se ricevi un link di verifica, aprilo e poi accedi.','Controlla la posta in arrivo e lo spam. Se ricevi un link di recupero, aprilo per scegliere una nuova password.','Accedi con la nuova password.'],
   de:['Passwort anzeigen','Passwort verbergen','Mindestens 15 Zeichen.','Optionale Angaben','Prüfe Posteingang und Spamordner. Falls du einen Bestätigungslink erhältst, öffne ihn und melde dich danach an.','Prüfe Posteingang und Spamordner. Falls du einen Wiederherstellungslink erhältst, öffne ihn und wähle ein neues Passwort.','Melde dich mit deinem neuen Passwort an.'],
   es:['Mostrar contraseña','Ocultar contraseña','Al menos 15 caracteres.','Información opcional','Revisa tu bandeja de entrada y el correo no deseado. Si recibes un enlace de verificación, ábrelo y después inicia sesión.','Revisa tu bandeja de entrada y el correo no deseado. Si recibes un enlace de recuperación, ábrelo para elegir una contraseña nueva.','Inicia sesión con tu nueva contraseña.'],
   fr:['Afficher le mot de passe','Masquer le mot de passe','Au moins 15 caractères.','Informations facultatives','Consultez votre boîte de réception et les indésirables. Si vous recevez un lien de vérification, ouvrez-le puis connectez-vous.','Consultez votre boîte de réception et les indésirables. Si vous recevez un lien de récupération, ouvrez-le pour choisir un nouveau mot de passe.','Connectez-vous avec votre nouveau mot de passe.']
  };
  function refreshAssistance(){
   const t=assistance[language];
   for(const button of doc.querySelectorAll('[data-password-toggle]')){
    button.setAttribute('aria-label',t[button.getAttribute('aria-pressed')==='true'?1:0]);
    const slash=button.querySelector('[data-password-slash]');if(slash)slash.toggleAttribute('hidden',button.getAttribute('aria-pressed')!=='true');
   }
   for(const help of doc.querySelectorAll('[data-password-help]')){
    const field=doc.querySelector('[aria-describedby~="'+help.id+'"]');help.textContent=t[2];help.dataset.met=String(!!field&&field.value.length>=15);
   }
   const username=doc.querySelector('[name="username"]'),hint=doc.getElementById('username-help');if(hint&&username)hint.dataset.met=String(/^[A-Za-z0-9_]{3,24}$/.test(username.value));
   for(const [id,index] of [['optional-title',3]]){const node=doc.getElementById(id);if(node)node.textContent=t[index];}
   const step=doc.getElementById('account-next-step');if(step?.dataset.step)step.textContent=t[{registration:4,recovery:5,reset:6}[step.dataset.step]];
  }
  function nextStep(kind){
   const node=doc.getElementById('account-next-step');if(!node)return;
   node.hidden=!kind;if(kind)node.dataset.step=kind;else delete node.dataset.step;
   const link=doc.getElementById('login-link')||doc.getElementById('signin-link');
   if(link){link.classList.toggle('cta',!!kind);link.classList.toggle('cta-secondary',!!kind);}
   refreshAssistance();
  }
  function clearFieldError(field){
   if(!field?.getAttribute)return;
   const id=field.getAttribute('data-error-id');if(!id)return;
   const error=doc.getElementById(id);if(error){error.textContent='';delete error.dataset.validation;}
   field.removeAttribute('aria-invalid');delete field.dataset.remoteError;
   const descriptions=(field.getAttribute('aria-describedby')||'').split(/\s+/).filter(value=>value&&value!==id);
   if(descriptions.length)field.setAttribute('aria-describedby',descriptions.join(' '));else field.removeAttribute('aria-describedby');
  }
  function fieldError(field,text,index){
   let id=field.getAttribute('data-error-id');
   if(!id){id=field.id?field.id+'-error':field.form.id+'-'+field.name+'-error';field.setAttribute('data-error-id',id);}
   let node=doc.getElementById(id);
   if(!node){node=doc.createElement('small');node.id=id;node.className='account-field-error';node.setAttribute('aria-live','polite');(field.closest('.account-field')||field.closest('label')||field.parentElement).append(node);}
   if(Number.isInteger(index))delete field.dataset.remoteError;else field.dataset.remoteError='true';
   node.textContent=text;if(Number.isInteger(index))node.dataset.validation=String(index);else delete node.dataset.validation;
   field.setAttribute('aria-invalid','true');
   field.setAttribute('aria-describedby',[...new Set((field.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).concat(id))].join(' '));
  }
  function validateField(field){
   if(field.dataset.remoteError)return;
   if(!field.willValidate||field.validity.valid){clearFieldError(field);return;}
   const v=field.validity,index=v.valueMissing?0:v.typeMismatch?1:v.tooShort&&/password/i.test(field.name)?2:3;
   fieldError(field,validation[language][index],index);
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
   for(const button of doc.querySelectorAll('[data-password-toggle]')){
    const field=doc.getElementById(button.getAttribute('aria-controls'));
    button.addEventListener('click',()=>{
      const shown=field.type==='password';field.type=shown?'text':'password';button.setAttribute('aria-pressed',String(shown));refreshAssistance();
    });
   }
   for(const form of doc.querySelectorAll('form')){
    form.noValidate=true;
    form.addEventListener('submit',event=>{
     const invalid=[...form.elements].filter(field=>field.willValidate&&!field.validity.valid);
     if(!invalid.length)return;
     event.preventDefault();event.stopImmediatePropagation();
     feedback(doc.querySelector('#message,#status'),'');
     for(const field of invalid){touched.add(field);validateField(field);}
     invalid[0].focus();
    },true);
    form.addEventListener('focusout',event=>{if(event.target.willValidate){touched.add(event.target);validateField(event.target);}});
    form.addEventListener('input',event=>{const field=event.target;if(field.dataset.remoteError)clearFieldError(field);if(touched.has(field))validateField(field);else clearFieldError(field);refreshAssistance();});
    form.addEventListener('reset',()=>win.queueMicrotask(()=>{
     for(const field of form.elements){clearFieldError(field);touched.delete(field);}
     for(const button of form.querySelectorAll('[data-password-toggle]')){doc.getElementById(button.getAttribute('aria-controls')).type='password';button.setAttribute('aria-pressed','false');}
     refreshAssistance();
    }));
   }
   if(typeof win.faBindCompetitionMenu==='function')for(const select of doc.querySelectorAll('select[data-account-select]'))enhanceSelect(select);
   for(const link of doc.querySelectorAll('[data-account-home]')){
    const home=new URL('/dashboard',url);
    link.href=home.href;
   }
   // Hit-test the field itself, never the surrounding label, helper or feedback text.
   // A direct pointer target avoids ancestor :hover matching on nested label markup.
   let hoveredField=null;
   const setHovered=target=>{
    const control=target?.closest?.('input:not([type="checkbox"]):not([type="radio"]),textarea,select:not([hidden]),.language-trigger');
    const next=control&&!control.disabled&&!control.hasAttribute('aria-disabled')?control:null;
    if(hoveredField===next)return;
    hoveredField?.removeAttribute('data-field-pointer-hover');
    hoveredField=next;
    hoveredField?.setAttribute('data-field-pointer-hover','');
   };
   doc.addEventListener('pointermove',event=>setHovered(event.pointerType==='mouse'?event.target:null),{passive:true});
   doc.addEventListener('pointerout',event=>{if(!event.relatedTarget)setHovered(null)},{passive:true});
   doc.addEventListener('pointerdown',()=>setHovered(null),{passive:true});
   configureBack();
   doc.documentElement.dataset.accountReady="true";
  }
  if(!redirecting){
   doc.documentElement.lang=language;
   if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
   win.addEventListener('storage',event=>{if(event.key===key)choose(event.newValue)});
  }
  // Repaint status messages as well as labels, without touching user-entered values.
  function translateStatus(previous,next){
   for(const node of doc.querySelectorAll('[role="status"],#status,#message,#sessions-summary,.account-field-error')){
    const index=previous.indexOf(node.textContent);if(index>=0)node.textContent=next[index];
   }
  }
  return {get language(){return language},redirecting,bind(callback){callbacks.add(callback);callback(language)},translateStatus,choose,refreshMenus,feedback,fieldError,nextStep};
 }
 return {accountTarget,resolveLanguage,mount};
});
