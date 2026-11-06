import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const codes = ['GER','AUT','SUI','BEL'];
const root = new URL('./countries/', import.meta.url);
const expected = ['schema_version','code','kind','selection_policy','sources','surnames','production_ready'];
const latin = /^(?:\p{Script=Latin}\p{M}*)+(?:[ '\u2019-](?:\p{Script=Latin}\p{M}*)+)*$/u;
const mark = /\p{M}/gu, latinMark = /\p{Script_Extensions=Latin}/u;
const valid = n => typeof n === 'string' && !!n && n === n.normalize('NFC') &&
    latin.test(n) && [...n.matchAll(mark)].every(([m]) => latinMark.test(m));

for (const code of codes) {
  test(code + ': 500 unique NFC Latin surnames, uniform and unweighted', () => {
    const doc = JSON.parse(readFileSync(new URL(code + '.json', root), 'utf8'));
    assert.deepEqual(Object.keys(doc), expected);
    assert.equal(doc.schema_version, 1);
    assert.equal(doc.code, code);
    assert.equal(doc.kind, 'surnames');
    assert.equal(doc.selection_policy, 'uniform');
    assert.equal(doc.production_ready, false);
    assert.ok(Array.isArray(doc.sources) && doc.sources.length > 0);
    for (const s of doc.sources) assert.ok(s.id && s.url && s.scope && s.limitations);
    assert.equal(doc.surnames.length, 500);
    const seen = new Set();
    for (const entry of doc.surnames) {
      assert.deepEqual(Object.keys(entry), ['value']);
      assert.ok(valid(entry.value), 'invalid surname: ' + entry.value);
      const folded = entry.value.toLowerCase();
      assert.ok(!seen.has(folded), 'duplicate surname: ' + entry.value);
      seen.add(folded);
    }
  });
}

test('strict Unicode negative and positive adversarial examples', () => {
  for (const n of ['', 'Иванов', 'Παπαδόπουλος', 'محمد', 'Müllеr', 'De  Smet', "O''Brien", '-Bauer', 'Keller-', 'van_de', 'Keller1', 'Cafe\u0301'])
    assert.equal(valid(n), false, 'should reject ' + n);
  for (const n of ['Müller', 'Groß', "O'Brien", 'O\u2019Brien', 'van der Meer', 'de Silva', 'Bär-Schmid', 'François'])
    assert.equal(valid(n), true, 'should accept ' + n);
});
