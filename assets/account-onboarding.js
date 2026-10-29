(()=>{'use strict';
const language=(navigator.language||'en').slice(0,2).toLowerCase();
const translations={
en:['Create an account','Email','Password','Register','Sign in','Processing…','If registration is available, check your email for a verification link.','Account registration is not available yet.','Please retry later.'],
it:['Crea un account','Email','Password','Registrati','Accedi','Operazione in corso…','Se la registrazione è disponibile, controlla la tua email per il link di verifica.','La registrazione non è ancora disponibile.','Riprova più tardi.'],
de:['Konto erstellen','E-Mail','Passwort','Registrieren','Anmelden','Wird verarbeitet…','Wenn die Registrierung verfügbar ist, prüfe deine E-Mails auf den Bestätigungslink.','Die Registrierung ist noch nicht verfügbar.','Bitte später erneut versuchen.'],
es:['Crear una cuenta','Correo electrónico','Contraseña','Registrarse','Acceder','Procesando…','Si el registro está disponible, revisa tu correo para verificar la cuenta.','El registro todavía no está disponible.','Inténtalo más tarde.'],
fr:['Créer un compte','E-mail','Mot de passe','S’inscrire','Se connecter','Traitement…','Si l’inscription est disponible, consultez votre e-mail pour le lien de vérification.','L’inscription n’est pas encore disponible.','Veuillez réessayer plus tard.']};
const t=translations[language]||translations.en;document.documentElement.lang=translations[language]?language:'en';
for(const [id,i] of [['title',0],['email-label',1],['password-label',2],['submit',3],['login-link',4]])document.getElementById(id).textContent=t[i];
const form=document.getElementById('register-form'),status=document.getElementById('status'),button=document.getElementById('submit');
form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;status.textContent=t[5];const values=new FormData(form);
try{const result=await fetch('/api/player/register',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(values.get('email')||''),password:String(values.get('password')||'')})});
status.textContent=result.status===202?t[6]:result.status===503?t[7]:t[8];if(result.status===202)form.reset();
}catch{status.textContent=t[8]}finally{button.disabled=false;}});})();
