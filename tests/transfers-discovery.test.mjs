import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSFERS_DISCOVERY_PHASE,
  transfersDiscoveryRequest,
  transfersPlayerLinks,
  projectTransfersDiscovery
} from '../assets/transfers-discovery.mjs';

const player = (changes = {}) => ({
  id: 188, display_name: 'Marco Rossi', primary_position: 'CM',
  nationality: 'ITA', age: 23, clubKey: 'IT-3', clubName: 'Subalpina Torino',
  ...changes
});
const response = (players, changes = {}) => ({
  count: players.length, page: 1, pageSize: 50, totalPages: 1, players, ...changes
});

test('transfers discovery reuses the existing read-only public players query', () => {
  assert.equal(transfersDiscoveryRequest(), '/api/players?offset=0');
  assert.equal(
    transfersDiscoveryRequest({offset: 50, name: 'Marco Rossi', position: 'CM'}),
    '/api/players?offset=50&name=Marco+Rossi&position=CM'
  );
  assert.equal(transfersDiscoveryRequest({name: 'D’Angelo'}), '/api/players?offset=0&name=D%E2%80%99Angelo');
  for (const offset of [-50, 1, 499950, NaN, Infinity, '50'])
    assert.throws(() => transfersDiscoveryRequest({offset}), TypeError);
  for (const name of [' Mario', 'A'.repeat(81), 'x&clubKey=IT-1', 'a\nb', 'e\u0301'])
    assert.throws(() => transfersDiscoveryRequest({name}), TypeError);
  for (const position of ['CF', 'cm', 'CM,ST', 'CM&sort=age'])
    assert.throws(() => transfersDiscoveryRequest({position}), TypeError);
});

test('only canonical player and roster links are projected', () => {
  assert.deepEqual(transfersPlayerLinks(188, 'IT-3'), {
    player: '/players/188', club: '/clubs/it/3/roster'
  });
  assert.deepEqual(transfersPlayerLinks(3, null), {player: '/players/3', club: null});
  assert.throws(() => transfersPlayerLinks(0), TypeError);
  assert.throws(() => transfersPlayerLinks(3, 'IT-99'), TypeError);
  assert.throws(() => transfersPlayerLinks(3, 'IT-3/../../admin'), TypeError);
});

test('transfers projection labels current affiliations without claiming listing or valuation', () => {
  const page = projectTransfersDiscovery(response([
    player({salary: 5000, transferFee: 100000, agentMandateOwner: 'private'}),
    player({id: 189, display_name: 'Anna Bianchi', clubKey: null, clubName: null})
  ]));
  assert.equal(page.phase, TRANSFERS_DISCOVERY_PHASE);
  assert.equal(page.players[0].affiliation, 'affiliated');
  assert.equal(page.players[1].affiliation, 'free-agent');
  assert.equal(page.players[0].transferAvailability, 'not-published');
  assert.equal(page.players[1].transferAvailability, 'not-published');
  for (const entry of page.players) {
    assert.ok(!Object.hasOwn(entry, 'salary'));
    assert.ok(!Object.hasOwn(entry, 'transferFee'));
    assert.ok(!Object.hasOwn(entry, 'agentMandateOwner'));
    assert.ok(!Object.hasOwn(entry, 'listingPrice'));
    assert.equal(Object.isFrozen(entry), true);
  }
  assert.equal(Object.isFrozen(page.players), true);
  assert.equal(Object.isFrozen(page), true);
});

test('invalid and stale public reads fail closed instead of inventing results', () => {
  const good = response([player()]);
  for (const invalid of [
    {...good, page: 2}, {...good, pageSize: 25}, {...good, totalPages: 2},
    {...good, count: -1}, {...good, players: null},
    response([player(), player()]),
    response([player({clubKey: undefined})]),
    response([player({clubKey: 'XX-1'})]),
    response([player({clubKey: null, clubName: 'Old Club'})]),
    response([player({display_name: ''})]),
    response([player({primary_position: 'striker'})])
  ]) assert.throws(() => projectTransfersDiscovery(invalid), TypeError);
  assert.throws(() => projectTransfersDiscovery(good, {offset: 50}), TypeError);
  assert.deepEqual(projectTransfersDiscovery(response([])).players, []);
});

test('model contains no writable market lifecycle or payment API', async () => {
  const api = await import('../assets/transfers-discovery.mjs');
  assert.deepEqual(Object.keys(api).sort(), [
    'TRANSFERS_DISCOVERY_PHASE','TRANSFERS_PLAYER_PAGE_SIZE','projectTransfersDiscovery',
    'transfersDiscoveryRequest','transfersPlayerLinks'
  ]);
});
