/** UX2-05: read-only presentation helpers; never mutate career or reveal private scouting. */
export const MARKET_VIEWS = Object.freeze(['explore','shortlist','negotiations','history']);
export const MARKET_TERMINAL = Object.freeze(['completed','rejected','expired','cancelled','failed']);
const STATUS = Object.freeze({
  awaiting_seller:['In attesa del club','Waiting for club'],
  awaiting_buyer:['Controproposta ricevuta','Counteroffer received'],
  club_agreed:['Accordo tra società','Club agreement'],
  awaiting_player:['In attesa del giocatore','Waiting for player'],
  player_counter:['Controproposta giocatore','Player counteroffer'],
  ready:['Pronto alla firma','Ready to finalize'],
  booked:['Registrazione programmata','Registration scheduled'],
  completed:['Completata','Completed'],
  rejected:['Rifiutata','Rejected'],
  expired:['Scaduta','Expired'],
  cancelled:['Annullata','Cancelled'],
  failed:['Non riuscita','Failed'],
});
export function marketStatus(status,lang='it') {
  return STATUS[status]?.[lang==='en'?1:0] ?? String(status||'—').replaceAll('_',' ');
}
export function marketStatusGroup(deal) {
  return MARKET_TERMINAL.includes(deal?.status)?'history':'negotiations';
}
export function marketBuckets(deals) {
  const list=Object.values(deals??{});
  // Preserve chronological insertion order without touching the source deals map.
  return {
    negotiations:list.filter(d=>marketStatusGroup(d)==='negotiations').reverse(),
    history:list.filter(d=>marketStatusGroup(d)==='history').reverse(),
  };
}
export function marketCostPreview({fee=0,bonus=0,installment=0,salary=0,years=1}={}) {
  const positive=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
  const term=Math.min(10,Math.max(1,Math.trunc(positive(years))||1));
  const immediate=positive(fee)+positive(bonus);
  // The future instalment and annual wage are informative separate commitments;
  // this does NOT calculate bank reservation or override authoritative domain rules.
  return {immediate,installment:positive(installment),annualWage:positive(salary),term,totalWages:positive(salary)*term};
}
export function marketCountryName(code,lang='it'){
  const names={IT:['Italia','Italy'],ENG:['Inghilterra','England'],ES:['Spagna','Spain'],DE:['Germania','Germany'],FR:['Francia','France'],NL:['Paesi Bassi','Netherlands'],PT:['Portogallo','Portugal'],BR:['Brasile','Brazil']};
  return names[code]?.[lang==='en'?1:0]??code;
}
