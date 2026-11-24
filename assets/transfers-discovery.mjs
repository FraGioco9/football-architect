/**
 * Transfers discovery V0 (#587).
 *
 * Read-only adapter over the existing allowlisted /api/players endpoint.
 * Not a listing, negotiability, transfer eligibility, contract, concession or
 * agent-mandate authority. Economy design remains DRAFT/HOLD in #755.
 */
export const TRANSFERS_DISCOVERY_PHASE = 'discovery-only';
export const TRANSFERS_PLAYER_PAGE_SIZE = 50;

const POSITION_CODES = new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const CLUB_KEY = /^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
const PLAYER_NAME = /^[\p{L}\p{M}0-9 .'’\-]{1,80}$/u;

function validOffset(offset) {
  return Number.isSafeInteger(offset) && offset >= 0 && offset <= 499900 && offset % TRANSFERS_PLAYER_PAGE_SIZE === 0;
}

/** Build a validated request that the existing public query contract accepts. */
export function transfersDiscoveryRequest({offset = 0, name = '', position = '', valueMin = '', valueMax = '', sort = '', order = ''} = {}) {
  if (!validOffset(offset)) throw new TypeError('invalid_transfers_offset');
  if (typeof name !== 'string' || (name !== '' &&
      (name !== name.normalize('NFC') || name !== name.trim() || !PLAYER_NAME.test(name))))
    throw new TypeError('invalid_transfers_name');
  if (typeof position !== 'string' || (position !== '' && !POSITION_CODES.has(position)))
    throw new TypeError('invalid_transfers_position');
  const validBound=value=>value===''||typeof value==='string'&&/^(?:0|[1-9][0-9]{0,15})$/.test(value)&&Number.isSafeInteger(Number(value));
  if(!validBound(valueMin)||!validBound(valueMax)||(valueMin!==''&&valueMax!==''&&Number(valueMin)>Number(valueMax)))throw new TypeError('invalid_transfers_value_range');
  if(sort!==''&&sort!=='market_value_arc'||sort==='market_value_arc'&&!['asc','desc'].includes(order)||sort===''&&order!=='')throw new TypeError('invalid_transfers_sort');
  const query = new URLSearchParams({offset: String(offset)});
  if (name) query.set('name', name);
  if (position) query.set('position', position);
  if(valueMin!=='')query.set('valueMin',valueMin);
  if(valueMax!=='')query.set('valueMax',valueMax);
  if(sort){query.set('sort',sort);query.set('order',order);}
  return '/api/players?' + query.toString();
}

export function transfersPlayerLinks(id, clubKey = null) {
  if (!Number.isSafeInteger(id) || id < 1) throw new TypeError('invalid_transfers_player');
  if (clubKey !== null && (typeof clubKey !== 'string' || !CLUB_KEY.test(clubKey)))
    throw new TypeError('invalid_transfers_club');
  const match = clubKey === null ? null : CLUB_KEY.exec(clubKey);
  return Object.freeze({
    player: '/players/' + id,
    club: match ? '/clubs/' + match[1].toLowerCase() + '/' + match[2] + '/roster' : null
  });
}

/**
 * Project only already-public fields. A missing affiliation means "Free Agent"
 * in the current V1 relation, NOT proof that an agent mandate or transfer is
 * on sale. Only the derived public market_value_arc estimate is allowed; no
 * salaries, transfer prices, balances or marketplace actions.
 */
export function projectTransfersDiscovery(response, {offset = 0} = {}) {
  if (!validOffset(offset) || !response || !Array.isArray(response.players) ||
      !Number.isSafeInteger(response.count) || response.count < 0 ||
      !Number.isSafeInteger(response.page) || response.page !== offset / TRANSFERS_PLAYER_PAGE_SIZE + 1 ||
      response.pageSize !== TRANSFERS_PLAYER_PAGE_SIZE ||
      !Number.isSafeInteger(response.totalPages) || response.totalPages < 1 ||
      response.totalPages !== Math.max(1, Math.ceil(response.count / TRANSFERS_PLAYER_PAGE_SIZE)) ||
      response.players.length > TRANSFERS_PLAYER_PAGE_SIZE)
    throw new TypeError('invalid_transfers_response');
  const seen = new Set();
  const players = response.players.map(player => {
    if (!player || !Number.isSafeInteger(player.id) || player.id < 1 || seen.has(player.id) ||
        typeof player.display_name !== 'string' || !player.display_name.trim() ||
        typeof player.primary_position !== 'string' || !POSITION_CODES.has(player.primary_position) ||
        (player.clubKey !== null && (typeof player.clubKey !== 'string' || !CLUB_KEY.test(player.clubKey))) ||
        (player.clubKey !== null && (typeof player.clubName !== 'string' || !player.clubName.trim())) ||
        (player.clubKey === null && player.clubName !== null))
      throw new TypeError('invalid_transfers_player_record');
    seen.add(player.id);
    const links = transfersPlayerLinks(player.id, player.clubKey);
    return Object.freeze({
      id: player.id,
      name: player.display_name,
      position: player.primary_position,
      nationality: typeof player.nationality === 'string' ? player.nationality : null,
      age: Number.isSafeInteger(player.age) && player.age >= 0 && player.age <= 120 ? player.age : null,
      market_value_arc: Number.isSafeInteger(player.market_value_arc)&&player.market_value_arc>=0?player.market_value_arc:null,
      clubKey: player.clubKey,
      clubName: player.clubName,
      affiliation: player.clubKey === null ? 'free-agent' : 'affiliated',
      transferAvailability: 'not-published',
      playerHref: links.player,
      clubHref: links.club
    });
  });
  return Object.freeze({
    phase: TRANSFERS_DISCOVERY_PHASE,
    count: response.count,
    offset,
    page: response.page,
    totalPages: response.totalPages,
    players: Object.freeze(players)
  });
}
