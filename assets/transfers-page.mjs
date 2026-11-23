import {TRANSFERS_PLAYER_PAGE_SIZE as PAGE_SIZE} from './transfers-discovery.mjs';
import {transfersDiscoveryRequest,projectTransfersDiscovery} from './transfers-discovery.mjs';

// #587: anonymous, read-only player discovery. No transfer actions or market claims.
const root=document.getElementById('app-transfers');
if(root){
 const form=document.getElementById('transfers-filters');
 const nameInput=document.getElementById('transfers-name');
 const positionInput=document.getElementById('transfers-position');
 const reset=document.getElementById('transfers-reset');
 const rows=document.getElementById('transfers-rows');
 const status=document.getElementById('transfers-status');
 const count=document.getElementById('transfers-count');
 const region=root.querySelector('[data-transfers-region]');
 const prev=document.getElementById('transfers-prev');
 const next=document.getElementById('transfers-next');
 const pageInfo=document.getElementById('transfers-page-info');
 const supportedPositions=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
 const namePattern=/^[\p{L}\p{M}0-9 .'’\-]{1,80}$/u;
 const copies={
  en:{title:'Transfers',subtitle:'Explore players in the world. Transfer deals are not available yet.',name:'Player name',namePlaceholder:'Search by name',position:'Position',allPositions:'All positions',search:'Search',reset:'Reset',results:'Players',disclaimer:'Club affiliation is verified public data, not a transfer listing or proof of availability.',player:'Player',age:'Age',nationality:'Nationality',club:'Current club',loading:'Loading players…',empty:'No players match these filters.',none:'No players available.',error:'Unable to load players. Try again.',stale:'The world changed. Search again.',previous:'Previous',next:'Next',free:'Free Agent',count:'{n} players',page:'Page {page} of {total}',pager:'Results pages',region:'Transfer discovery results'},
  it:{title:'Transfers',subtitle:'Esplora i calciatori del mondo. Le trattative non sono ancora disponibili.',name:'Nome calciatore',namePlaceholder:'Cerca per nome',position:'Posizione',allPositions:'Tutte le posizioni',search:'Cerca',reset:'Reimposta',results:'Giocatori',disclaimer:'Il club attuale è un dato pubblico verificato, non un annuncio di trasferimento né una conferma di disponibilità.',player:'Giocatore',age:'Età',nationality:'Nazionalità',club:'Club attuale',loading:'Caricamento giocatori…',empty:'Nessun giocatore corrisponde ai filtri.',none:'Nessun giocatore disponibile.',error:'Impossibile caricare i giocatori. Riprova.',stale:'Il mondo è cambiato. Ripeti la ricerca.',previous:'Precedente',next:'Successiva',free:'Svincolato',count:'{n} giocatori',page:'Pagina {page} di {total}',pager:'Pagine dei risultati',region:'Risultati ricerca Transfers'},
  de:{title:'Transfers',subtitle:'Entdecke Spieler der Welt. Transfers sind derzeit noch nicht möglich.',name:'Spielername',namePlaceholder:'Nach Namen suchen',position:'Position',allPositions:'Alle Positionen',search:'Suchen',reset:'Zurücksetzen',results:'Spieler',disclaimer:'Die Vereinszugehörigkeit ist ein verifizierter öffentlicher Datensatz, kein Transferangebot.',player:'Spieler',age:'Alter',nationality:'Nationalität',club:'Aktueller Verein',loading:'Spieler werden geladen…',empty:'Keine Spieler mit diesen Filtern.',none:'Keine Spieler verfügbar.',error:'Spieler konnten nicht geladen werden. Erneut versuchen.',stale:'Die Spielwelt hat sich geändert. Bitte erneut suchen.',previous:'Zurück',next:'Weiter',free:'Vereinslos',count:'{n} Spieler',page:'Seite {page} von {total}',pager:'Ergebnisseiten',region:'Transfers Suchergebnisse'},
  es:{title:'Transfers',subtitle:'Explora los futbolistas del mundo. Los traspasos aún no están disponibles.',name:'Nombre del jugador',namePlaceholder:'Buscar por nombre',position:'Posición',allPositions:'Todas las posiciones',search:'Buscar',reset:'Restablecer',results:'Jugadores',disclaimer:'La afiliación al club es un dato público verificado, no una oferta de traspaso ni prueba de disponibilidad.',player:'Jugador',age:'Edad',nationality:'Nacionalidad',club:'Club actual',loading:'Cargando jugadores…',empty:'No hay jugadores para estos filtros.',none:'No hay jugadores disponibles.',error:'No se pudieron cargar los jugadores. Inténtalo de nuevo.',stale:'El mundo cambió. Repite la búsqueda.',previous:'Anterior',next:'Siguiente',free:'Agente libre',count:'{n} jugadores',page:'Página {page} de {total}',pager:'Páginas de resultados',region:'Resultados de Transfers'},
  fr:{title:'Transfers',subtitle:'Explorez les joueurs du monde. Les transferts ne sont pas encore disponibles.',name:'Nom du joueur',namePlaceholder:'Rechercher un nom',position:'Poste',allPositions:'Tous les postes',search:'Rechercher',reset:'Réinitialiser',results:'Joueurs',disclaimer:'Le club actuel est une donnée publique vérifiée, pas une annonce de transfert ni une preuve de disponibilité.',player:'Joueur',age:'Âge',nationality:'Nationalité',club:'Club actuel',loading:'Chargement des joueurs…',empty:'Aucun joueur ne correspond aux filtres.',none:'Aucun joueur disponible.',error:'Impossible de charger les joueurs. Réessayez.',stale:'Le monde a changé. Relancez la recherche.',previous:'Précédent',next:'Suivant',free:'Sans club',count:'{n} joueurs',page:'Page {page} sur {total}',pager:'Pages de résultats',region:'Résultats Transfers'}
 };
 const currentLocale=()=>Object.hasOwn(copies,document.documentElement.lang)?document.documentElement.lang:'en';
 const l=()=>copies[currentLocale()];
 const initialSkeleton=rows.innerHTML;
 let state={name:'',position:'',offset:0},requestId=0,controller=null,lastPage=null,notice='loading';
 const renderText=()=>{
  const c=l();
  for(const node of root.querySelectorAll('[data-transfers-text]'))node.textContent=c[node.dataset.transfersText]||'';
  for(const node of root.querySelectorAll('[data-transfers-placeholder]'))node.placeholder=c[node.dataset.transfersPlaceholder]||'';
  region.setAttribute('aria-label',c.region);root.querySelector('[data-transfers-pager-label]').setAttribute('aria-label',c.pager);
  document.title=c.title+' — Football Architect';
  status.textContent=notice==='loading'?c.loading:notice==='error'?c.error:notice==='stale'?c.stale:notice==='empty'?lastPage?.count===0?c.none:c.empty:'';
  if(lastPage){count.textContent=c.count.replace('{n}',new Intl.NumberFormat(currentLocale()).format(lastPage.count));pageInfo.textContent=c.page.replace('{page}',lastPage.page).replace('{total}',lastPage.totalPages);}
 };
 const readLocation=()=>{
  const params=new URLSearchParams(location.search);
  const candidate=params.get('name')||'';
  const name=candidate&&candidate===candidate.trim()&&candidate===candidate.normalize('NFC')&&namePattern.test(candidate)?candidate:'';
  const candidatePosition=params.get('position')||'';
  const position=supportedPositions.has(candidatePosition)?candidatePosition:'';
  const raw=params.get('offset')||'0';
  const offset=/^(?:0|[1-9][0-9]{0,5})$/.test(raw)&&Number(raw)<=499900&&Number(raw)%PAGE_SIZE===0?Number(raw):0;
  return {name,position,offset};
 };
 const updateLocation=(method)=>{
  const p=new URLSearchParams();
  if(state.name)p.set('name',state.name);
  if(state.position)p.set('position',state.position);
  if(state.offset)p.set('offset',String(state.offset));
  const nextUrl=location.pathname+(p.size?'?'+p:'');
  if(location.pathname+location.search!==nextUrl)history[method](null,'',nextUrl);
 };
 const syncForm=()=>{nameInput.value=state.name;positionInput.value=state.position;};
 const setLoading=()=>{
  notice='loading';lastPage=null;rows.innerHTML=initialSkeleton;region.setAttribute('aria-busy','true');
  count.textContent='';pageInfo.textContent='';prev.disabled=true;next.disabled=true;renderText();
 };
 const makeCell=(value,className='')=>{const td=document.createElement('td');if(className)td.className=className;td.textContent=value;return td;};
 const drawRows=page=>{
  const frag=document.createDocumentFragment();
  for(const player of page.players){
   const tr=document.createElement('tr');
   const td=makeCell('');
   const a=document.createElement('a');a.href=player.playerHref;a.textContent=player.name;td.append(a);tr.append(td);
   tr.append(makeCell(player.position));
   tr.append(makeCell(player.age===null?'—':String(player.age)));
   tr.append(makeCell(player.nationality||'—'));
   if(player.clubHref){
    const club=makeCell('');const link=document.createElement('a');link.href=player.clubHref;link.textContent=player.clubName;club.append(link);tr.append(club);
   }else tr.append(makeCell(l().free,'fa-transfers-muted'));
   frag.append(tr);
  }
  rows.replaceChildren(frag);
 };
 const load=async()=>{
  const ticket=++requestId;
  controller?.abort();controller=new AbortController();setLoading();
  let url;
  try{url=transfersDiscoveryRequest(state);}catch{notice='error';region.setAttribute('aria-busy','false');renderText();return;}
  try{
   const response=await fetch(url,{method:'GET',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});
   if(!response.ok){if(response.status===409)throw Error('stale');throw Error('unavailable');}
   const data=projectTransfersDiscovery(await response.json(),{offset:state.offset});
   if(ticket!==requestId)return;
   if(data.count>0&&state.offset>0&&data.players.length===0){state={...state,offset:0};updateLocation('replaceState');void load();return;}
   lastPage=data;drawRows(data);region.setAttribute('aria-busy','false');
   notice=data.players.length?'ready':'empty';
   prev.disabled=state.offset===0;next.disabled=data.page>=data.totalPages||state.offset+PAGE_SIZE>499900;
   renderText();
  }catch(error){
   if(ticket!==requestId||error?.name==='AbortError')return;
   region.setAttribute('aria-busy','false');rows.replaceChildren();
   notice=error?.message==='stale'?'stale':'error';renderText();
  }
 };
 const navigate=(next,historyMethod='pushState')=>{
  state=next;syncForm();updateLocation(historyMethod);void load();
 };
 form.addEventListener('submit',event=>{
  event.preventDefault();const candidate=nameInput.value.trim().normalize('NFC');
  if(candidate&& !namePattern.test(candidate)){nameInput.setCustomValidity('Invalid player name');nameInput.reportValidity();return;}
  nameInput.setCustomValidity('');
  navigate({name:candidate,position:positionInput.value,offset:0});
 });
 nameInput.addEventListener('input',()=>nameInput.setCustomValidity(''));
 reset.addEventListener('click',()=>navigate({name:'',position:'',offset:0}));
 prev.addEventListener('click',()=>{if(!prev.disabled)navigate({...state,offset:state.offset-PAGE_SIZE});});
 next.addEventListener('click',()=>{if(!next.disabled)navigate({...state,offset:state.offset+PAGE_SIZE});});
 window.addEventListener('popstate',()=>{state=readLocation();syncForm();void load();});
 new MutationObserver(()=>{if(lastPage){drawRows(lastPage);}renderText();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 state=readLocation();syncForm();updateLocation('replaceState');void load();
}
