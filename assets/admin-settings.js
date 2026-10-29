/* Server-authorized Admin UI. Credentials/CSRF are never written to browser storage. */
((root,factory)=>{
 const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root.document)api.mount(root.document);
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const copies={
 en:{title:'World administration',approvalPrompt:"Type APPROVE SEASON 2 to confirm the exact membership snapshot",approvalButton:"Approve Season 2 participants",forbidden:"Your account does not have permission to administer this world.",intro:'Public pages remain available to everyone. Admin access uses your account permissions.',email:'Email',password:'Password',signIn:'Sign in',signOut:'Sign out',accountSignIn:"Sign in with your Football Architect account",prepare:'Prepare season',refresh:'Refresh',checking:'Checking access…',signedOut:'Signed out.',signedIn:'Signed in.',unavailable:'Administration is unavailable. Try again later.',invalid:'Sign-in failed. Check your credentials.',throttled:'Too many attempts. Try again in 15 minutes.',prerequisite:'Preparation is blocked until the participant and rules catalogue is approved.',stale:'The world has changed. Refresh before trying again.',prepared:'Season prepared. It has not started.',working:'Working…',logoutFailed:'Sign-out could not be confirmed. Retry sign out.',season:'Season',revision:'revision',day:'day',unstarted:'unstarted',preparing:'preparing',active:'active',closed:'closed',resetTitle:"Reset world to Season 0",resetSummary:"Permanently deletes all season calendars, draws, match results, statistics, playoff records, administrative events and history. Club catalogues, rules and administrator access remain.",resetPrompt:"Type RESET SEASON 0 to confirm",resetButton:"Delete all seasons",resetDone:"World reset to Season 0.",resetBlocked:"Reset requires a prepared, active or closed season.",operationLabel:"Current operation",operationIdle:"Ready for an administrative action.",operationPrerequisite:"Preparation requires Season 0. Reset requires an existing season.",operationStale:"World changed; refresh authoritative state before retrying.",operationBlocked:"Approval or required sporting evidence is missing. Check the season prerequisites.",operationSuccess:"Action complete. The displayed generation and revision are authoritative.",generationLabel:"Generation",cmdinitialize:"Initialize events",cmdconfirm:"Confirm entrants",cmddomestic:"Generate domestic calendar",cmddraw:"Draw international cups",cmdpublish:"Publish international calendar",cmdstart:"Start season",cmdadvance:"Advance day",cmdarchive:"Archive season",endSeasonFlow:"Archive → Close → Prepare next season",cmdclose:"Close season",cmdlegacy:"Generate season calendar",cmdeventStart:"Start event calendar",cmdeventAdvance:"Advance event calendar",reschedule0:"Move future event",reschedule1:"Scheduled milestone",reschedule2:"Day (1–56)",reschedule3:"Order (0–9999)",reschedule4:"Save event placement",closureDays:"Saved sporting days",closureTies:"Saved knockout ties",closureReady:"Closure prerequisites satisfied",closurePending:"Closure not yet available",nextHeading:"Season 2 — qualification review",nextReviewRequired:"Provisional proposal requires owner approval",nextCompetitions:"Competitions",nextReviewUnavailable:"Review unavailable; no activation permitted",nextHolderBlocked:"Holder allocation requires a decision",nextHolderAligned:"Holder allocation already aligned",nextProposal:"Proposal only — approval required",nextSnapshotHash:"Snapshot hash",cmdnextPrepare:"Prepare Season 2",nextApproved:"Season 2 membership approved"},
 it:{title:'Amministrazione del mondo',approvalPrompt:"Digita APPROVE SEASON 2 per confermare l'elenco esatto dei partecipanti",approvalButton:"Approva partecipanti Stagione 2",forbidden:"Il tuo account non dispone dei permessi per amministrare questo mondo.",intro:'Le pagine pubbliche restano accessibili a tutti. L’accesso Admin dipende dai permessi del tuo account.',email:'Email',password:'Password',signIn:'Accedi',signOut:'Esci',accountSignIn:"Accedi con il tuo account Football Architect",prepare:'Prepara stagione',refresh:'Aggiorna',checking:'Verifica accesso…',signedOut:'Accesso non effettuato.',signedIn:'Accesso effettuato.',unavailable:'Amministrazione non disponibile. Riprova più tardi.',invalid:'Accesso non riuscito. Controlla le credenziali.',throttled:'Troppi tentativi. Riprova fra 15 minuti.',prerequisite:'Preparazione bloccata: il catalogo di partecipanti e regole deve essere approvato.',stale:'Il mondo è cambiato. Aggiorna prima di riprovare.',prepared:'Stagione preparata, non ancora iniziata.',working:'Operazione in corso…',logoutFailed:'Uscita non confermata. Riprova a uscire.',season:'Stagione',revision:'revisione',day:'giorno',unstarted:'non iniziata',preparing:'in preparazione',active:'attiva',closed:'conclusa',resetTitle:"Reimposta il mondo alla Stagione 0",resetSummary:"Elimina definitivamente calendari, sorteggi, risultati, statistiche, playoff, eventi amministrativi e storico di tutte le stagioni. Restano cataloghi dei club, regole e accesso amministratore.",resetPrompt:"Scrivi RESET SEASON 0 per confermare",resetButton:"Elimina tutte le stagioni",resetDone:"Mondo riportato alla Stagione 0.",resetBlocked:"Il reset richiede una stagione in preparazione, attiva o conclusa.",operationLabel:"Operazione corrente",operationIdle:"Pronto per un'operazione amministrativa.",operationPrerequisite:"La preparazione richiede la Stagione 0. Il reset richiede una stagione esistente.",operationStale:"Il mondo è cambiato: aggiorna lo stato prima di riprovare.",operationBlocked:"Manca un'approvazione o una prova sportiva necessaria. Controlla i prerequisiti della stagione.",operationSuccess:"Operazione completata. Generazione e revisione mostrate sono autorevoli.",generationLabel:"Generazione",cmdinitialize:"Inizializza eventi",cmdconfirm:"Conferma partecipanti",cmddomestic:"Genera calendario nazionale",cmddraw:"Sorteggia coppe internazionali",cmdpublish:"Pubblica calendario internazionale",cmdstart:"Avvia stagione",cmdadvance:"Avanza giorno",cmdarchive:"Archivia stagione",endSeasonFlow:"Archiviazione → Chiusura → Preparazione successiva",cmdclose:"Chiudi stagione",cmdlegacy:"Genera calendario della stagione",cmdeventStart:"Avvia calendario eventi",cmdeventAdvance:"Avanza calendario eventi",reschedule0:"Sposta evento futuro",reschedule1:"Evento programmato",reschedule2:"Giorno (1–56)",reschedule3:"Ordine (0–9999)",reschedule4:"Salva posizione evento",closureDays:"Giornate sportive salvate",closureTies:"Tabelloni playoff salvati",closureReady:"Prerequisiti di chiusura soddisfatti",closurePending:"Chiusura non ancora disponibile",nextHeading:"Stagione 2 — revisione qualificazioni",nextReviewRequired:"Proposta provvisoria soggetta ad approvazione",nextCompetitions:"Competizioni",nextReviewUnavailable:"Revisione non disponibile; attivazione vietata",nextHolderBlocked:"Assegnazione del detentore da decidere",nextHolderAligned:"Assegnazione del detentore coerente",nextProposal:"Solo proposta — approvazione necessaria",nextSnapshotHash:"Hash dello snapshot",cmdnextPrepare:"Prepara Stagione 2",nextApproved:"Partecipanti della Stagione 2 approvati"},
 de:{title:'Weltverwaltung',approvalPrompt:"APPROVE SEASON 2 eingeben, um die genaue Teilnehmerliste zu bestätigen",approvalButton:"Teilnehmer für Saison 2 genehmigen",forbidden:"Dein Konto hat keine Berechtigung, diese Welt zu verwalten.",intro:'Öffentliche Seiten bleiben für alle zugänglich. Admin-Zugriff basiert auf Kontoberechtigungen.', um die gemeinsame Welt zu verwalten.',email:'E-Mail',password:'Passwort',signIn:'Anmelden',signOut:'Abmelden',accountSignIn:"Mit deinem Football-Architect-Konto anmelden",prepare:'Saison vorbereiten',refresh:'Aktualisieren',checking:'Zugang wird geprüft…',signedOut:'Abgemeldet.',signedIn:'Angemeldet.',unavailable:'Verwaltung nicht verfügbar. Später erneut versuchen.',invalid:'Anmeldung fehlgeschlagen. Zugangsdaten prüfen.',throttled:'Zu viele Versuche. In 15 Minuten erneut versuchen.',prerequisite:'Vorbereitung gesperrt, bis Teilnehmer- und Regelkatalog genehmigt sind.',stale:'Die Welt hat sich geändert. Zuerst aktualisieren.',prepared:'Saison vorbereitet, noch nicht gestartet.',working:'Wird bearbeitet…',logoutFailed:'Abmeldung nicht bestätigt. Erneut abmelden.',season:'Saison',revision:'Revision',day:'Tag',unstarted:'nicht gestartet',preparing:'in Vorbereitung',active:'aktiv',closed:'abgeschlossen',resetTitle:"Welt auf Saison 0 zurücksetzen",resetSummary:"Löscht dauerhaft Saisonkalender, Auslosungen, Spielergebnisse, Statistiken, Playoffs, Verwaltungsereignisse und Historie. Vereinskataloge, Regeln und Administratorzugang bleiben erhalten.",resetPrompt:"RESET SEASON 0 zur Bestätigung eingeben",resetButton:"Alle Saisons löschen",resetDone:"Welt auf Saison 0 zurückgesetzt.",resetBlocked:"Zurücksetzen erfordert eine vorbereitete, aktive oder abgeschlossene Saison.",operationLabel:"Aktuelle Aktion",operationIdle:"Bereit für eine Verwaltungsaktion.",operationPrerequisite:"Vorbereitung erfordert Saison 0. Zurücksetzen erfordert eine bestehende Saison.",operationStale:"Welt geändert: zuerst den aktuellen Zustand laden.",operationBlocked:"Eine Genehmigung oder erforderlicher Sportnachweis fehlt. Saisonvoraussetzungen prüfen.",operationSuccess:"Aktion abgeschlossen. Generation und Revision sind verbindlich.",generationLabel:"Generation",cmdinitialize:"Ereignisse initialisieren",cmdconfirm:"Teilnehmer bestätigen",cmddomestic:"Nationalen Kalender erstellen",cmddraw:"Internationale Pokale auslosen",cmdpublish:"Internationalen Kalender veröffentlichen",cmdstart:"Saison starten",cmdadvance:"Tag vorwärts",cmdarchive:"Saison archivieren",endSeasonFlow:"Archivieren → Abschließen → Nächste Saison vorbereiten",cmdclose:"Saison abschließen",cmdlegacy:"Saisonkalender erstellen",cmdeventStart:"Ereigniskalender starten",cmdeventAdvance:"Ereigniskalender weiterschalten",reschedule0:"Künftiges Ereignis verschieben",reschedule1:"Geplanter Meilenstein",reschedule2:"Tag (1–56)",reschedule3:"Reihenfolge (0–9999)",reschedule4:"Ereignis verschieben",closureDays:"Gespeicherte Spieltage",closureTies:"Gespeicherte K.-o.-Duelle",closureReady:"Abschlussvoraussetzungen erfüllt",closurePending:"Abschluss noch nicht möglich",nextHeading:"Saison 2 — Qualifikationsprüfung",nextReviewRequired:"Vorläufiger Vorschlag benötigt Freigabe",nextCompetitions:"Wettbewerbe",nextReviewUnavailable:"Prüfung nicht verfügbar; Aktivierung gesperrt",nextHolderBlocked:"Titelverteidiger-Zuordnung ungeklärt",nextHolderAligned:"Titelverteidiger-Zuordnung korrekt",nextProposal:"Nur Vorschlag — Freigabe erforderlich",nextSnapshotHash:"Snapshot-Hash",cmdnextPrepare:"Saison 2 vorbereiten",nextApproved:"Teilnehmer der Saison 2 genehmigt"},
 es:{title:'Administración del mundo',approvalPrompt:"Escribe APPROVE SEASON 2 para confirmar la lista exacta de participantes",approvalButton:"Aprobar participantes de la temporada 2",forbidden:"Tu cuenta no tiene permisos para administrar este mundo.",intro:'Las páginas públicas siguen disponibles para todos. El acceso Admin depende de los permisos de tu cuenta.',email:'Correo electrónico',password:'Contraseña',signIn:'Acceder',signOut:'Cerrar sesión',accountSignIn:"Accede con tu cuenta de Football Architect",prepare:'Preparar temporada',refresh:'Actualizar',checking:'Comprobando acceso…',signedOut:'Sesión cerrada.',signedIn:'Sesión iniciada.',unavailable:'Administración no disponible. Inténtalo más tarde.',invalid:'Acceso fallido. Comprueba las credenciales.',throttled:'Demasiados intentos. Inténtalo en 15 minutos.',prerequisite:'Preparación bloqueada hasta aprobar el catálogo de participantes y reglas.',stale:'El mundo ha cambiado. Actualiza antes de intentarlo.',prepared:'Temporada preparada, aún no iniciada.',working:'Procesando…',logoutFailed:'No se confirmó el cierre. Vuelve a cerrar sesión.',season:'Temporada',revision:'revisión',day:'día',unstarted:'sin iniciar',preparing:'en preparación',active:'activa',closed:'finalizada',resetTitle:"Restablecer el mundo a la Temporada 0",resetSummary:"Elimina definitivamente calendarios, sorteos, resultados, estadísticas, eliminatorias, eventos administrativos e historial. Se conservan los clubes, las reglas y el acceso de administrador.",resetPrompt:"Escribe RESET SEASON 0 para confirmar",resetButton:"Eliminar todas las temporadas",resetDone:"Mundo restablecido a la Temporada 0.",resetBlocked:"El restablecimiento requiere una temporada preparada, activa o finalizada.",operationLabel:"Operación actual",operationIdle:"Listo para una operación administrativa.",operationPrerequisite:"Preparar requiere Temporada 0; restablecer requiere una temporada existente.",operationStale:"El mundo cambió. Actualiza antes de reintentar.",operationBlocked:"Falta aprobación o evidencia deportiva necesaria. Revisa los requisitos.",operationSuccess:"Operación completada. Generación y revisión son oficiales.",generationLabel:"Generación",cmdinitialize:"Inicializar eventos",cmdconfirm:"Confirmar participantes",cmddomestic:"Generar calendario nacional",cmddraw:"Sortear copas internacionales",cmdpublish:"Publicar calendario internacional",cmdstart:"Iniciar temporada",cmdadvance:"Avanzar día",cmdarchive:"Archivar temporada",endSeasonFlow:"Archivo → Cierre → Preparar la próxima temporada",cmdclose:"Cerrar temporada",cmdlegacy:"Generar calendario de temporada",cmdeventStart:"Iniciar calendario de eventos",cmdeventAdvance:"Avanzar calendario de eventos",reschedule0:"Reprogramar evento futuro",reschedule1:"Hito programado",reschedule2:"Día (1–56)",reschedule3:"Orden (0–9999)",reschedule4:"Guardar posición del evento",closureDays:"Jornadas deportivas guardadas",closureTies:"Eliminatorias guardadas",closureReady:"Requisitos para cerrar satisfechos",closurePending:"Cierre todavía no disponible",nextHeading:"Temporada 2 — revisión de clasificación",nextReviewRequired:"Propuesta provisional pendiente de aprobación",nextCompetitions:"Competiciones",nextReviewUnavailable:"Revisión no disponible; activación prohibida",nextHolderBlocked:"Asignación del campeón pendiente",nextHolderAligned:"Asignación del campeón coherente",nextProposal:"Solo propuesta — requiere aprobación",nextSnapshotHash:"Hash de la instantánea",cmdnextPrepare:"Preparar Temporada 2",nextApproved:"Participantes de la temporada 2 aprobados"},
 fr:{title:'Administration du monde',approvalPrompt:"Saisissez APPROVE SEASON 2 pour confirmer la liste exacte des participants",approvalButton:"Approuver les participants de la saison 2",forbidden:"Votre compte n’a pas l’autorisation d’administrer ce monde.",intro:'Les pages publiques restent accessibles à tous. L’accès Admin dépend des autorisations de votre compte.',email:'Adresse e-mail',password:'Mot de passe',signIn:'Se connecter',signOut:'Se déconnecter',accountSignIn:"Connectez-vous avec votre compte Football Architect",prepare:'Préparer la saison',refresh:'Actualiser',checking:'Vérification de l’accès…',signedOut:'Déconnecté.',signedIn:'Connecté.',unavailable:'Administration indisponible. Réessayez plus tard.',invalid:'Échec de connexion. Vérifiez vos identifiants.',throttled:'Trop de tentatives. Réessayez dans 15 minutes.',prerequisite:'Préparation bloquée jusqu’à l’approbation du catalogue des participants et des règles.',stale:'Le monde a changé. Actualisez avant de réessayer.',prepared:'Saison préparée, pas encore commencée.',working:'Opération en cours…',logoutFailed:'Déconnexion non confirmée. Réessayez de vous déconnecter.',season:'Saison',revision:'révision',day:'jour',unstarted:'non commencée',preparing:'en préparation',active:'active',closed:'terminée',resetTitle:"Réinitialiser le monde à la saison 0",resetSummary:"Supprime définitivement calendriers, tirages, résultats, statistiques, phases finales, événements administratifs et historique. Les clubs, règles et accès administrateur sont conservés.",resetPrompt:"Saisissez RESET SEASON 0 pour confirmer",resetButton:"Supprimer toutes les saisons",resetDone:"Monde réinitialisé à la saison 0.",resetBlocked:"La réinitialisation nécessite une saison préparée, active ou terminée.",operationLabel:"Opération en cours",operationIdle:"Prêt pour une opération administrative.",operationPrerequisite:"Préparer nécessite la saison 0; réinitialiser nécessite une saison existante.",operationStale:"Le monde a changé. Actualisez avant de recommencer.",operationBlocked:"Une approbation ou preuve sportive requise manque. Vérifiez les prérequis.",operationSuccess:"Opération terminée. Génération et révision font autorité.",generationLabel:"Génération",cmdinitialize:"Initialiser les événements",cmdconfirm:"Confirmer les participants",cmddomestic:"Générer le calendrier national",cmddraw:"Tirer les coupes internationales",cmdpublish:"Publier le calendrier international",cmdstart:"Démarrer la saison",cmdadvance:"Avancer d’un jour",cmdarchive:"Archiver la saison",endSeasonFlow:"Archivage → Clôture → Préparer la saison suivante",cmdclose:"Clôturer la saison",cmdlegacy:"Générer le calendrier de saison",cmdeventStart:"Démarrer le calendrier événementiel",cmdeventAdvance:"Avancer le calendrier événementiel",reschedule0:"Déplacer un événement futur",reschedule1:"Jalon programmé",reschedule2:"Jour (1–56)",reschedule3:"Ordre (0–9999)",reschedule4:"Enregistrer le déplacement",closureDays:"Journées sportives enregistrées",closureTies:"Duels éliminatoires enregistrés",closureReady:"Conditions de clôture réunies",closurePending:"Clôture indisponible pour le moment",nextHeading:"Saison 2 — examen des qualifications",nextReviewRequired:"Proposition provisoire soumise à approbation",nextCompetitions:"Compétitions",nextReviewUnavailable:"Examen indisponible ; activation interdite",nextHolderBlocked:"Affectation du tenant du titre à décider",nextHolderAligned:"Affectation du tenant du titre conforme",nextProposal:"Proposition uniquement — approbation requise",nextSnapshotHash:"Empreinte du snapshot",cmdnextPrepare:"Préparer la saison 2",nextApproved:"Participants de la saison 2 approuvés"}
 };
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 const validWorld=w=>w?.schemaVersion===1&&uuid.test(w.generation)&&Number.isSafeInteger(w.revision)&&w.revision>=0&&Number.isSafeInteger(w.seasonNumber)&&w.seasonNumber>=0&&Number.isInteger(w.day)&&w.day>=0&&w.day<=56&&['unstarted','preparing','active','closed'].includes(w.phase);
 function canRunCommand(action,w,ev,proposal=null){
  if(!w||!ev||ev.worldGeneration!==w.generation||ev.worldRevision!==w.revision)return false;
  const rows=ev.rows||[],mode=ev.mode;
  const event=id=>rows.find(e=>e.id===id);
  const first=rows.filter(e=>e.status==='scheduled').sort((a,b)=>a.day-b.day||a.order-b.order)[0];
  const next=first?.day===w.day?first:null;
  const kinds={confirm:'confirm-',domestic:'generate-domestic-calendar',draw:'draw-international',publish:'generate-international-calendar'};
  const eventKind=kinds[action],availableEvent=!!next&&(action==='confirm'?next.kind?.startsWith('confirm-'):next.kind===eventKind);
  if(action==='archive')return w.phase==='active'&&w.day===56&&event('season:archive')?.status==='scheduled'&&ev.closure?.days===56&&ev.closure?.ties===54;
  if(action==='close')return w.phase==='active'&&w.day===56&&event('season:archive')?.status==='completed'&&event('season:close')?.status==='scheduled';
  if(action==='nextPrepare'&&!(event('season:close')?.status==='completed'&&event('season:next-prepare')?.status==='scheduled'))return false;
  if(action==='nextPrepare')return w.seasonNumber===1&&w.phase==='closed'&&w.day===56&&ev.closure?.archived===true&&ev.closure.days===56&&ev.closure.ties===54&&proposal?.worldGeneration===w.generation&&proposal.worldRevision===w.revision&&/^[a-f0-9]{64}$/.test(proposal.snapshot?.snapshotHash||'')&&proposal.approval?.snapshotHash===proposal.snapshot.snapshotHash&&proposal.activation?.ready===true&&proposal.activation.targetSeason===2;
  if(![1,2].includes(w.seasonNumber))return false;
  if(action==='initialize')return [1,2].includes(w.seasonNumber)&&w.phase==='preparing'&&mode==='legacy'&&!ev.calendarReady;
  if(action==='legacy')return w.phase==='preparing'&&mode==='legacy'&&!ev.calendarReady;
  if(action==='eventStart')return w.phase==='preparing'&&mode==='administrative';
  if(action==='start')return w.phase==='preparing'&&mode==='legacy'&&ev.calendarReady===true;
  if(action==='eventAdvance')return w.phase==='active'&&w.day<=12&&mode==='administrative'&&!ev.blocked;
  if(action==='advance')return w.phase==='active'&&(mode==='legacy'||mode==='sporting')&&w.day<56;
  return !!eventKind&&w.phase==='active'&&mode==='administrative'&&availableEvent;
 }
 function createAdminController(request,changed){
  let epoch=0,csrf='',retryKey='',retryFor='';
  let value={actor:null,permissions:[],world:null,message:'checking',busy:false,logoutNeeded:false,operation:'idle',errorCode:null,events:null,seasonTwo:null};
  const state=()=>structuredClone(value),emit=()=>changed(state());
  const clear=message=>{csrf='';value={actor:null,permissions:[],world:null,message,busy:false,logoutNeeded:false,operation:'idle',errorCode:null,events:null,seasonTwo:null};emit()};
  function failure(error){
   if(error.status===401){clear('signedOut');return}
   value.errorCode=typeof error.code==='string'?error.code:null;
   value.operation='blocked';
   value.message=error.status===422&&error.code==='catalogue_not_approved'?'prerequisite':error.status===409?'stale':error.status===429?'throttled':error.status===401?'invalid':'unavailable';
   value.busy=false;emit();
  }
  function acceptSession(data){
   if(!data?.actor||typeof data.actor.id!=='string'||typeof data.actor.email!=='string'||!/^[a-f0-9]{64}$/.test(data.csrfToken))throw Error('invalid response');
   value.actor={id:data.actor.id,email:data.actor.email};csrf=data.csrfToken;
  }
  async function worldRead(ticket,rechecked=false){
   const data=await request('/api/admin/world');if(ticket!==epoch)return;
   if(!validWorld(data?.world))throw Error('invalid response');
   if(value.world&&value.world.generation!==data.world.generation&&!rechecked){
    value.world=null;retryKey='';retryFor='';
    const session=await request('/api/admin/session');if(ticket!==epoch)return;acceptSession(session);
    return worldRead(ticket,true);
   }
   if(!value.world||value.world.generation!==data.world.generation||data.world.revision>=value.world.revision)value.world=data.world;
   value.message='signedIn';
   value.seasonTwo=null;
   // An unavailable events read must fail closed for event actions, not erase the world read.
   try{
    const events=await request('/api/admin/seasons/events');if(ticket!==epoch)return;
    value.events=validWorld(events?.world)&&events.world.generation===value.world.generation&&events.world.revision===value.world.revision&&['uninitialized','legacy','administrative','sporting'].includes(events.mode)&&Array.isArray(events.events)?{mode:events.mode,rows:events.events,worldGeneration:events.world.generation,worldRevision:events.world.revision,nextEvent:events.nextEvent??null,remaining:events.remaining??null,blocked:events.blocked===true,closure:events.closure??null,calendarReady:events.calendarReady===true}:null;
   }catch(error){if(ticket!==epoch)return;if(error?.status===401)throw error;value.events=null;}
   if(value.world?.seasonNumber===1&&value.world.phase==='closed'){
    try{
     const proposal=await request('/api/admin/seasons/next-candidate');if(ticket!==epoch)return;
     if(proposal?.world?.generation===value.world.generation&&proposal.world.revision===value.world.revision&&proposal.candidate?.status==='provisional-results-derived'&&proposal.review?.status==='requires-owner-approval'&&proposal.review.readyForActivation===false&&Array.isArray(proposal.review.blockingReasons)&&Array.isArray(proposal.holderReview)&&Array.isArray(proposal.candidate.bindings)){
      value.seasonTwo={worldGeneration:proposal.world.generation,worldRevision:proposal.world.revision,activation:proposal.activation??null,review:proposal.review,holders:proposal.holderReview,bindings:proposal.candidate.bindings,holderProposal:proposal.holderProposal?.readyForActivation===false?proposal.holderProposal:null,snapshot:proposal.snapshot?.status==='awaiting-season-snapshot-approval'&&proposal.snapshot?.readyForActivation===false?proposal.snapshot:null,approval:proposal.approval??null};
     }
    }catch(error){if(ticket!==epoch)return;if(error?.status===401)throw error;value.seasonTwo=null;}
   }
  }
  return {state,
   async refresh(){
    const ticket=++epoch;value.busy=true;emit();
    try{const session=await request('/api/admin/session');if(ticket!==epoch)return;acceptSession(session);const permissions=await request('/api/player/permissions');if(ticket!==epoch)return;value.permissions=Array.isArray(permissions.permissions)?permissions.permissions:[];if(!value.permissions.includes('admin.access')||!value.permissions.includes('admin.world.read'))throw Object.assign(Error('forbidden'),{status:403});await worldRead(ticket)}
    catch(error){if(ticket===epoch){clear(error.status===401?'signedOut':error.status===403?'forbidden':'unavailable');return}}
    finally{if(ticket===epoch){value.busy=false;emit()}}
   },
   async approveSeasonTwo(hash){
    const world=value.world,review=value.seasonTwo;
    if(value.busy||!value.actor||!world||world.phase!=='closed'||world.seasonNumber!==1||
       !review?.snapshot||review.approval||hash!==review.snapshot.snapshotHash)return;
    const ticket=++epoch;value.busy=true;value.errorCode=null;value.operation='approveSeasonTwo';emit();
    try{
     const result=await request('/api/admin/seasons/next-approve',{body:{expectedGeneration:world.generation,expectedRevision:world.revision,snapshotHash:hash},headers:{'X-CSRF-Token':csrf,'Idempotency-Key':globalThis.crypto.randomUUID()}});
     if(ticket!==epoch)return;
     if(!validWorld(result?.world)||result.world.generation!==world.generation||result.world.revision!==world.revision+1)throw Error('invalid response');
     value.world=result.world;await worldRead(ticket);if(ticket!==epoch)return;
     value.message='signedIn';value.operation='completed';
    }catch(error){if(ticket===epoch)failure(error)}
    finally{if(ticket===epoch){value.busy=false;emit()}}
   },
   async reschedule(eventId,day,order){
    const old=value.world,events=value.events;
    if(value.busy||!value.actor||!old||!events||events.mode!=='administrative'||
      events.worldGeneration!==old.generation||events.worldRevision!==old.revision||
      !Number.isSafeInteger(day)||day<=old.day||day>12||
      !Number.isSafeInteger(order)||order<0||order>9999||
      !events.rows.some(e=>e.id===eventId&&e.status==='scheduled'&&e.day>old.day))return;
    const ticket=++epoch;value.busy=true;value.operation='reschedule';value.errorCode=null;emit();
    try{
     const body={expectedGeneration:old.generation,expectedRevision:old.revision,eventId,day,order};
     const result=await request('/api/admin/seasons/events/reschedule',{body,headers:{'X-CSRF-Token':csrf,'Idempotency-Key':globalThis.crypto.randomUUID()}});
     if(ticket!==epoch)return;
     if(!validWorld(result?.world)||result.world.generation!==old.generation||result.world.revision!==old.revision+1)throw Error('invalid response');
     value.world=result.world;value.events=null;
     await worldRead(ticket);if(ticket!==epoch)return;
     value.message='signedIn';value.operation='completed';
    }catch(error){if(ticket===epoch)failure(error)}
    finally{if(ticket===epoch){value.busy=false;emit()}}
   },
   async command(action){
    const routes={archive:'/api/admin/seasons/archive',nextPrepare:'/api/admin/seasons/next-prepare',initialize:'/api/admin/seasons/events/initialize',confirm:'/api/admin/seasons/events/confirm',domestic:'/api/admin/seasons/events/domestic-calendar',draw:'/api/admin/seasons/events/international-draw',publish:'/api/admin/seasons/events/international-calendar',start:'/api/admin/seasons/start',advance:'/api/admin/seasons/advance',close:'/api/admin/seasons/close',legacy:'/api/admin/seasons/calendar',eventStart:'/api/admin/seasons/events/start',eventAdvance:'/api/admin/seasons/events/advance'};
    if(!Object.hasOwn(routes,action)||value.busy||!value.actor||!value.world||value.world.phase==='unstarted'||!canRunCommand(action,value.world,value.events,value.seasonTwo))return;
    const ticket=++epoch,old=value.world;
    value.busy=true;value.operation=action;value.errorCode=null;emit();
    try{
     let body={expectedGeneration:old.generation,expectedRevision:old.revision};
     if(action==='confirm'){
      const data=await request('/api/admin/seasons/events');if(ticket!==epoch)return;
      if(data?.world?.generation!==old.generation||data.world.revision!==old.revision)throw Object.assign(Error('stale'),{status:409,code:'stale_world'});
      const due=data.events?.filter(e=>e.status==='scheduled').sort((a,b)=>a.day-b.day||a.order-b.order)[0];
      if(!due||due.day!==old.day||!due.kind?.startsWith('confirm-'))throw Object.assign(Error('blocked'),{status:409,code:'calendar_event_prerequisites'});
      body={...body,eventId:due.id};
     }
     const data=await request(routes[action],{body,headers:{'X-CSRF-Token':csrf,'Idempotency-Key':globalThis.crypto.randomUUID()}});
     if(ticket!==epoch)return;
     if(!validWorld(data?.world)||data.world.generation!==old.generation||data.world.revision!==old.revision+1||action==='nextPrepare'&&(data.world.seasonNumber!==2||data.world.day!==0||data.world.phase!=='preparing'))throw Error('invalid response');
     value.world=data.world;value.events=null;retryKey='';retryFor='';
     await worldRead(ticket);if(ticket!==epoch)return;
     value.message='signedIn';value.operation='completed';
    }catch(error){if(ticket===epoch)failure(error)}
    finally{if(ticket===epoch){value.busy=false;emit()}}
   },
   async reset(confirmation){
    if(value.busy||!value.actor||!value.world||value.world.phase==='unstarted'||confirmation!=='RESET SEASON 0')return;
    const ticket=++epoch,old=value.world;
    value.busy=true;value.operation='reset';value.errorCode=null;emit();
    try{
     const data=await request('/api/admin/world/reset',{body:{expectedGeneration:old.generation,expectedRevision:old.revision,confirmation},headers:{'X-CSRF-Token':csrf,'Idempotency-Key':globalThis.crypto.randomUUID()}});
     if(ticket!==epoch)return;
     if(!validWorld(data?.world)||data.world.phase!=='unstarted'||data.world.seasonNumber!==0||data.world.day!==0||data.world.revision!==0||data.world.generation===old.generation)throw Error('invalid response');
     value.world=data.world;value.events=null;value.message='resetDone';value.operation='completed';retryKey='';retryFor='';
    }catch(error){if(ticket===epoch)failure(error)}
    finally{if(ticket===epoch){value.busy=false;emit()}}
   },
   async prepare(){
    if(value.busy||!value.actor||!value.world||value.world.phase!=='unstarted')return;
    const ticket=++epoch;const target=value.world.generation+':'+value.world.revision;
    if(retryFor!==target){retryFor=target;retryKey=globalThis.crypto.randomUUID()}
    value.busy=true;value.operation='prepare';value.errorCode=null;emit();
    try{
     const data=await request('/api/admin/seasons/prepare',{body:{expectedGeneration:value.world.generation,expectedRevision:value.world.revision},headers:{'X-CSRF-Token':csrf,'Idempotency-Key':retryKey}});
     if(ticket!==epoch)return;if(!validWorld(data?.world)||data.world.generation!==value.world.generation||data.world.revision<value.world.revision)throw Error('invalid response');
     value.world=data.world;value.events=null;value.message='prepared';value.operation='completed';retryKey='';retryFor='';
    }catch(error){if(ticket===epoch)failure(error)}
    finally{if(ticket===epoch){value.busy=false;emit()}}
   }
  };
 }
 async function browserRequest(path,options={}){
  const response=await fetch(path,{method:options.body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{...(options.body===undefined?{}:{'Content-Type':'application/json'}),...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
  let data;try{data=await response.json()}catch{throw Error('unavailable')}
  if(!response.ok)throw Object.assign(Error('request failed'),{status:response.status,code:data?.error?.code});return data;
 }
 function mount(doc){
  const host=doc.querySelector('[data-admin-settings]');if(!host)return;
  const find=s=>host.querySelector(s);
  const controller=createAdminController(browserRequest,render);
  function render(state=controller.state()){
   const text=copies[doc.documentElement.lang]||copies.en;
   host.querySelectorAll('[data-admin-copy]').forEach(node=>node.textContent=text[node.dataset.adminCopy]);
   find('[data-admin-status]').textContent=text[state.busy?'working':state.message]||text.unavailable;
   find('[data-admin-signin-link]').hidden=!!state.actor;
   find('[data-admin-no-permission]').hidden=state.message!=='forbidden';
   find('[data-admin-no-permission]').textContent=text.forbidden;
   find('[data-admin-signed-in]').hidden=!state.actor;
   host.setAttribute('aria-busy',String(state.busy));
   const canWrite=state.permissions.includes('admin.access')&&state.permissions.includes('admin.world.write');
   find('[data-admin-prepare]').disabled=!canWrite||state.busy||state.world?.phase!=='unstarted';find('[data-admin-refresh]').disabled=state.busy;
   for(const button of host.querySelectorAll('[data-admin-command]')){
    const action=button.dataset.adminCommand,w=state.world;
    button.disabled=!canWrite||state.busy||!state.actor||!canRunCommand(action,w,state.events,state.seasonTwo);
   }
   const selector=find('[data-admin-event-select]'),dayInput=find('[data-admin-event-day]'),orderInput=find('[data-admin-event-order]'),save=find('[data-admin-event-reschedule]');
   const events=['administrative','sporting'].includes(state.events?.mode)&&state.events.worldGeneration===state.world?.generation&&state.events.worldRevision===state.world?.revision?state.events.rows:[];
   const movable=events.filter(e=>e.status==='scheduled'&&(e.id.startsWith('season:')&&e.day===56&&state.world.day<=56&&state.world.phase!=='closed'||e.day>state.world.day&&e.day<=12));
   const selected=selector.value;
   selector.replaceChildren();
   for(const e of movable){const option=doc.createElement('option');option.value=e.id;option.textContent=e.id+' · '+text.day+' '+e.day+' · '+e.order;selector.append(option)}
   if(movable.some(e=>e.id===selected))selector.value=selected;
   const picked=movable.find(e=>e.id===selector.value);
   if(picked&&(selected!==picked.id||dayInput.value===''||orderInput.value==='')){dayInput.value=String(picked.day);orderInput.value=String(picked.order)}
   dayInput.max=picked?.id.startsWith('season:')?'56':'12';dayInput.min=picked?.id.startsWith('season:')?'56':'1';
   const valid=!!picked&&Number.isSafeInteger(dayInput.valueAsNumber)&&(picked.id.startsWith('season:')?dayInput.valueAsNumber===56:dayInput.valueAsNumber>state.world.day&&dayInput.valueAsNumber<=12)&&Number.isSafeInteger(orderInput.valueAsNumber)&&orderInput.valueAsNumber>=0&&orderInput.valueAsNumber<=9999;
   const enabled=canWrite&&!!state.actor&&!state.busy&&valid;
   find('[data-admin-reschedule-section]').hidden=!state.actor||!['administrative','sporting'].includes(state.events?.mode);
   selector.disabled=state.busy||!movable.length;dayInput.disabled=state.busy||!movable.length;orderInput.disabled=state.busy||!movable.length;save.disabled=!enabled;
   const nextEvent=state.events?.nextEvent;
   const nextSeason=find('[data-admin-next-season]'),proposal=state.seasonTwo;
   nextSeason.hidden=!state.actor||state.world?.phase!=='closed'||state.world?.seasonNumber!==1;
   const approvalButton=find('[data-admin-next-season-approve]'),approvalInput=find('[data-admin-next-season-confirm]');
   approvalInput.disabled=!proposal?.snapshot||!!proposal.approval||state.busy;
   approvalButton.disabled=!canWrite||!proposal?.snapshot||!!proposal.approval||state.busy||approvalInput.value!=='APPROVE SEASON 2';
   const summary=find('[data-admin-next-season-summary]');
   summary.textContent=proposal?(proposal.approval?text.nextApproved:text.nextReviewRequired)+' · '+proposal.bindings.length+' '+text.nextCompetitions+' · '+(proposal.snapshot?text.nextSnapshotHash+' '+proposal.snapshot.snapshotHash+' · ':'')+(proposal.approval?(proposal.activation?.blockingReasons||[]):proposal.review.blockingReasons).join(', '):text.nextReviewUnavailable;
   const holders=find('[data-admin-next-season-holders]');holders.replaceChildren();
   if(proposal)for(const item of proposal.holders){const li=doc.createElement('li');li.textContent=item.competitionId+' · '+item.championClubId+' · '+(item.requiresQualificationPolicyDecision?text.nextHolderBlocked:text.nextHolderAligned);holders.append(li)}
   if(proposal?.holderProposal)for(const move of proposal.holderProposal.moves){if(!move.removedClubId)continue;const li=doc.createElement('li');li.textContent=text.nextProposal+' · '+move.cup+': '+move.championClubId+' / '+move.removedClubId+(move.sourceCup?' ('+move.sourceCup+')':'');holders.append(li)}
   const closure=state.events?.closure;
   find('[data-admin-closure]').textContent=state.actor&&closure?text.closureDays+' '+closure.days+'/56 · '+text.closureTies+' '+closure.ties+'/54 · '+(closure.ready?text.closureReady:text.closurePending):'';
   find('[data-admin-next-event]').textContent=['administrative','sporting'].includes(state.events?.mode)?
    (nextEvent?nextEvent.id+' · '+text.day+' '+nextEvent.day+' · '+nextEvent.order+(nextEvent.ready?' · '+text.operationIdle:''):text.operationSuccess):'';
   const resetInput=find('[data-admin-reset-confirm]'),resetButton=find('[data-admin-reset]'),canReset=canWrite&&!!state.actor&&state.world?.phase!=='unstarted'&&!state.busy;
   find('[data-admin-reset-section]').hidden=!state.actor;
   resetInput.disabled=!canReset;
   if(state.message==='resetDone')resetInput.value='';
   resetButton.disabled=!canReset||resetInput.value!=='RESET SEASON 0';
   find('[data-admin-actor]').textContent=state.actor?.email||'';
   const explanation=state.message==='stale'?text.operationStale:state.message==='prerequisite'||state.errorCode?.includes('prerequisite')?text.operationBlocked:state.operation==='completed'?text.operationSuccess:state.world?text.operationPrerequisite:text.operationIdle;
   find('[data-admin-operation]').textContent=state.busy?text.working:explanation;
   find('[data-admin-error-code]').textContent=state.errorCode?state.errorCode:'';
   const w=state.world;find('[data-admin-world]').textContent=w?`${text.season} ${w.seasonNumber} · ${text.revision} ${w.revision} · ${text.day} ${w.day} · ${text[w.phase]} · ${text.generationLabel} ${w.generation}`:'';
  }
  find('[data-admin-next-season-confirm]').addEventListener('input',()=>render());
  find('[data-admin-next-season-approve]').addEventListener('click',async()=>{
   const input=find('[data-admin-next-season-confirm]'),proposal=controller.state().seasonTwo;
   if(input.value!=='APPROVE SEASON 2'||!proposal?.snapshot||proposal.approval)return;
   input.value='';await controller.approveSeasonTwo(proposal.snapshot.snapshotHash);render();
  });
  find('[data-admin-refresh]').addEventListener('click',()=>controller.refresh());
  find('[data-admin-prepare]').addEventListener('click',()=>controller.prepare());
  host.querySelectorAll('[data-admin-command]').forEach(button=>button.addEventListener('click',()=>controller.command(button.dataset.adminCommand)));
  find('[data-admin-event-select]').addEventListener('change',()=>{const s=controller.state(),row=s.events?.rows.find(e=>e.id===find('[data-admin-event-select]').value);if(row){find('[data-admin-event-day]').value=String(row.day);find('[data-admin-event-order]').value=String(row.order)}render()});
  find('[data-admin-event-day]').addEventListener('input',()=>render());
  find('[data-admin-event-order]').addEventListener('input',()=>render());
  find('[data-admin-event-reschedule]').addEventListener('click',()=>controller.reschedule(find('[data-admin-event-select]').value,find('[data-admin-event-day]').valueAsNumber,find('[data-admin-event-order]').valueAsNumber));
  find('[data-admin-reset-confirm]').addEventListener('input',()=>render());
  find('[data-admin-reset]').addEventListener('click',async()=>{const input=find('[data-admin-reset-confirm]');const confirmation=input.value;if(confirmation!=='RESET SEASON 0')return;await controller.reset(confirmation);input.value='';render()});
  new MutationObserver(()=>render()).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  render();void controller.refresh();
 }
 return {createAdminController,mount,canRunCommand};
});
