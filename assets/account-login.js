(()=>{
'use strict';
const locale=(navigator.language||'en').slice(0,2).toLowerCase();
const copy={
 en:['Sign in','Email','Password','Sign in','Signing in…','Invalid credentials or unverified account.','Sign-in unavailable.','Please try again later.'],
 it:['Accedi','Email','Password','Accedi','Accesso in corso…','Credenziali non valide o email non verificata.','Accesso non disponibile.','Riprova più tardi.'],
 de:['Anmelden','E-Mail','Passwort','Anmelden','Anmeldung läuft…','Ungültige Zugangsdaten oder nicht bestätigte E-Mail.','Anmeldung nicht verfügbar.','Bitte später erneut versuchen.'],
 es:['Acceder','Correo electrónico','Contraseña','Acceder','Accediendo…','Credenciales incorrectas o correo sin verificar.','Acceso no disponible.','Inténtalo más tarde.'],
 fr:['Se connecter','E-mail','Mot de passe','Se connecter','Connexion…','Identifiants incorrects ou e-mail non vérifié.','Connexion indisponible.','Veuillez réessayer plus tard.']};
const recoveryText={en:'Forgot your password?',it:'Password dimenticata?',de:'Passwort vergessen?',es:'¿Olvidaste tu contraseña?',fr:'Mot de passe oublié ?'};
document.getElementById('recovery-link').textContent=recoveryText[locale]||recoveryText.en;
const t=copy[locale]||copy.en;document.documentElement.lang=copy[locale]?locale:'en';
for(const [id,i] of [['heading',0],['email-label',1],['password-label',2],['submit',3]])document.getElementById(id).textContent=t[i];
const form=document.getElementById('account-login'),message=document.getElementById('message'),button=document.getElementById('submit');
const raw=new URL(location.href).searchParams.get('next')||'/account/';
const safe=raw.startsWith('/')&&!raw.startsWith('//')&&!raw.includes('\\')&&!/[\r\n\u0000-\u001f]/.test(raw)&&!raw.startsWith('/api/')?raw:'/account/';
form.addEventListener('submit',async e=>{
 e.preventDefault();button.disabled=true;button.textContent=t[4];message.textContent='';
 const values=new FormData(form);const password=String(values.get('password')||'');
 try{
  const r=await fetch('/api/player/login',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(values.get('email')||''),password})});
  if(!r.ok){message.textContent=r.status===401?t[5]:r.status===429?t[7]:t[6];return;}
  location.assign(safe);
 }catch{message.textContent=t[6]}finally{button.disabled=false;button.textContent=t[3];}
});
})();
