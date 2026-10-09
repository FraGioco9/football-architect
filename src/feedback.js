import {icon} from './icons.js';

// Localized messages never expose raw exceptions or internal save details.
const dictionary={
 FIELD_MANAGER_REQUIRED:{it:['Nome allenatore obbligatorio','Inserisci un nome per iniziare la carriera.'],en:['Manager name required','Enter a name to start your career.']},
 FIELD_MANAGER_LENGTH:{it:['Nome troppo lungo','Il nome dell’allenatore non può superare 80 caratteri.'],en:['Name too long','The manager name cannot exceed 80 characters.']},
 FIELD_FIRST_REQUIRED:{it:['Nome obbligatorio','Inserisci il nome.'],en:['First name required','Enter your first name.']},
 FIELD_FIRST_LENGTH:{it:['Nome troppo lungo','Il nome può contenere al massimo 40 caratteri.'],en:['First name too long','First name must be 40 characters or fewer.']},
 FIELD_LAST_REQUIRED:{it:['Cognome obbligatorio','Inserisci il cognome.'],en:['Last name required','Enter your last name.']},
 FIELD_LAST_LENGTH:{it:['Cognome troppo lungo','Il cognome può contenere al massimo 40 caratteri e il nome completo 80.'],en:['Last name too long','Last name must be 40 characters or fewer, and the full name 80.']},
 FIELD_BIRTH_INVALID:{it:['Data di nascita non valida','Inserisci una data reale che non sia futura.'],en:['Invalid birth date','Enter a real date that is not in the future.']},
 FIELD_NATIONALITY_REQUIRED:{it:['Nazionalità obbligatoria','Inserisci la nazionalità.'],en:['Nationality required','Enter your nationality.']},
 FIELD_NATIONALITY_LENGTH:{it:['Nazionalità troppo lunga','La nazionalità non può superare 80 caratteri.'],en:['Nationality too long','Nationality must be 80 characters or fewer.']},
 FIELD_BIRTHPLACE_REQUIRED:{it:['Luogo di nascita obbligatorio','Inserisci il luogo di nascita.'],en:['Birthplace required','Enter your place of birth.']},
 FIELD_BIRTHPLACE_LENGTH:{it:['Luogo di nascita troppo lungo','Il luogo di nascita non può superare 80 caratteri.'],en:['Birthplace too long','Birthplace must be 80 characters or fewer.']},
 CAREER_NAME_INVALID:{it:['Nome carriera non valido','Usa un nome da 1 a 80 caratteri.'],en:['Invalid career name','Use a name between 1 and 80 characters.']},
 CAREER_DATA_INVALID:{it:['Dati della carriera non validi','Controlla allenatore e squadra prima di riprovare.'],en:['Invalid career details','Check your manager and club selection before retrying.']},
 INDEXEDDB_UNAVAILABLE:{it:['Salvataggi non disponibili','Il browser non consente l’archiviazione locale. Controlla permessi e modalità privata. Nessuna carriera è stata eliminata.'],en:['Saves unavailable','The browser cannot use local storage. Check permissions and private browsing mode. No careers have been deleted.']},
 INDEXEDDB_OPEN:{it:['Archivio non accessibile','Non è possibile aprire i salvataggi locali. Chiudi altre schede del gioco e riprova; i dati non sono stati cancellati.'],en:['Storage could not be opened','Close any other game tabs and retry. Your saved data has not been deleted.']},
 INDEXEDDB_BLOCKED:{it:['Archivio occupato','Chiudi eventuali altre schede di Football Architect, quindi riprova.'],en:['Storage is busy','Close any other Football Architect tabs, then retry.']},
 IDB_TRANSACTION:{it:['Operazione non salvata','Il browser non ha completato l’operazione. Verifica lo spazio disponibile e riprova.'],en:['Operation not saved','The browser did not complete the operation. Check available storage and retry.']},
 IDB_ABORT:{it:['Modifica non applicata','L’operazione è stata annullata. Il salvataggio precedente è conservato; ricarica la carriera e riprova.'],en:['Change not applied','The operation was cancelled. Your previous save remains; reload the career and retry.']},
 IDB_REQUEST:{it:['Errore del database','Non è stato possibile completare la richiesta di salvataggio. Riprova senza eliminare i dati.'],en:['Database error','The save request could not be completed. Retry without clearing your data.']},
 IMPORT_INVALID:{it:['File carriera non valido','Il JSON è danneggiato, incompatibile oppure non appartiene a Football Architect. Nessun salvataggio esistente è stato modificato.'],en:['Invalid career file','The JSON is corrupt, incompatible or not a Football Architect save. Existing saves have not been modified.']},
 IMPORT_TOO_LARGE:{it:['File troppo grande','Il file JSON supera il limite previsto di 2 MB.'],en:['File too large','The JSON file exceeds the 2 MB limit.']},
 STORAGE_QUOTA:{it:['Spazio di salvataggio esaurito','Libera spazio nel browser o sul dispositivo ed esporta le carriere importanti prima di riprovare.'],en:['Not enough save space','Free browser or device storage, and export important careers before retrying.']},
 STORAGE_PERMISSION:{it:['Accesso ai salvataggi negato','Verifica le impostazioni di privacy e archiviazione del browser.'],en:['Save access denied','Check your browser privacy and storage permissions.']},
 STORAGE_CLOSED:{it:['Archivio non più disponibile','L’archivio locale è stato chiuso. Ricarica l’applicazione per riprovare.'],en:['Storage is no longer available','The local database was closed. Reload the application to retry.']},
 UNKNOWN:{it:['Operazione non riuscita','Non è stato possibile completare l’operazione. Nessuna carriera è stata eliminata automaticamente.'],en:['Operation failed','The operation could not be completed. No career was automatically deleted.']},
 READ_FAILED:{it:['Carriere non caricabili','La lettura dei salvataggi non è riuscita. Riprova; non cancellare i dati del sito.'],en:['Could not load careers','Reading your saves failed. Retry without clearing site data.']},
 IMPORT_OK:{it:['Carriera importata','Il nuovo salvataggio è stato aggiunto alle tue carriere.'],en:['Career imported','The new save has been added to your careers.']},
 RENAME_OK:{it:['Carriera rinominata','Il nuovo nome è stato salvato, senza cambiare l’allenatore.'],en:['Career renamed','The new name was saved without changing the manager.']},
 DELETE_OK:{it:['Carriera eliminata','È stata eliminata soltanto la carriera selezionata.'],en:['Career deleted','Only the selected career was deleted.']}
};
const exceptionAliases={QuotaExceededError:'STORAGE_QUOTA',SecurityError:'STORAGE_PERMISSION',NotAllowedError:'STORAGE_PERMISSION',InvalidStateError:'STORAGE_CLOSED',UnknownError:'IDB_TRANSACTION',AbortError:'IDB_ABORT'};
const escapeHtml=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function feedback(kind,code){
 const severity=kind==='success'?'success':kind==='warning'?'warning':'error';
 return {kind:severity,code:Object.hasOwn(dictionary,code)?code:'UNKNOWN'};
}
export function fromError(cause,scope='operation'){
 const code=typeof cause?.message==='string'&&Object.hasOwn(dictionary,cause.message)
   ?cause.message
   :exceptionAliases[cause?.name]??(scope==='read'?'READ_FAILED':'UNKNOWN');
 return feedback('error',code);
}
export function feedbackText(item,lang='it'){
 const entry=dictionary[item?.code]??dictionary.UNKNOWN;
 const [title,description]=entry[lang==='en'?'en':'it'];
 return {title,description};
}
export function inlineManagerError(name,lang='it'){
 const value=typeof name==='string'?name.trim():'';
 const code=!value?'FIELD_MANAGER_REQUIRED':value.length>80?'FIELD_MANAGER_LENGTH':null;
 return code?{code,...feedbackText({code},lang)}:null;
}
export function renderFeedback(item,lang='it'){
 if(!item)return '';
 const {title,description}=feedbackText(item,lang);
 const kind=['error','success','warning'].includes(item.kind)?item.kind:'error';
 const symbol=kind==='success'?'check':'alert-triangle';
 const close=lang==='en'?'Dismiss notification':'Chiudi messaggio';
 return `<div class="fa-feedback fa-feedback-${kind}" role="${kind==='error'?'alert':'status'}" data-feedback-kind="${kind}">
  <span class="fa-feedback-icon">${icon(symbol,19)}</span>
  <div class="fa-feedback-copy"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>
  <button type="button" class="fa-feedback-dismiss" data-action="feedback-dismiss" aria-label="${close}">${icon('x',17)}</button>
 </div>`;
}
export function renderBlockingError(cause,lang='it'){
 const item=fromError(cause,'read'),msg=feedbackText(item,lang);
 const back=lang==='en'?'Back to menu':'Torna al menu';
 const retry=lang==='en'?'Retry':'Riprova';
 return `<section class="fa-blocking-error panel" role="alert">
  <span class="fa-blocking-error-icon">${icon('alert-triangle',26)}</span>
  <h1 class="fa-page-title">${escapeHtml(msg.title)}</h1><p>${escapeHtml(msg.description)}</p>
  <div class="fa-blocking-actions">
   <button type="button" class="btn primary" data-action="retry-storage">${icon('refresh-cw',16)}<span>${retry}</span></button>
   <button type="button" class="btn ghost" data-action="home">${icon('arrow-left',16)}<span>${back}</span></button>
  </div>
 </section>`;
}
