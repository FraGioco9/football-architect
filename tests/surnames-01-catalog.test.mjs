import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = join(root, 'data/players/surnames');
const catalog = JSON.parse(readFileSync(join(dir, 'catalog-v1.json'), 'utf8'));
const expectedCodes = 'ESP ARG FRA ENG POR BRA MAR BEL NED MEX COL SUI GER CRO ITA USA JPN SEN NOR URU DEN AUT IRN ECU EGY AUS CAN ALG CIV NGA TUR KOR PAR SWE RUS UKR POL HUN WAL COD GRE CMR SCO SRB SVK PAN MLI RSA VEN CHI'.split(' ');
const forbidden = new Set(['weight', 'probability', 'frequency_weight', 'selection_weight']);
const latinToken = /^(?:\p{Script=Latin}\p{M}*)+$/u;
const latinMark = /\p{Script_Extensions=Latin}/u;
const marks = /\p{M}/gu;
const separators = /[ '\u2019-]/u;
const separatorSequence = /[ '\u2019-]{2}/u;

function validSurname(value) {
  if (typeof value !== 'string' || value.length < 1 || value !== value.normalize('NFC')) return false;
  // Authentic Dutch surname contractions: "van 't Hof" and "'s Graeuwen".
  // Syntax-only normalization: keep the original surname value untouched.
  const syntax = value.replace(/(^| )'(?:s|t)(?= )/giu, '$1t');
  if (separators.test(syntax[0]) || separators.test(syntax[syntax.length - 1]) || separatorSequence.test(syntax)) return false;
  return syntax.split(separators).every(token =>
    latinToken.test(token) && [...token.matchAll(marks)].every(([mark]) => latinMark.test(mark))
  );
}

function checkForbiddenKeys(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, subvalue] of Object.entries(value)) {
    assert.ok(!forbidden.has(key), 'Forbidden field ' + path + '.' + key);
    checkForbiddenKeys(subvalue, path + '.' + key);
  }
}

test('exactly the 50 canonical PLAYERS-03 codes and one file per code', () => {
  assert.deepEqual(catalog.countries.map(x => x.code), expectedCodes);
  assert.equal(new Set(catalog.countries.map(x => x.code)).size, 50);
  assert.deepEqual(
    readdirSync(join(dir, 'countries')).filter(x => x.endsWith('.json')).sort(),
    expectedCodes.map(x => x + '.json').sort()
  );
});

test('catalog is uniform, nonproduction and has valid per-country metadata', () => {
  assert.equal(catalog.schema_version, 1);
  assert.equal(catalog.kind, 'surnames_catalog');
  assert.equal(catalog.selection_policy, 'uniform');
  assert.equal(catalog.target_per_country, 3000);
  assert.equal(catalog.target_total_surnames, 150000);
  assert.equal(catalog.total_surnames, catalog.countries.reduce((sum, x) => sum + x.count, 0));
  assert.equal(catalog.production_ready, false);
  checkForbiddenKeys(catalog);
  for (const country of catalog.countries) {
    assert.equal(country.path, 'data/players/surnames/countries/' + country.code + '.json');
    assert.ok(['complete', 'partial', 'pending', 'blocked'].includes(country.status));
    assert.equal(country.production_ready, false);
    assert.equal(typeof country.sources_available, 'boolean');
    assert.match(country.source_head_sha, /^[a-f0-9]{40}$/);
    assert.match(country.source_blob_sha, /^[a-f0-9]{40}$/);
    assert.match(country.source_branch, /^research\/surnames-01-batch-[a-m]$/);
    assert.ok(country.count >= 500 && country.count <= 3000);
    if (country.expansion_blob_sha) {
      assert.match(country.expansion_blob_sha, /^[a-f0-9]{40}$/);
      assert.match(country.expansion_branch, /^research\/surnames-3000-batch-[a-m]$/);
      assert.match(country.expansion_head_sha, /^[a-f0-9]{40}$/);
    }
    assert.ok(Number.isInteger(country.source_pr) && country.source_pr > 0);
  }
});

for (const country of catalog.countries) {
  test(country.code + ': exact source blob, strict surname contract and actual count', () => {
    const path = join(root, country.path);
    const sourceSha = execFileSync('git', ['hash-object', path], { cwd: root, encoding: 'utf8' }).trim();
    assert.equal(sourceSha, country.expansion_blob_sha ?? country.source_blob_sha, 'exact original or expanded source Git blob must be preserved');
    const bank = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(Object.keys(bank).sort(), [
      'code', 'kind', 'production_ready', 'schema_version',
      'selection_policy', 'sources', 'surnames'
    ].sort());
    assert.equal(bank.schema_version, 1);
    assert.equal(bank.code, country.code);
    assert.equal(bank.kind, 'surnames');
    assert.equal(bank.selection_policy, 'uniform');
    assert.equal(bank.production_ready, false);
    assert.ok(Array.isArray(bank.sources) && bank.sources.length > 0);
    assert.ok(bank.sources.some(s => /^https:\/\//.test(s.url || s.source_url || '')));
    assert.equal(country.sources_available, true);
    assert.ok(Array.isArray(bank.surnames));
    assert.equal(bank.surnames.length, country.count);
    assert.equal(country.status, bank.surnames.length === 3000 ? 'complete' : 'partial');
    if (country.status === 'complete') assert.equal(bank.surnames.length, 3000);
    if (country.status === 'partial') assert.ok(bank.surnames.length >= 500 && bank.surnames.length < 3000);
    if (country.expansion_blob_sha) {
      // The 500-name original was committed in the integration branch history.
      // Verify the exact original blob and preserve its sequence, not only its cardinality.
      const previous = JSON.parse(execFileSync('git', ['cat-file', 'blob', country.source_blob_sha], {
        cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024
      }));
      assert.equal(previous.code, bank.code);
      assert.equal(previous.surnames.length, 500);
      assert.deepEqual(bank.surnames.slice(0, 500), previous.surnames, country.code + ' original 500 surnames must remain byte-for-byte equivalent at entry level');
    }
    const seen = new Set();
    checkForbiddenKeys(bank);
    for (const [index, item] of bank.surnames.entries()) {
      assert.deepEqual(Object.keys(item), ['value'], country.code + ' item ' + index + ' must have only value');
      assert.ok(validSurname(item.value), country.code + ' item ' + index + ' illegal: ' + item.value);
      const key = item.value.toLowerCase().normalize('NFC');
      assert.ok(!seen.has(key), country.code + ' duplicate: ' + item.value);
      seen.add(key);
    }
  });
}

test('cumulative counts match real pools and the 150,000 target, without padding', () => {
  const entries = catalog.countries.reduce((sum, country) => sum + country.count, 0);
  assert.equal(entries, catalog.total_surnames);
  assert.ok(entries >= 25000 && entries <= 150000);
  assert.equal(catalog.countries.filter(x => x.status === 'complete').length, 18);
  assert.equal(catalog.countries.filter(x => x.status === 'partial').length, 32);
  const mali = catalog.countries.find(x => x.code === 'MLI');
  assert.equal(mali.count, 927);
  assert.equal(mali.status, 'partial');
  for (const [code, count] of [['COD', 1001], ['CMR', 1000], ['RSA', 1000], ['AUS', 999]]) {
    const bank = catalog.countries.find(x => x.code === code);
    assert.equal(bank.count, count);
    assert.equal(bank.status, 'partial');
  }
});

test('adversarial Unicode and compound surname grammar', () => {
  for (const value of ['Rossi', 'De Luca', "O'Brien", 'O\u2019Reilly', 'García-Márquez', 'Müller', 'Łukaszewicz', 'D\u017eajić', "van 't Hof", "in 't Veld", "'s Graeuwen"]) {
    assert.ok(validSurname(value), 'valid: ' + value);
  }
  for (const value of ['Иванов', 'Ανδρέου', 'محمد', '山田', '김', 'שי', 'Rоssi', 'A\u0301lvarez', 'abc\u0300\u034f', '', ' De Luca', 'De Luca ', 'De  Luca', "O''Brien", 'Smith--Jones', '-Rossi', 'Rossi-', 'Smith2', 'Smith.Watson', 'Smith\tJones', "'x Veld", "'t", "'s", "van 't"]) {
    assert.equal(validSurname(value), false, 'reject: ' + value);
  }
});

test('PLAYERS-03 male given-name files are unchanged by this PR', () => {
  if (!process.env.GITHUB_ACTIONS) return;
  const output = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD', '--', 'data/players/names/'], {
    cwd: root, encoding: 'utf8'
  }).trim();
  assert.equal(output, '', 'PR cannot alter PLAYERS-03 male name files');
});
