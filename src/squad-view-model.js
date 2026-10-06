/** UX2-04 — Read-only roster filters and indicators. No career mutations. */
export const ROSTER_AVAILABILITY = Object.freeze(['all','available','injured','tired']);
export function playerAvailability(player){
  const days=Number(player?.injury);
  if((Number.isFinite(days)&&days>0)||(!Number.isFinite(days)&&Boolean(player?.injury)))return 'injured';
  if(Number.isFinite(Number(player?.fitness)) && Number(player.fitness)<65)return 'tired';
  return 'available';
}
export function selectByAvailability(players,filter='all'){
  if(!Array.isArray(players))return [];
  const state=ROSTER_AVAILABILITY.includes(filter)?filter:'all';
  return state==='all'?[...players]:players.filter(p=>playerAvailability(p)===state);
}
export function rosterIndicators(players){
  const squad=Array.isArray(players)?players:[];
  return Object.freeze({total:squad.length,available:squad.filter(p=>playerAvailability(p)==='available').length,
    injured:squad.filter(p=>playerAvailability(p)==='injured').length,
    tired:squad.filter(p=>playerAvailability(p)==='tired').length,
    expiring:squad.filter(p=>p.contract!=null&&String(p.contract).trim()!==''&&Number.isFinite(Number(p.contract))&&Number(p.contract)<=1).length});
}
export const rosterStrings=Object.freeze({
  it:{title:'Rosa prima squadra',eyebrow:'IL GRUPPO',subtitle:'Calciatori sotto contratto',manage:'Gestisci formazione',
    list:'Elenco calciatori',listHint:'Apri un calciatore per consultare la scheda completa.',
    all:'Tutti',available:'Disponibili',injured:'Infortunati',tired:'Da recuperare',availability:'Disponibilità',
    count:'Visualizzati',of:'su',reset:'Azzera filtri',players:'Calciatori',avg:'OVR medio',age:'Età media',wages:'Ingaggi settimanali',
    moraleHigh:'Alta',moraleMedium:'Media',moraleLow:'Bassa',fitness:'Fitness',morale:'Morale',games:'PG',goals:'Gol',value:'Valore',position:'Ruolo',name:'Calciatore',
    noResults:'Nessun calciatore corrisponde ai filtri.',injuryLabel:'Infortunato',contractAlert:'Contratti in scadenza',
    profile:'Scheda calciatore',overview:'Panoramica',attributes:'Attributi e confronto',condition:'Condizione e contratto',
    recovery:'Recupero in corso',fit:'Disponibile',days:'giorni di stop',comparison:'Confronta con un compagno'},
  en:{title:'First team squad',eyebrow:'FIRST TEAM',subtitle:'Players under contract',manage:'Manage formation',
    list:'Squad players',listHint:'Open a player to view the full profile.',all:'All',available:'Available',injured:'Injured',tired:'Needs recovery',availability:'Availability',
    count:'Showing',of:'of',reset:'Clear filters',players:'Players',avg:'Average OVR',age:'Average age',wages:'Weekly wages',
    moraleHigh:'High',moraleMedium:'Medium',moraleLow:'Low',fitness:'Fitness',morale:'Morale',games:'Apps',goals:'Goals',value:'Value',position:'Position',name:'Player',
    noResults:'No players match the filters.',injuryLabel:'Injured',contractAlert:'Expiring contracts',
    profile:'Player profile',overview:'Overview',attributes:'Attributes and comparison',condition:'Fitness and contract',
    recovery:'Recovering',fit:'Available',days:'days out',comparison:'Compare with a teammate'}
});
export function rosterText(language){return rosterStrings[String(language).startsWith('en')?'en':'it'];}
