import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expectedCounts = Object.freeze({ ENG: 500, WAL: 500, POR: 500, BRA: 500 });
const latinToken = '(?:\\p{Script=Latin}\\p{M}*)+';
const pattern = new RegExp('^' + latinToken + "(?:[ '\\u2019-]" + latinToken + ')*$', 'u');
const mark = /\p{M}/gu;
const latinMark = /\p{Script_Extensions=Latin}/u;
function isLatinSurname(value) {
  return typeof value === 'string'
    && value.length > 0
    && value === value.normalize('NFC')
    && pattern.test(value)
    && [...value.matchAll(mark)].every(([character]) => latinMark.test(character));
}
function folded(value) {
  return value.toLocaleLowerCase('en').normalize('NFD').replace(mark, '').replace(/\u2019/g, "'");
}
function assertNoWeightKeys(value, path = '$') {
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    for (const forbidden of ['weight', 'frequency', 'probability']) {
      assert.notEqual(key.toLowerCase(), forbidden, 'Unexpected ' + forbidden + ' key at ' + path + '.' + key);
    }
    assertNoWeightKeys(child, path + '.' + key);
  }
}
for (const [code, count] of Object.entries(expectedCounts)) {
  test(code + ' — ' + count + ' unique, uniform surnames', () => {
    const pathname = resolve(root, 'data', 'players', 'surnames', 'countries', code + '.json');
    const doc = JSON.parse(readFileSync(pathname, 'utf8'));
    assert.equal(doc.schema_version, 1);
    assert.equal(doc.code, code);
    assert.equal(doc.kind, 'surnames');
    assert.equal(doc.selection_policy, 'uniform');
    assert.equal(doc.production_ready, false);
    assert.ok(Array.isArray(doc.surnames) && doc.surnames.length === count && count <= 500);
    assert.deepEqual(Object.keys(doc).sort(), ['schema_version', 'code', 'kind', 'selection_policy', 'sources', 'surnames', 'production_ready'].sort());
    assert.ok(Array.isArray(doc.sources) && doc.sources.length > 0);
    for (const source of doc.sources) {
      for (const field of ['id', 'title', 'url', 'territory', 'period', 'scope', 'limitations']) {
        assert.ok(typeof source[field] === 'string' && source[field].length > 0, code + ' missing source ' + field);
      }
      assert.match(source.url, /^https:\/\//);
    }
    assertNoWeightKeys(doc);
    const unique = new Set();
    for (const entry of doc.surnames) {
      assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry));
      assert.deepEqual(Object.keys(entry), ['value'], code + ' must only contain value');
      assert.ok(isLatinSurname(entry.value), code + ': invalid Latin NFC surname ' + JSON.stringify(entry.value));
      const key = folded(entry.value);
      assert.ok(!unique.has(key), code + ': duplicate or accent-equivalent ' + entry.value);
      unique.add(key);
    }
    assert.equal(unique.size, count);
  });
}
test('Valid Latin multipart surnames, diacritics and apostrophes', () => {
  for (const surname of ['Smith', 'Gonçalves', 'De Silva', "O'Brien", 'O\u2019Neill', 'Smith-Jones', 'Müller']) {
    assert.ok(isLatinSurname(surname), surname);
  }
});
test('Reject adversarial Unicode and malformed separators', () => {
  for (const surname of [
    '', ' ', 'Smith ', ' Smith', 'O--Brien', "O''Brien", 'de  Silva',
    '-Smith', 'Smith-', "'Smith", "Smith'", 'Smith/', 'Smith2',
    'Смит', 'Σmith', 'Smiтh', 'محمد', '田中', 'Smi🙂th',
    'Gonc\u0327alves', 'A\u034Fbc', 'A\u0308', '漢Smith', 'Jose\u0301',
  ]) {
    assert.ok(!isLatinSurname(surname), 'incorrectly accepted ' + JSON.stringify(surname));
  }
});
test('Recursive forbidden-key checks catch weight variants', () => {
  for (const key of ['weight', 'Weight', 'WEIGHT', 'frequency', 'probability']) {
    assert.throws(() => assertNoWeightKeys({ surnames: [{ value: 'Silva', [key]: 1 }] }));
  }
});
