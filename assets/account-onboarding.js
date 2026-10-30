(()=>{'use strict';
const ui=window.faAccountUI;if(!ui||ui.redirecting)return;
const translations={
en:['Create an account','Email','Password','Register','Sign in','Processing…','If registration is available, check your email for a verification link.','Account registration is not available yet.','Please retry later.'],
it:['Crea un account','Email','Password','Registrati','Accedi','Operazione in corso…','Se la registrazione è disponibile, controlla la tua email per il link di verifica.','La registrazione non è ancora disponibile.','Riprova più tardi.'],
de:['Konto erstellen','E-Mail','Passwort','Registrieren','Anmelden','Wird verarbeitet…','Wenn die Registrierung verfügbar ist, prüfe deine E-Mails auf den Bestätigungslink.','Die Registrierung ist noch nicht verfügbar.','Bitte später erneut versuchen.'],
es:['Crear una cuenta','Correo electrónico','Contraseña','Registrarse','Acceder','Procesando…','Si el registro está disponible, revisa tu correo para verificar la cuenta.','El registro todavía no está disponible.','Inténtalo más tarde.'],
fr:['Créer un compte','E-mail','Mot de passe','S’inscrire','Se connecter','Traitement…','Si l’inscription est disponible, consultez votre e-mail pour le lien de vérification.','L’inscription n’est pas encore disponible.','Veuillez réessayer plus tard.']};

const fields={
 en:['Username','3–24 letters, numbers or underscores. Your username is unique.','Nationality (optional)','City (optional)','Not specified','This username is already in use. Choose another.','Check your username, country and city.'],
 it:['Username','3–24 lettere, numeri o underscore. Lo username è univoco.','Nazionalità (facoltativa)','Città (facoltativa)','Non specificata','Questo username è già utilizzato. Scegline un altro.','Controlla username, nazionalità e città.'],
 de:['Benutzername','3–24 Buchstaben, Zahlen oder Unterstriche. Dein Benutzername ist eindeutig.','Nationalität (optional)','Stadt (optional)','Keine Angabe','Dieser Benutzername ist bereits vergeben. Wähle einen anderen.','Prüfe Benutzername, Nationalität und Stadt.'],
 es:['Nombre de usuario','3–24 letras, números o guiones bajos. Tu nombre de usuario es único.','Nacionalidad (opcional)','Ciudad (opcional)','Sin especificar','Este nombre de usuario ya está en uso. Elige otro.','Comprueba el nombre de usuario, la nacionalidad y la ciudad.'],
 fr:['Nom d’utilisateur','3–24 lettres, chiffres ou traits de soulignement. Le nom est unique.','Nationalité (facultative)','Ville (facultative)','Non précisée','Ce nom d’utilisateur est déjà utilisé. Choisissez-en un autre.','Vérifiez le nom d’utilisateur, la nationalité et la ville.']};
const form=document.getElementById('register-form'),status=document.getElementById('status'),button=document.getElementById('submit'),country=document.getElementById('nationality');
let t=translations[ui.language],f=fields[ui.language],submitting=false,codes=[];
function validateCity(){
 const input=form.elements.namedItem('city');
 input.setCustomValidity([...input.value.trim()].length>100||/[\u0000-\u001f\u007f]/.test(input.value)?f[6]:'');
}
form.elements.namedItem('city').addEventListener('input',validateCity);
function renderCountries(locale){
 const selected=country.value,names=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames([locale],{type:'region'}):null;
 country.replaceChildren(new Option(fields[locale][4],''));
 for(const [code,name] of codes.map(code=>[code,names?.of(code)||code]).sort((a,b)=>a[1].localeCompare(b[1],locale)))country.add(new Option(name,code));
 country.value=selected;ui.refreshMenus();
}
ui.bind(locale=>{
 const next=translations[locale],extra=fields[locale];ui.translateStatus(t,next);ui.translateStatus(f,extra);t=next;f=extra;
 for(const [id,i] of [['title',0],['email-label',1],['password-label',2],['login-link',4]])document.getElementById(id).textContent=t[i];
 for(const [id,i] of [['username-label',0],['username-help',1],['nationality-label',2],['city-label',3]])document.getElementById(id).textContent=f[i];
 button.textContent=t[submitting?5:3];renderCountries(locale);validateCity();document.title=t[0]+' — Football Architect';
});
country.disabled=true;
fetch('/data/country-codes.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(value=>{if(!Array.isArray(value)||!value.every(c=>typeof c==='string'&&/^[A-Z]{2}$/.test(c)))return;codes=value;renderCountries(ui.language);country.disabled=false;ui.refreshMenus()}).catch(()=>{/* Optional nationality stays empty if its static list is unavailable. */});
form.addEventListener('submit',async e=>{
 e.preventDefault();if(submitting)return;submitting=true;button.disabled=true;button.textContent=t[5];ui.feedback(status,t[5],'pending');
 const values=new FormData(form);
 try{
  const result=await fetch('/api/player/register',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(values.get('email')||''),password:String(values.get('password')||''),username:String(values.get('username')||'').trim(),nationality:String(values.get('nationality')||''),city:String(values.get('city')||'').trim()})});
  const value=await result.json().catch(()=>({}));
  ui.feedback(status,result.status===202?t[6]:result.status===409&&value?.error?.code==='username_unavailable'?f[5]:result.status===422?f[6]:result.status===503?t[7]:t[8],result.status===202?'success':'error');
  if(result.status===202)form.reset();
 }catch{ui.feedback(status,t[8]);}finally{submitting=false;button.disabled=false;button.textContent=t[3];}
});
})();
