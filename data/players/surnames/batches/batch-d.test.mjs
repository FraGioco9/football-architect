import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const countries = { ARG: "AR", MEX: "MX", COL: "CO", CHI: "CL" };
const rootKeys = ["schema_version", "code", "kind", "selection_policy", "sources", "surnames", "production_ready"].sort();
const latinParts = /^(?:\p{Script=Latin}\p{M}*)+(?:(?:[ '\u2019-])(?:\p{Script=Latin}\p{M}*)+)*$/u;
const latinMark = /\p{Script_Extensions=Latin}/u;
const fold = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function validSurname(value) {
  return typeof value === "string"
    && value.length > 0
    && value === value.normalize("NFC")
    && latinParts.test(value)
    && [...value.matchAll(/\p{M}/gu)].every(([mark]) => latinMark.test(mark));
}

for (const [code, iso2] of Object.entries(countries)) {
  test(code + ": 500 source-backed surnames, Latin NFC, uniform selection", () => {
    const file = new URL("../countries/" + code + ".json", import.meta.url);
    const doc = JSON.parse(readFileSync(file, "utf8"));

    assert.deepEqual(Object.keys(doc).sort(), rootKeys);
    assert.equal(doc.schema_version, 1);
    assert.equal(doc.code, code);
    assert.equal(doc.kind, "surnames");
    assert.equal(doc.selection_policy, "uniform");
    assert.equal(doc.production_ready, false);

    assert.ok(Array.isArray(doc.sources) && doc.sources.length >= 1);
    for (const source of doc.sources) {
      assert.equal(typeof source.id, "string");
      assert.equal(source.country, iso2, "each source must refer to this country");
      assert.match(source.url, /^https:\/\//);
      assert.ok(source.scope?.includes(iso2), "source must document country scope");
    }

    assert.ok(Array.isArray(doc.surnames));
    assert.equal(doc.surnames.length, 500);
    const keys = new Set();
    for (const [i, surname] of doc.surnames.entries()) {
      assert.deepEqual(Object.keys(surname), ["value"], "entry " + i + ": only value allowed");
      assert.ok(!("weight" in surname), "entry " + i + ": no weights");
      assert.ok(validSurname(surname.value), "entry " + i + ": invalid Latin NFC / separator: " + surname.value);
      const key = fold(surname.value);
      assert.ok(!keys.has(key), "entry " + i + ": duplicate or diacritic-equivalent: " + surname.value);
      keys.add(key);
    }
  });
}

test("accept genuine Latin-script accents and multiword separators", () => {
  for (const name of ["Muñoz", "Müller", "González", "San Martín", "O'Brien", "D’Angelo", "Pérez-López"]) {
    assert.equal(validSurname(name), true, name);
  }
});

test("reject Cyrillic, Greek, confusables, malformed separators, and decomposed text", () => {
  for (const name of ["Иванов", "Παπαδόπουλος", "Garсía", "San  Martín", "-Pérez", "Pérez-", "Pérez--López", "O''Brien", "Pérez9", "Mu\u0303noz", ""]) {
    assert.equal(validSurname(name), false, name);
  }
});
