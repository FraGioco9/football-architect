(()=>{'use strict';
const ui=window.faAccountUI;if(!ui||ui.redirecting)return;
const copy={
 en:['Sign in','Email','Password','Sign in','Signing in…','Invalid credentials or unverified account.','Sign-in unavailable.','Please try again later.'],
 it:['Accedi','Email','Password','Accedi','Accesso in corso…','Credenziali non valide o email non verificata.','Accesso non disponibile.','Riprova più tardi.'],
 de:['Anmelden','E-Mail','Passwort','Anmelden','Anmeldung läuft…','Ungültige Zugangsdaten oder nicht bestätigte E-Mail.','Anmeldung nicht verfügbar.','Bitte später erneut versuchen.'],
 es:['Acceder','Correo electrónico','Contraseña','Acceder','Accediendo…','Credenciales incorrectas o correo sin verificar.','Acceso no disponible.','Inténtalo más tarde.'],
 fr:['Se connecter','E-mail','Mot de passe','Se connecter','Connexion…','Identifiants incorrects ou e-mail non vérifié.','Connexion indisponible.','Veuillez réessayer plus tard.']};

const registrationText={en:'Create an account',it:'Crea un account',de:'Konto erstellen',es:'Crear una cuenta',fr:'Créer un compte'};
const recoveryText={en:'Forgot your password?',it:'Password dimenticata?',de:'Passwort vergessen?',es:'¿Olvidaste tu contraseña?',fr:'Mot de passe oublié ?'};
const form=document.getElementById('account-login'),message=document.getElementById('message'),button=document.getElementById('submit');
let submitting=false,t=copy[ui.language];
ui.bind(locale=>{
 const next=copy[locale];ui.translateStatus(t,next);t=next;
 for(const [id,i] of [['heading',0],['email-label',1],['password-label',2]])document.getElementById(id).textContent=t[i];
 button.textContent=t[submitting?4:3];
 document.getElementById('register-link').textContent=registrationText[locale];
 document.getElementById('recovery-link').textContent=recoveryText[locale];
 document.title=t[0]+' — Football Architect';
});
const raw=new URL(location.href).searchParams.get('next')||'/account/';
const safe=['/account/','/settings/'].includes(raw)?raw:'/account/';
(async()=>{try{const r=await fetch('/api/player/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const value=await r.json();if(!submitting&&value?.authenticated===true&&typeof value?.actor?.id==='string')location.replace(safe);}catch{/* Restore failures leave the login available. */}})();
form.addEventListener('submit',async e=>{
 e.preventDefault();if(submitting)return;submitting=true;button.disabled=true;button.textContent=t[4];ui.feedback(message,'');
 const values=new FormData(form),password=String(values.get('password')||'');
 try{
  const r=await fetch('/api/player/login',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(values.get('email')||''),password})});
  if(!r.ok){ui.feedback(message,r.status===401?t[5]:r.status===429?t[7]:t[6]);return;}
  form.reset();location.replace(safe);
 }catch{ui.feedback(message,t[6]);}finally{submitting=false;button.disabled=false;button.textContent=t[3];}
});
})();
