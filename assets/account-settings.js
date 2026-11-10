(()=>{
'use strict';
const ui=window.faAccountUI;if(!ui||ui.redirecting)return;
const translations={
en:["Profile","Change password","Current password","New password","Change password","Sign out","Checking your session…","Please sign in.","Password updated. Sign in again.","Action unsuccessful.","Sign in"],
it:["Profilo","Cambia password","Password attuale","Nuova password","Cambia password","Esci","Verifica della sessione…","Accedi per continuare.","Password cambiata. Accedi nuovamente.","Operazione non riuscita.","Accedi"],
de:["Profil","Passwort ändern","Aktuelles Passwort","Neues Passwort","Passwort ändern","Abmelden","Sitzung wird geprüft…","Bitte anmelden.","Passwort geändert. Bitte erneut anmelden.","Vorgang fehlgeschlagen.","Anmelden"],
es:["Perfil","Cambiar contraseña","Contraseña actual","Nueva contraseña","Cambiar contraseña","Cerrar sesión","Comprobando sesión…","Inicia sesión.","Contraseña cambiada. Vuelve a iniciar sesión.","La operación ha fallado.","Acceder"],
fr:["Profil","Modifier le mot de passe","Mot de passe actuel","Nouveau mot de passe","Modifier le mot de passe","Se déconnecter","Vérification de la session…","Veuillez vous connecter.","Mot de passe modifié. Reconnectez-vous.","Opération impossible.","Se connecter"]};
const profileLabels={
 en:['Username','Email','Location'],it:['Nome utente','Email','Località'],
 de:['Benutzername','E-Mail','Ort'],es:['Nombre de usuario','Correo electrónico','Ubicación'],
 fr:['Nom d’utilisateur','E-mail','Localisation']
};
const settingsLabels={
 en:['Security','Edit profile','Country','City','Save changes','Change email','New email','Send confirmation links','Not specified','Profile updated.','If the address is available, confirm the links sent to both addresses.','This username is unavailable or the profile could not be saved.','Enter your current password again.','Contact an administrator to change an operator account email.'],
 it:['Sicurezza','Modifica profilo','Paese','Città','Salva modifiche','Cambia email','Nuova email','Invia link di conferma','Non specificato','Profilo aggiornato.','Se l’indirizzo è disponibile, conferma i link inviati a entrambi gli indirizzi.','Il nome utente non è disponibile oppure il profilo non è stato salvato.','Inserisci di nuovo la password attuale.','Contatta un amministratore per cambiare l’email di un account operatore.'],
 de:['Sicherheit','Profil bearbeiten','Land','Stadt','Änderungen speichern','E-Mail ändern','Neue E-Mail','Bestätigungslinks senden','Keine Angabe','Profil aktualisiert.','Wenn die Adresse verfügbar ist, bestätige die Links an beide Adressen.','Der Benutzername ist nicht verfügbar oder das Profil konnte nicht gespeichert werden.','Gib dein aktuelles Passwort erneut ein.','Wende dich für die E-Mail-Änderung eines Betreiberkontos an einen Administrator.'],
 es:['Seguridad','Editar perfil','País','Ciudad','Guardar cambios','Cambiar correo','Nuevo correo','Enviar enlaces de confirmación','Sin especificar','Perfil actualizado.','Si la dirección está disponible, confirma los enlaces enviados a ambas direcciones.','El nombre de usuario no está disponible o el perfil no se pudo guardar.','Vuelve a introducir tu contraseña actual.','Contacta con un administrador para cambiar el correo de una cuenta de operador.'],
 fr:['Sécurité','Modifier le profil','Pays','Ville','Enregistrer','Modifier l’e-mail','Nouvel e-mail','Envoyer les liens de confirmation','Non précisé','Profil mis à jour.','Si l’adresse est disponible, confirmez les liens envoyés aux deux adresses.','Le nom d’utilisateur est indisponible ou le profil n’a pas pu être enregistré.','Saisissez à nouveau votre mot de passe actuel.','Contactez un administrateur pour modifier l’e-mail d’un compte opérateur.']
};
const editForm=document.getElementById('edit-profile-form'),countrySelect=editForm.elements.nationality;
let codes=[],profile,settings=settingsLabels[ui.language];
function renderCountries(locale){
 const selected=countrySelect.value||(!codes.length?profile?.nationality:'')||'';
 const names=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames([locale],{type:'region'}):null;
 const options=codes.map(code=>[code,names?.of(code)||code]).sort((a,b)=>a[1].localeCompare(b[1],locale));
 countrySelect.replaceChildren(new Option(settings[8],''));
 for(const [code,name] of options)countrySelect.add(new Option(name,code));
 countrySelect.value=selected;
}
function populateProfileForm(){
 editForm.elements.username.value=profile?.username||'';
 editForm.elements.city.value=profile?.city||'';
 countrySelect.value=profile?.nationality||'';
}
let t=translations[ui.language];
const ids=['title','change-title','current-label','new-label','change-button','logout-button','loading'];
function renderProfile(locale){
 const username=profile?.username;
 document.getElementById('username-value').textContent=username||'';
 document.getElementById('username-row').hidden=!username;
 const nationality=profile?.nationality;
 const region=typeof nationality==='string'&&/^[A-Z]{2}$/.test(nationality)?nationality:'';
 const country=region&&typeof Intl.DisplayNames==='function'
  ?new Intl.DisplayNames([locale],{type:'region'}).of(region):region;
 const location=[country,profile?.city].filter(Boolean).join(' · ');
 document.getElementById('location-value').textContent=location;
 document.getElementById('location-row').hidden=!location;
}
ui.bind(value=>{
 const next=translations[value],nextSettings=settingsLabels[value];
 ui.translateStatus(t,next);ui.translateStatus(settings,nextSettings);t=next;settings=nextSettings;
 ids.forEach((id,i)=>document.getElementById(id).textContent=t[i]);
 ['username-label','profile-title','location-label'].forEach((id,i)=>document.getElementById(id).textContent=profileLabels[value][i]);
 const settingsIds=['security-tab','edit-profile-title','edit-nationality-label','edit-city-label','save-profile-button','change-email-title','new-email-label','change-email-button'];
 settingsIds.forEach((id,i)=>document.getElementById(id).textContent=settings[i]);
 document.getElementById('profile-tab').textContent=t[0];
 document.getElementById('edit-username-label').textContent=profileLabels[value][0];
 document.getElementById('email-password-label').textContent=t[2];
 renderProfile(value);renderCountries(value);
 document.querySelector('#login-link a').textContent=t[10];document.title=t[0]+' — Football Architect';
});
const status=document.getElementById('status'),protectedPanel=document.getElementById('protected'),login=document.getElementById('login-link'),loading=document.getElementById('loading');
let csrf='';
const post=async(path,body)=>{const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,'Accept-Language':ui.language},body:JSON.stringify(body)});const result=await r.json().catch(()=>null);if(!r.ok)throw {status:r.status,code:result?.error?.code};return result};
function redirectToLogin(){window.faLoginReturn.remember();location.replace('/account/login')}
function unauthenticated(message){csrf='';protectedPanel.hidden=true;login.hidden=false;loading.hidden=true;ui.feedback(status,message);}
async function init(){try{
 const r=await fetch('/api/player/session',{credentials:'same-origin',cache:'no-store'});if(r.status===401){redirectToLogin();return;}if(!r.ok){unauthenticated(t[9]);return;}
 const value=await r.json();if(!value?.authenticated||typeof value.csrfToken!=='string'||!value.actor||typeof value.actor.email!=='string'){redirectToLogin();return;}
 csrf=value.csrfToken;document.getElementById('identity').textContent=value.actor.email;
 profile=value.profile;
 renderProfile(ui.language);populateProfileForm();
 protectedPanel.hidden=false;loading.hidden=true;
}catch{unauthenticated(t[9])}}
async function execute(button,fn){if(button.disabled)return;button.disabled=true;ui.feedback(status,'');try{await fn()}catch(error){if(error?.status===401){redirectToLogin();return;}ui.feedback(status,({profile_unavailable:settings[11],invalid_credentials:settings[12],admin_transfer_required:settings[13]})[error?.code]||t[9]);}finally{button.disabled=false}}
document.getElementById('change-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;execute(form.querySelector('[type="submit"]'),async()=>{const fd=new FormData(form);await post('/api/player/account/change-password',{currentPassword:String(fd.get('currentPassword')),newPassword:String(fd.get('newPassword'))});form.reset();unauthenticated(t[8]);redirectToLogin()})});
document.getElementById('logout-button').addEventListener('click',e=>execute(e.currentTarget,async()=>{await post('/api/player/logout',{});unauthenticated(t[7]);redirectToLogin()}));
const tabs=[...document.querySelectorAll('.app-profile [role="tab"]')];
function selectTab(selected){
 for(const tab of tabs){
  const active=tab===selected;
  tab.classList.toggle('is-active',active);
  tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
  document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;
 }
 ui.feedback(status,'');
}
tabs.forEach((tab,i)=>{
 tab.addEventListener('click',()=>selectTab(tab));
 tab.addEventListener('keydown',event=>{
  const next={ArrowLeft:tabs[1-i],ArrowRight:tabs[1-i],Home:tabs[0],End:tabs[1]}[event.key];
  if(!next)return;
  event.preventDefault();selectTab(next);next.focus();
 });
});
fetch('/data/country-codes.json',{cache:'force-cache'}).then(response=>response.ok?response.json():null).then(value=>{
 if(!Array.isArray(value)||!value.every(code=>typeof code==='string'&&/^[A-Z]{2}$/.test(code)))return;
 codes=value;renderCountries(ui.language);
 countrySelect.value=profile?.nationality||'';countrySelect.disabled=false;
}).catch(()=>{/* Preserve the saved country if the list is unavailable. */});
editForm.addEventListener('submit',event=>{
 event.preventDefault();
 execute(editForm.querySelector('[type="submit"]'),async()=>{
  const values=Object.fromEntries(new FormData(editForm));
  const result=await post('/api/player/account/profile',{...values,nationality:values.nationality??profile?.nationality??''});
  profile=result.profile;renderProfile(ui.language);populateProfileForm();
  editForm.closest('details').open=false;ui.feedback(status,settings[9],'success');
 });
});
const emailForm=document.getElementById('change-email-form');
emailForm.addEventListener('submit',event=>{
 event.preventDefault();
 execute(emailForm.querySelector('[type="submit"]'),async()=>{
  await post('/api/player/account/change-email',Object.fromEntries(new FormData(emailForm)));
  emailForm.reset();ui.feedback(status,settings[10],'success');
 });
});
init();
})();
